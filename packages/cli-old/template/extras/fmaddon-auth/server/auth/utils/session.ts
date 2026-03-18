import { sha256 } from "@oslojs/crypto/sha2";
import {
  encodeBase32LowerCaseNoPadding,
  encodeHexLowerCase,
} from "@oslojs/encoding";
import { cookies } from "next/headers";
import { cache } from "react";

import { sessionsLayout } from "../db/client";
import { Tsessions as _Session } from "../db/sessions";
import type { User } from "./user";

/**
 * Generate a random session token with sufficient entropy for a session ID.
 * @returns The session token.
 */
export function generateSessionToken(): string {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  const token = encodeBase32LowerCaseNoPadding(bytes);
  return token;
}

/**
 * Create a new session for a user and save it to the database.
 * @param token - The session token.
 * @param userId - The ID of the user.
 * @returns The session.
 */
export async function createSession(
  token: string,
  userId: string
): Promise<Session> {
  const sessionId = encodeHexLowerCase(sha256(new TextEncoder().encode(token)));
  const session: Session = {
    id: sessionId,
    id_user: userId,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
  };

  // create session in DB
  await sessionsLayout.create({
    fieldData: {
      id: session.id,
      id_user: session.id_user,
      expiresAt: Math.floor(session.expiresAt.getTime() / 1000),
    },
  });

  return session;
}

/**
 * Invalidate a session by deleting it from the database.
 * @param sessionId - The ID of the session to invalidate.
 */
export async function invalidateSession(sessionId: string): Promise<void> {
  const fmResult = await sessionsLayout.maybeFindFirst({
    query: { id: `==${sessionId}` },
  });
  if (fmResult === null) {
    return;
  }
  await sessionsLayout.delete({ recordId: fmResult.data.recordId });
}

/**
 * Validate a session token to make sure it still exists in the database and hasn't expired.
 * @param token - The session token.
 * @returns The session, or null if it doesn't exist.
 */
export async function validateSessionToken(
  token: string
): Promise<SessionValidationResult> {
  const sessionId = encodeHexLowerCase(sha256(new TextEncoder().encode(token)));

  const result = await sessionsLayout.maybeFindFirst({
    query: { id: `==${sessionId}` },
  });
  if (result === null) {
    return { session: null, user: null };
  }

  const fmResult = result.data.fieldData;
  const recordId = result.data.recordId;
  const session: Session = {
    id: fmResult.id,
    id_user: fmResult.id_user,
    expiresAt: fmResult.expiresAt
      ? new Date(fmResult.expiresAt * 1000)
      : new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
  };

  const user: User = {
    id: session.id_user,
    email: fmResult["proofkit_auth_users::email"],
    emailVerified: Boolean(fmResult["proofkit_auth_users::emailVerified"]),
    username: fmResult["proofkit_auth_users::username"],
  };

  // delete session if it has expired
  if (Date.now() >= session.expiresAt.getTime()) {
    await sessionsLayout.delete({ recordId });
    return { session: null, user: null };
  }

  // extend session if it's going to expire soon
  // You may want to customize this logic to better suit your app's requirements
  if (Date.now() >= session.expiresAt.getTime() - 1000 * 60 * 60 * 24 * 15) {
    session.expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
    await sessionsLayout.update({
      recordId,
      fieldData: {
        expiresAt: Math.floor(session.expiresAt.getTime() / 1000),
      },
    });
  }

  return { session, user };
}

/**
 * Get the current session from the cookie.
 * Wrapped in a React cache to avoid calling the database more than once per request
 * This function can be used in server components, server actions, and route handlers (but importantly not middleware).
 * @returns The session, or null if it doesn't exist.
 */
export const getCurrentSession = cache(
  async (): Promise<SessionValidationResult> => {
    const token = (await cookies()).get("session")?.value ?? null;
    if (token === null) {
      return { session: null, user: null };
    }
    const result = await validateSessionToken(token);
    return result;
  }
);

/**
 * Invalidate all sessions for a user by deleting them from the database.
 * @param userId - The ID of the user.
 */
export async function invalidateUserSessions(userId: string): Promise<void> {
  const sessions = await sessionsLayout.findAll({
    query: { id_user: `==${userId}` },
  });
  for (const session of sessions) {
    await sessionsLayout.delete({ recordId: session.recordId });
  }
}

/**
 * Set a cookie for a session.
 * @param token - The session token.
 * @param expiresAt - The expiration date of the session.
 */
export async function setSessionTokenCookie(
  token: string,
  expiresAt: Date
): Promise<void> {
  (await cookies()).set("session", token, {
    httpOnly: true,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
  });
}

/**
 * Delete the session cookie.
 */
export async function deleteSessionTokenCookie(): Promise<void> {
  (await cookies()).set("session", "", {
    httpOnly: true,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
  });
}

export interface Session {
  id: string;
  expiresAt: Date;
  id_user: string;
}

type SessionValidationResult =
  | { session: Session; user: User }
  | { session: null; user: null };
