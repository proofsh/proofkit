"use server";

import {
  createEmailVerificationRequest,
  deleteEmailVerificationRequestCookie,
  deleteUserEmailVerificationRequest,
  getUserEmailVerificationRequestFromRequest,
  sendVerificationEmail,
  setEmailVerificationRequestCookie,
} from "@/server/auth/utils/email-verification";
import { invalidateUserPasswordResetSessions } from "@/server/auth/utils/password-reset";
import { getRedirectCookie } from "@/server/auth/utils/redirect";
import { getCurrentSession } from "@/server/auth/utils/session";
import { updateUserEmailAndSetEmailAsVerified } from "@/server/auth/utils/user";
import { actionClient } from "@/server/safe-action";
import { redirect } from "next/navigation";

import { emailVerificationSchema } from "./schema";

export const verifyEmailAction = actionClient
  .schema(emailVerificationSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { session, user } = await getCurrentSession();
    if (session === null) {
      return {
        error: "Not authenticated",
      };
    }

    let verificationRequest =
      await getUserEmailVerificationRequestFromRequest();
    if (verificationRequest === null) {
      return {
        error: "Not authenticated",
      };
    }
    const { code } = parsedInput;
    if (verificationRequest.expires_at === null) {
      return {
        error: "Verification code expired",
      };
    }

    if (Date.now() >= verificationRequest.expires_at * 1000) {
      verificationRequest = await createEmailVerificationRequest(
        verificationRequest.id_user,
        verificationRequest.email
      );
      await sendVerificationEmail(
        verificationRequest.email,
        verificationRequest.code
      );
      return {
        error:
          "The verification code was expired. We sent another code to your inbox.",
      };
    }
    if (verificationRequest.code !== code) {
      return {
        error: "Incorrect code.",
      };
    }
    await deleteUserEmailVerificationRequest(user.id);
    await invalidateUserPasswordResetSessions(user.id);
    await updateUserEmailAndSetEmailAsVerified(
      user.id,
      verificationRequest.email
    );
    await deleteEmailVerificationRequestCookie();

    const redirectTo = await getRedirectCookie();
    return redirect(redirectTo);
  });

export const resendEmailVerificationAction = actionClient.action(async () => {
  const { session, user } = await getCurrentSession();
  if (session === null) {
    return {
      error: "Not authenticated",
    };
  }

  let verificationRequest = await getUserEmailVerificationRequestFromRequest();
  if (verificationRequest === null) {
    if (user.emailVerified) {
      return {
        error: "Forbidden",
      };
    }

    verificationRequest = await createEmailVerificationRequest(
      user.id,
      user.email
    );
  } else {
    verificationRequest = await createEmailVerificationRequest(
      user.id,
      verificationRequest.email
    );
  }
  await sendVerificationEmail(
    verificationRequest.email,
    verificationRequest.code
  );
  await setEmailVerificationRequestCookie(verificationRequest);
  return {
    message: "A new code was sent to your inbox.",
  };
});
