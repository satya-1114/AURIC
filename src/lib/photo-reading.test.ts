import { describe, expect, it } from "vitest";
import {
  extractionSchema,
  normalizeExtraction,
  needsManualVerification,
  readingBlocks,
  sameDecimal,
  uploadError,
  safeAnalysisError,
  type Extraction,
  type Reading,
} from "./photo-reading";

const good: Extraction = {
  gross_weight: "120.000",
  displayed_value: "120.000",
  unit: "g",
  purity_percent: null,
  karat: null,
  confidence: 0.98,
  warnings: [],
};
const reading: Reading = {
  id: "test",
  extraction: good,
  status: "confirmed",
  threshold: 0.9,
  weight: "120.000",
  purity: null,
  error: null,
};
describe("Photo extraction safeguards with mocked AI results", () => {
  it("accepts readable 120.000 g and never derives purity from karat", () => {
    const e = normalizeExtraction({ ...good, karat: "22" });
    expect(e.gross_weight).toBe("120.000");
    expect(e.purity_percent).toBeNull();
  });
  it("returns null for unreadable fields", () => {
    const e = normalizeExtraction({ ...good, gross_weight: null, displayed_value: null });
    expect(e.gross_weight).toBeNull();
    expect(e.warnings.length).toBeGreaterThan(0);
  });
  it("rejects incorrect units rather than converting them", () => {
    expect(normalizeExtraction({ ...good, unit: "kg" }).gross_weight).toBeNull();
  });
  it("rejects invalid precision from the model", () => {
    expect(normalizeExtraction({ ...good, gross_weight: "120.0001" }).gross_weight).toBeNull();
  });
  it("requires manual verification below the configured threshold", () => {
    expect(
      needsManualVerification(
        { ...reading, extraction: { ...good, confidence: 0.89 } },
        "120.000",
        "",
      ),
    ).toBe(true);
    expect(needsManualVerification(reading, "120.000", "")).toBe(false);
  });
  it("requires explicit verification for edited readings", () => {
    expect(needsManualVerification(reading, "121.000", "")).toBe(true);
  });
  it("blocks 121.000 g against confirmed 120.000 g", () => {
    expect(readingBlocks(reading, "121.000", "91.60")).toBe(true);
    expect(readingBlocks(reading, "120.000", "91.60")).toBe(false);
  });
  it("blocks unverified drafts and allows rejected photos to fall back to manual entry", () => {
    expect(readingBlocks({ ...reading, status: "draft" }, "120.000", "91.60")).toBe(true);
    expect(readingBlocks({ ...reading, status: "rejected" }, "121.000", "91.60")).toBe(false);
  });
  it("compares decimals exactly and blocks invalid values", () => {
    expect(sameDecimal("120", "120.000")).toBe(true);
    expect(sameDecimal("120.001", "120.000")).toBe(false);
    expect(sameDecimal("", "")).toBe(false);
  });
  it("blocks purity discrepancies", () => {
    expect(readingBlocks({ ...reading, purity: "91.60" }, "120.000", "92.00")).toBe(true);
  });
  it("rejects invalid image uploads and size", () => {
    expect(uploadError("application/pdf", 100)).not.toBeNull();
    expect(uploadError("image/png", 5 * 1024 * 1024 + 1)).not.toBeNull();
    expect(uploadError("image/jpeg", 0)).not.toBeNull();
    expect(uploadError("image/jpeg", 1000)).toBeNull();
  });
  it("handles API rate limits and preserves safe upstream failures", () => {
    expect(safeAnalysisError({ statusCode: 429 }).status).toBe(429);
    expect(
      safeAnalysisError({ statusCode: 403, responseBody: '{"message":"Access denied"}' }),
    ).toEqual({ status: 403, message: "Access denied" });
    expect(safeAnalysisError(new Error("secret payload")).message).not.toContain("secret payload");
  });
  it("requires human verification after API failure", () => {
    expect(
      needsManualVerification(
        { ...reading, extraction: null, error: "Network interrupted" },
        "120.000",
        "",
      ),
    ).toBe(true);
  });
  it("rejects malformed model output", () => {
    expect(extractionSchema.safeParse({ gross_weight: 120 }).success).toBe(false);
  });
});
