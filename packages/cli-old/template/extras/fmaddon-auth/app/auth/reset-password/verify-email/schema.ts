import { z } from "zod/v4";

export const verifyEmailSchema = z.object({
  code: z.string().length(8),
});
