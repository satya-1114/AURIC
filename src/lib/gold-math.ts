// Preview-only fine weight using exact integer arithmetic (no floats).
// Mirrors the database rule: round(gross × purity / 100, 3), half away from zero.
// The database recalculates on insert and its value is authoritative.
function toScaled(value: string, scale: number): bigint | null {
  const v = value.trim();
  if (!/^\d+(\.\d+)?$/.test(v)) return null;
  const [int, frac = ""] = v.split(".");
  if (frac.length > scale) return null;
  return BigInt(int + frac.padEnd(scale, "0"));
}

export function previewFineWeight(gross: string, purity: string): string | null {
  const g = toScaled(gross, 3); // thousandths of a gram
  const p = toScaled(purity, 2); // hundredths of a percent
  if (g === null || p === null) return null;
  // g/1000 × p/100 / 100 = g×p / 10^7 grams → in thousandths: g×p / 10^4
  const num = g * p;
  let q = num / 10000n;
  if ((num % 10000n) * 2n >= 10000n) q += 1n;
  const s = q.toString().padStart(4, "0");
  return `${s.slice(0, -3)}.${s.slice(-3)}`;
}

export const WEIGHT_RE = /^\d{1,9}(\.\d{1,3})?$/;
export const PURITY_RE = /^\d{1,3}(\.\d{1,2})?$/;

/** Grams string ("3.893") → integer thousandths. */
export function toMilligrams(g: string): bigint {
  const neg = g.startsWith("-");
  const s = toScaled(neg ? g.slice(1) : g, 3);
  if (s === null) throw new Error(`Invalid weight: ${g}`);
  return neg ? -s : s;
}
export function fromMilligrams(mg: bigint): string {
  const neg = mg < 0n;
  const s = (neg ? -mg : mg).toString().padStart(4, "0");
  return `${neg ? "-" : ""}${s.slice(0, -3)}.${s.slice(-3)}`;
}
/** Outstanding = issued fine − Σ received fine (exact). */
export function outstandingFine(issued: string, received: string[]): string {
  return fromMilligrams(received.reduce((a, r) => a - toMilligrams(r), toMilligrams(issued)));
}
/** Allowed loss = round(fine × wastage% / 100, 3), half away from zero. */
export function allowedLoss(fine: string, wastagePct: string): string {
  const f = toMilligrams(fine);
  const p = toScaled(wastagePct, 2);
  if (p === null) throw new Error("Invalid wastage %");
  const num = f * p; // thousandths × hundredths-of-percent → divide by 10^4
  let q = num / 10000n;
  if ((num % 10000n) * 2n >= 10000n) q += 1n;
  return fromMilligrams(q);
}
export function excessLoss(actual: string, allowed: string): string {
  const d = toMilligrams(actual) - toMilligrams(allowed);
  return fromMilligrams(d > 0n ? d : 0n);
}
