import { encodeBase32 } from "@oslojs/encoding";
import { cookies } from "next/headers";

import { emailVerificationLayout } from "../db/client";
import { TemailVerification } from "../db/emailVerification";
import { sendEmail } from "../email";
import { generateRandomOTP } from "./index";
import { getCurrentSession } from "./session";

/**
 * An Email Verification Request is a record in the email verification table that is created when a user requests to change their email address. It's like a temporary session which can expire if the user doesn't verify the new email address within a certain amount of time.
 */

/**
 * Get a user's email verification request.
 * @param userId - The ID of the user.
 * @param id - The ID of the email verification request.
 * @returns The email verification request, or null if it doesn't exist.
 */
export async function getUserEmailVerificationRequest(
  userId: string,
  id: string
): Promise<TemailVerification | null> {
  const result = await emailVerificationLayout.maybeFindFirst({
    query: { id_user: `==${userId}`, id: `==${id}` },
  });
  return result?.data.fieldData ?? null;
}

/**
 * Create a new email verification request for a user.
 * @param id_user - The ID of the user.
 * @param email - The email address to verify.
 * @returns The email verification request.
 */
export async function createEmailVerificationRequest(
  id_user: string,
  email: string
): Promise<TemailVerification> {
  deleteUserEmailVerificationRequest(id_user);
  const idBytes = new Uint8Array(20);
  crypto.getRandomValues(idBytes);
  const id = encodeBase32(idBytes).toLowerCase();

  const code = generateRandomOTP();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 10);

  const request: TemailVerification = {
    id,
    code,
    expires_at: Math.floor(expiresAt.getTime() / 1000),
    email,
    id_user,
  };

  await emailVerificationLayout.create({
    fieldData: request,
  });

  return request;
}

/**
 * Delete a user's email verification request.
 * @param id_user - The ID of the user.
 */
export async function deleteUserEmailVerificationRequest(
  id_user: string
): Promise<void> {
  const result = await emailVerificationLayout.maybeFindFirst({
    query: { id_user: `==${id_user}` },
  });
  if (result === null) return;

  await emailVerificationLayout.delete({ recordId: result.data.recordId });
}

/**
 * Send a verification email to a user.
 * @param email - The email address to send the verification email to.
 * @param code - The verification code to send to the user.
 */
export async function sendVerificationEmail(
  email: string,
  code: string
): Promise<void> {
  await sendEmail({ to: email, code, type: "verification" });
}

/**
 * Set a cookie for a user's email verification request.
 * @param request - The email verification request.
 */
export async function setEmailVerificationRequestCookie(
  request: TemailVerification
): Promise<void> {
  (await cookies()).set("email_verification", request.id, {
    httpOnly: true,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: request.expires_at
      ? new Date(request.expires_at * 1000)
      : new Date(Date.now() + 1000 * 60 * 60),
  });
}

/**
 * Delete the cookie for a user's email verification request.
 */
export async function deleteEmailVerificationRequestCookie(): Promise<void> {
  (await cookies()).set("email_verification", "", {
    httpOnly: true,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
  });
}

/**
 * Get a user's email verification request from the cookie.
 * @returns The email verification request, or null if it doesn't exist.
 */
export async function getUserEmailVerificationRequestFromRequest(): Promise<TemailVerification | null> {
  const { user } = await getCurrentSession();
  if (user === null) {
    return null;
  }
  const id = (await cookies()).get("email_verification")?.value ?? null;
  if (id === null) {
    return null;
  }
  const request = await getUserEmailVerificationRequest(user.id, id);

  return request;
}
