import { z } from "zod";
import { PURITY_RE, WEIGHT_RE } from "./gold-math";

// Client-side mirrors of the database rules. The database re-validates everything.
export const weightField = z
  .string()
  .trim()
  .refine((v) => !v.startsWith("-"), "Weight cannot be negative")
  .refine((v) => /^\d+(\.\d+)?$/.test(v), "Enter a number")
  .refine((v) => WEIGHT_RE.test(v), "At most 3 decimal places")
  .refine((v) => Number(v) > 0, "Must be greater than 0");

export const purityField = z
  .string()
  .trim()
  .refine((v) => /^\d+(\.\d+)?$/.test(v), "Enter a number")
  .refine((v) => PURITY_RE.test(v), "At most 2 decimal places")
  .refine((v) => Number(v) > 0 && Number(v) <= 100, "Between 0 and 100");

export const wastageField = z
  .string()
  .trim()
  .refine((v) => /^\d{1,3}(\.\d{1,2})?$/.test(v), "0–100, at most 2 decimals")
  .refine((v) => Number(v) >= 0 && Number(v) <= 100, "Between 0 and 100");

export const karigarSchema = z.object({
  karigar_code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{2,20}$/, "2–20 letters, digits or dashes"),
  full_name: z.string().trim().min(1, "Name is required").max(100),
  phone: z
    .string()
    .trim()
    .regex(/^([0-9 +()-]{6,20})?$/, "Digits, spaces, + ( ) - only"),
  preferred_language: z.string().trim().max(30),
});
