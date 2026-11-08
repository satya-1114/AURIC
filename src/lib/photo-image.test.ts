import { describe, expect, it } from "vitest";
import { validatePhoto } from "./photo-image.server";

function png(width: number, height: number) {
  const bytes = new Uint8Array(33);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return `data:image/png;base64,${btoa(String.fromCharCode(...bytes))}`;
}
describe("Server-side photo validation", () => {
  it("validates dimensions from bytes, not client claims", () => {
    expect(validatePhoto(png(1100, 700)).width).toBe(1100);
  });
  it("rejects undersized images", () => {
    expect(() => validatePhoto(png(99, 100))).toThrow("100 × 100");
  });
  it("rejects oversized dimensions", () => {
    expect(() => validatePhoto(png(6001, 100))).toThrow("6000");
  });
  it("rejects excessive pixel count", () => {
    expect(() => validatePhoto(png(4000, 4000))).toThrow("12 megapixels");
  });
  it("rejects MIME spoofing and corrupt images", () => {
    expect(() => validatePhoto(png(1100, 700).replace("image/png", "image/jpeg"))).toThrow(
      "does not match",
    );
    expect(() => validatePhoto("data:image/png;base64,YWJj")).toThrow("damaged");
  });
  it("rejects SVG and excessive bytes before decoding", () => {
    expect(() => validatePhoto("data:image/svg+xml;base64,YWJj")).toThrow("valid JPEG");
    expect(() => validatePhoto("x".repeat(7_000_000))).toThrow("5 MB");
  });
});
