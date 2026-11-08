import { describe, expect, it } from "vitest";
import { allowedLoss, excessLoss, outstandingFine, previewFineWeight } from "./gold-math";
import { purityField, weightField, wastageField } from "./validation";

describe("fine gold calculation", () => {
  it("120.000 × 91.60% = 109.920", () =>
    expect(previewFineWeight("120.000", "91.60")).toBe("109.920"));
  it("112.450 × 91.60% = 103.004", () =>
    expect(previewFineWeight("112.450", "91.60")).toBe("103.004"));
  it("3.300 × 91.60% = 3.023", () => expect(previewFineWeight("3.300", "91.60")).toBe("3.023"));
});

describe("balance", () => {
  it("outstanding for TX-30411 is 3.893 g", () =>
    expect(outstandingFine("109.920", ["103.004", "3.023"])).toBe("3.893"));
});

describe("wastage", () => {
  it("allowed at 3.00% of 109.920 g is 3.298 g", () =>
    expect(allowedLoss("109.920", "3.00")).toBe("3.298"));
  it("excess of 3.893 g over 3.298 g is 0.595 g", () =>
    expect(excessLoss("3.893", "3.298")).toBe("0.595"));
  it("no excess when within the limit", () => expect(excessLoss("2.000", "3.298")).toBe("0.000"));
});

describe("validation", () => {
  it("rejects zero weight", () => expect(weightField.safeParse("0").success).toBe(false));
  it("rejects negative weight", () => expect(weightField.safeParse("-1.000").success).toBe(false));
  it("rejects more than 3 decimals on weight", () =>
    expect(weightField.safeParse("1.0001").success).toBe(false));
  it("accepts 120.000 g", () => expect(weightField.safeParse("120.000").success).toBe(true));
  it("rejects purity above 100", () => expect(purityField.safeParse("100.01").success).toBe(false));
  it("rejects purity of 0", () => expect(purityField.safeParse("0").success).toBe(false));
  it("rejects more than 2 decimals on purity", () =>
    expect(purityField.safeParse("91.601").success).toBe(false));
  it("rejects non-numeric purity", () => expect(purityField.safeParse("abc").success).toBe(false));
  it("rejects negative wastage", () => expect(wastageField.safeParse("-1").success).toBe(false));
  it("rejects preview with too many decimals", () =>
    expect(previewFineWeight("1.0001", "91.6")).toBeNull());
});
