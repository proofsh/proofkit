import { z } from "zod/v4";

export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, { message: "Your password should be at least 8 characters" })
      .max(255, { message: "Password is too long" }),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });
