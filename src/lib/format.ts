type Num = number | string | null | undefined;
const n = (v: Num) => (v === null || v === undefined ? 0 : typeof v === "string" ? Number(v) : v);

export const fmtGrams = (g: Num) =>
  `${n(g).toLocaleString("en-IN", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} g`;
export const fmtPurity = (p: Num) => n(p).toFixed(2);
export const fmtINR = (v: Num) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n(v));
export const fmtPct = (v: Num) => `${n(v).toFixed(2)}%`;
export const fmtDate = (d: string) =>
  new Date(d.length === 10 ? d + "T00:00:00" : d).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
export const todayISO = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
export const daysAgoISO = (days: number) => {
  const d = new Date(Date.now() - days * 86400000);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
