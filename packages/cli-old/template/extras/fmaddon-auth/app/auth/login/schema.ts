import { z } from "zod/v4";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});
