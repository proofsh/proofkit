import { usersLayout } from "../db/client";
import { Tusers as _User } from "../db/users";
import { hashPassword, verifyPasswordHash } from "./password";

export type User = Partial<
  Omit<_User, "id" | "password_hash" | "recovery_code" | "emailVerified">
> & {
  id: string;
  email: string;
  emailVerified: boolean;
};

/** An internal helper function to fetch a user from the database. */
async function fetchUser(userId: string) {
  const { data } = await usersLayout.findOne({
    query: { id: `==${userId}` },
  });
  return data;
}

/** Create a new user in the database. */
export async function createUser(
  email: string,
  password: string
): Promise<User> {
  const password_hash = await hashPassword(password);
  const { recordId } = await usersLayout.create({
    fieldData: {
      email,
      password_hash,
      emailVerified: 0,
    },
  });
  const fmResult = await usersLayout.get({ recordId });
  const { fieldData } = fmResult.data[0];

  const user: User = {
    id: fieldData.id,
    email,
    emailVerified: false,
    username: "",
  };
  return user;
}

/** Update a user's password in the database. */
export async function updateUserPassword(
  userId: string,
  password: string
): Promise<void> {
  const password_hash = await hashPassword(password);
  const { recordId } = await fetchUser(userId);

  await usersLayout.update({ recordId, fieldData: { password_hash } });
}

export async function updateUserEmailAndSetEmailAsVerified(
  userId: string,
  email: string
): Promise<void> {
  const { recordId } = await fetchUser(userId);
  await usersLayout.update({
    recordId,
    fieldData: { email, emailVerified: 1 },
  });
}

export async function setUserAsEmailVerifiedIfEmailMatches(
  userId: string,
  email: string
): Promise<boolean> {
  try {
    const {
      data: { recordId },
    } = await usersLayout.findOne({
      query: { id: `==${userId}`, email: `==${email}` },
    });
    await usersLayout.update({ recordId, fieldData: { emailVerified: 1 } });
    return true;
  } catch (error) {
    return false;
  }
}

export async function getUserFromEmail(email: string): Promise<User | null> {
  const fmResult = await usersLayout.maybeFindFirst({
    query: { email: `==${email}` },
  });
  if (fmResult === null) return null;

  const {
    data: { fieldData },
  } = fmResult;

  const user: User = {
    id: fieldData.id,
    email: fieldData.email,
    emailVerified: Boolean(fieldData.emailVerified),
    username: fieldData.username,
  };
  return user;
}

/**
 * Validate a user's email/password combination.
 * @param email - The user's email.
 * @param password - The user's password.
 * @returns The user, or null if the login is invalid.
 */
export async function validateLogin(
  email: string,
  password: string
): Promise<User | null> {
  try {
    const {
      data: { fieldData },
    } = await usersLayout.findOne({
      query: { email: `==${email}` },
    });

    const validPassword = await verifyPasswordHash(
      fieldData.password_hash,
      password
    );
    if (!validPassword) {
      return null;
    }
    const user: User = {
      id: fieldData.id,
      email: fieldData.email,
      emailVerified: Boolean(fieldData.emailVerified),
      username: fieldData.username,
    };
    return user;
  } catch (error) {
    return null;
  }
}

export async function checkEmailAvailability(email: string): Promise<boolean> {
  const { data } = await usersLayout.find({
    query: { email: `==${email}` },
    ignoreEmptyResult: true,
  });
  return data.length === 0;
}
