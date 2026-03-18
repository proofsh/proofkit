"use server";

import { verifyPasswordStrength } from "@/server/auth/utils/password";
import {
  deletePasswordResetSessionTokenCookie,
  invalidateUserPasswordResetSessions,
  validatePasswordResetSessionRequest,
} from "@/server/auth/utils/password-reset";
import {
  createSession,
  generateSessionToken,
  invalidateUserSessions,
  setSessionTokenCookie,
} from "@/server/auth/utils/session";
import { updateUserPassword } from "@/server/auth/utils/user";
import { actionClient } from "@/server/safe-action";
import { redirect } from "next/navigation";

import { resetPasswordSchema } from "./schema";

export const resetPasswordAction = actionClient
  .schema(resetPasswordSchema)
  .action(async ({ parsedInput }) => {
    const { password } = parsedInput;
    const { session: passwordResetSession, user } =
      await validatePasswordResetSessionRequest();
    if (passwordResetSession === null) {
      return {
        error: "Not authenticated",
      };
    }
    if (!passwordResetSession.email_verified) {
      return {
        error: "Forbidden",
      };
    }

    const strongPassword = await verifyPasswordStrength(password);
    if (!strongPassword) {
      return {
        error: "Weak password",
      };
    }
    await invalidateUserPasswordResetSessions(passwordResetSession.id_user);
    await invalidateUserSessions(passwordResetSession.id_user);
    await updateUserPassword(passwordResetSession.id_user, password);

    const sessionToken = generateSessionToken();
    const session = await createSession(sessionToken, user.id);
    await setSessionTokenCookie(sessionToken, session.expiresAt);
    await deletePasswordResetSessionTokenCookie();
    return redirect("/");
  });
