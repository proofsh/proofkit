import { z } from "zod/v4";

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});
