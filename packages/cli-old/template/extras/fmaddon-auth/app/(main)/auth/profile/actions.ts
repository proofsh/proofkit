"use server";

import {
  createEmailVerificationRequest,
  sendVerificationEmail,
  setEmailVerificationRequestCookie,
} from "@/server/auth/utils/email-verification";
import {
  verifyPasswordHash,
  verifyPasswordStrength,
} from "@/server/auth/utils/password";
import {
  createSession,
  generateSessionToken,
  getCurrentSession,
  invalidateUserSessions,
  setSessionTokenCookie,
} from "@/server/auth/utils/session";
import {
  checkEmailAvailability,
  updateUserPassword,
  validateLogin,
} from "@/server/auth/utils/user";
import { actionClient } from "@/server/safe-action";
import { redirect } from "next/navigation";

import { updateEmailSchema, updatePasswordSchema } from "./schema";

export const updateEmailAction = actionClient
  .schema(updateEmailSchema)
  .action(async ({ parsedInput }) => {
    const { session, user } = await getCurrentSession();
    if (session === null) {
      return {
        message: "Not authenticated",
      };
    }

    const { email } = parsedInput;

    const emailAvailable = await checkEmailAvailability(email);
    if (!emailAvailable) {
      return {
        error: "This email is already used",
      };
    }

    const verificationRequest = await createEmailVerificationRequest(
      user.id,
      email
    );
    await sendVerificationEmail(
      verificationRequest.email,
      verificationRequest.code
    );
    await setEmailVerificationRequestCookie(verificationRequest);
    return redirect("/auth/verify-email");
  });

export const updatePasswordAction = actionClient
  .schema(updatePasswordSchema)
  .action(async ({ parsedInput }) => {
    const { confirmNewPassword, currentPassword, newPassword } = parsedInput;

    const { session, user } = await getCurrentSession();
    if (session === null) {
      return {
        error: "Not authenticated",
      };
    }

    const strongPassword = await verifyPasswordStrength(newPassword);
    if (!strongPassword) {
      return {
        error: "Weak password",
      };
    }

    const validPassword = Boolean(
      await validateLogin(user.email, currentPassword)
    );
    if (!validPassword) {
      return {
        error: "Incorrect password",
      };
    }

    await invalidateUserSessions(user.id);
    await updateUserPassword(user.id, newPassword);

    const sessionToken = generateSessionToken();
    const newSession = await createSession(sessionToken, user.id);
    await setSessionTokenCookie(sessionToken, newSession.expiresAt);
    return {
      message: "Password updated",
    };
  });
