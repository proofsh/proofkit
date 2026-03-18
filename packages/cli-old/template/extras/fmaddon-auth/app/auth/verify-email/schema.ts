import { z } from "zod/v4";

export const emailVerificationSchema = z.object({
  code: z.string().length(8),
});
