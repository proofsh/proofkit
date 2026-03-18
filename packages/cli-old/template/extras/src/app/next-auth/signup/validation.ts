import { z } from "zod/v4";

export const signUpSchema = z
  .object({
    email: z.string().email(),
    password: z.string(),
    passwordConfirm: z.string(),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: "Passwords don't match",
    path: ["passwordConfirm"],
  });
