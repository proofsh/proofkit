"use server";

import {
  setPasswordResetSessionAsEmailVerified,
  validatePasswordResetSessionRequest,
} from "@/server/auth/utils/password-reset";
import { setUserAsEmailVerifiedIfEmailMatches } from "@/server/auth/utils/user";
import { actionClient } from "@/server/safe-action";
import { redirect } from "next/navigation";

import { verifyEmailSchema } from "./schema";

export const verifyEmailAction = actionClient
  .schema(verifyEmailSchema)
  .action(async ({ parsedInput }) => {
    const { session } = await validatePasswordResetSessionRequest();
    if (session === null) {
      return {
        error: "Not authenticated",
      };
    }
    if (Boolean(session.email_verified)) {
      return {
        error: "Forbidden",
      };
    }

    const { code } = parsedInput;

    if (code !== session.code) {
      return {
        error: "Incorrect code",
      };
    }
    await setPasswordResetSessionAsEmailVerified(session.id);
    const emailMatches = await setUserAsEmailVerifiedIfEmailMatches(
      session.id_user,
      session.email
    );
    if (!emailMatches) {
      return {
        error: "Please restart the process",
      };
    }
    return redirect("/auth/reset-password");
  });
