import { sha256 } from "@oslojs/crypto/sha2";
import { encodeHexLowerCase } from "@oslojs/encoding";
import { cookies } from "next/headers";

import { passwordResetLayout } from "../db/client";
import { TpasswordReset } from "../db/passwordReset";
import { sendEmail } from "../email";
import { generateRandomOTP } from "./index";
import type { User } from "./user";

type PasswordResetSession = Omit<
  TpasswordReset,
  | "proofkit_auth_users::email"
  | "proofkit_auth_users::emailVerified"
  | "proofkit_auth_users::username"
>;

export async function createPasswordResetSession(
  token: string,
  id_user: string,
  email: string
): Promise<PasswordResetSession> {
  const sessionId = encodeHexLowerCase(sha256(new TextEncoder().encode(token)));
  const session: PasswordResetSession = {
    id: sessionId,
    id_user,
    email,
    expires_at: Math.floor(
      new Date(Date.now() + 1000 * 60 * 10).getTime() / 1000
    ),
    code: generateRandomOTP(),
    email_verified: 0,
  };
  await passwordResetLayout.create({ fieldData: session });

  return session;
}

/**
 * Validate a password reset session token.
 * @param token - The password reset session token.
 * @returns The password reset session, or null if it doesn't exist.
 */
export async function validatePasswordResetSessionToken(
  token: string
): Promise<PasswordResetSessionValidationResult> {
  const sessionId = encodeHexLowerCase(sha256(new TextEncoder().encode(token)));
  const row = await passwordResetLayout.maybeFindFirst({
    query: { id: `==${sessionId}` },
  });

  if (row === null) {
    return { session: null, user: null };
  }
  const session: PasswordResetSession = {
    id: row.data.fieldData.id,
    id_user: row.data.fieldData.id_user,
    email: row.data.fieldData.email,
    code: row.data.fieldData.code,
    expires_at: row.data.fieldData.expires_at,
    email_verified: row.data.fieldData.email_verified,
  };

  const user: User = {
    id: row.data.fieldData.id_user,
    email: row.data.fieldData["proofkit_auth_users::email"],
    username: row.data.fieldData["proofkit_auth_users::username"],
    emailVerified: Boolean(
      row.data.fieldData["proofkit_auth_users::emailVerified"]
    ),
  };
  if (session.expires_at && Date.now() >= session.expires_at * 1000) {
    await passwordResetLayout.delete({ recordId: row.data.recordId });
    return { session: null, user: null };
  }
  return { session, user };
}

async function fetchPasswordResetSession(sessionId: string) {
  return (
    await passwordResetLayout.findOne({ query: { id: `==${sessionId}` } })
  ).data;
}

export async function setPasswordResetSessionAsEmailVerified(
  sessionId: string
): Promise<void> {
  const { recordId } = await fetchPasswordResetSession(sessionId);
  await passwordResetLayout.update({
    recordId,
    fieldData: { email_verified: 1 },
  });
}

export async function invalidateUserPasswordResetSessions(
  userId: string
): Promise<void> {
  const sessions = await passwordResetLayout.find({
    query: { id_user: `==${userId}` },
    ignoreEmptyResult: true,
  });
  for (const session of sessions.data) {
    await passwordResetLayout.delete({ recordId: session.recordId });
  }
}

export async function validatePasswordResetSessionRequest(): Promise<PasswordResetSessionValidationResult> {
  const token = (await cookies()).get("password_reset_session")?.value ?? null;
  if (token === null) {
    return { session: null, user: null };
  }
  const result = await validatePasswordResetSessionToken(token);
  if (result.session === null) {
    deletePasswordResetSessionTokenCookie();
  }
  return result;
}

export async function setPasswordResetSessionTokenCookie(
  token: string,
  expiresAt: number | null
): Promise<void> {
  (await cookies()).set("password_reset_session", token, {
    expires: expiresAt
      ? new Date(expiresAt * 1000)
      : new Date(Date.now() + 60 * 60 * 1000),
    sameSite: "lax",
    httpOnly: true,
    path: "/",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function deletePasswordResetSessionTokenCookie(): Promise<void> {
  (await cookies()).set("password_reset_session", "", {
    maxAge: 0,
    sameSite: "lax",
    httpOnly: true,
    path: "/",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function sendPasswordResetEmail(
  email: string,
  code: string
): Promise<void> {
  await sendEmail({ to: email, code, type: "password-reset" });
}

export type PasswordResetSessionValidationResult =
  | { session: PasswordResetSession; user: User }
  | { session: null; user: null };
