import { z } from "zod";
import { purityField, weightField } from "./validation";

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const PHOTO_MIMES = ["image/jpeg", "image/png", "image/webp"] as const;
export const extractionSchema = z
  .object({
    gross_weight: z.string().nullable(),
    displayed_value: z.string().nullable(),
    unit: z.string().nullable(),
    purity_percent: z.string().nullable(),
    karat: z.string().nullable(),
    confidence: z.number(),
    warnings: z.array(z.string()),
  })
  .strict();
export type Extraction = z.infer<typeof extractionSchema>;
export type Reading = {
  id: string;
  extraction: Extraction | null;
  status: "draft" | "confirmed" | "rejected";
  threshold: number;
  weight: string | null;
  purity: string | null;
  error: string | null;
};

/** Exact decimal comparison, not a gold calculation. */
export function sameDecimal(a: string, b: string): boolean {
  const normalize = (s: string) => {
    if (!/^\d+(\.\d+)?$/.test(s.trim())) return null;
    const [whole = "", fraction = ""] = s.trim().split(".");
    return `${whole.replace(/^0+(?=\d)/, "")}.${fraction.replace(/0+$/, "")}`;
  };
  const n = normalize(a);
  return n !== null && n === normalize(b);
}

export function normalizeExtraction(raw: Extraction): Extraction {
  const e = { ...raw, warnings: [...raw.warnings] };
  if (!Number.isFinite(e.confidence) || e.confidence < 0 || e.confidence > 1) {
    e.confidence = 0;
    e.warnings.push("Confidence could not be validated. Verify manually.");
  }
  if (
    e.gross_weight !== null &&
    (!weightField.safeParse(e.gross_weight).success ||
      !["g", "grams", "gram"].includes(e.unit?.trim().toLowerCase() ?? ""))
  ) {
    e.gross_weight = null;
    e.warnings.push("A valid weight in grams was not readable. Enter and verify manually.");
  }
  if (e.purity_percent !== null && !purityField.safeParse(e.purity_percent).success) {
    e.purity_percent = null;
    e.warnings.push("Purity was not readable. Enter and verify manually.");
  }
  if (e.gross_weight === null && e.purity_percent === null) {
    e.warnings.push("No usable weight or purity was found.");
  }
  return e;
}

export function needsManualVerification(reading: Reading, weight: string, purity: string) {
  const e = reading.extraction;
  return (
    !e ||
    !!reading.error ||
    e.confidence < reading.threshold ||
    e.warnings.length > 0 ||
    (!!weight && (!e.gross_weight || !sameDecimal(weight, e.gross_weight))) ||
    (!!purity && (!e.purity_percent || !sameDecimal(purity, e.purity_percent))) ||
    (!weight && e.gross_weight !== null) ||
    (!purity && e.purity_percent !== null)
  );
}

export function readingBlocks(reading: Reading, weight: string, purity: string) {
  if (reading.status === "rejected") return false;
  if (reading.status !== "confirmed") return true;
  return (
    (!!reading.weight && !sameDecimal(reading.weight, weight)) ||
    (!!reading.purity && !sameDecimal(reading.purity, purity))
  );
}

export function uploadError(type: string, size: number): string | null {
  if (!(PHOTO_MIMES as readonly string[]).includes(type))
    return "Choose a JPEG, PNG or WebP photograph.";
  if (size <= 0 || size > MAX_PHOTO_BYTES) return "Photographs must be between 1 byte and 5 MB.";
  return null;
}

export function safeAnalysisError(error: unknown): { message: string; status: number } {
  const e =
    error && typeof error === "object"
      ? (error as { statusCode?: number; responseBody?: string; name?: string })
      : {};
  const status = e.statusCode ?? 500;
  if (e.responseBody) {
    try {
      const body = JSON.parse(e.responseBody);
      const message = body.message ?? body.error?.message;
      if (typeof message === "string" && message.length < 1500) return { status, message };
    } catch {
      /* Never expose an HTML response or image payload. */
    }
  }
  if (status === 429)
    return {
      status,
      message: "AI is busy. Wait before trying again, or enter the reading manually.",
    };
  if (status === 401)
    return { status, message: "Photo analysis is not configured. Manual entry is available." };
  if (e.name === "AbortError")
    return {
      status: 499,
      message: "Analysis was interrupted. Enter manually or start a new analysis.",
    };
  return {
    status,
    message:
      "The photograph could not be analyzed. Check your connection or enter and verify manually.",
  };
}
