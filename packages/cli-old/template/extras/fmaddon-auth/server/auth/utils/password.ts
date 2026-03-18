import { options } from ".";
import { hash, verify } from "@node-rs/argon2";
import { sha1 } from "@oslojs/crypto/sha1";
import { encodeHexLowerCase } from "@oslojs/encoding";

/**
 * Hash a password using Argon2.
 * @param password - The password to hash.
 * @returns The hashed password.
 */
export async function hashPassword(password: string): Promise<string> {
  return await hash(password, {
    memoryCost: 19456,
    timeCost: 2,
    outputLen: 32,
    parallelism: 1,
  });
}

/**
 * Verify that a password matches a hash.
 * @param hash - The hash to verify against.
 * @param password - The password to verify.
 * @returns True if the password matches the hash, false otherwise.
 */
export async function verifyPasswordHash(
  hash: string,
  password: string
): Promise<boolean> {
  return await verify(hash, password);
}

/**
 * Verify that a password is strong enough.
 * @param password - The password to verify.
 * @returns True if the password is strong enough, false otherwise.
 */
export async function verifyPasswordStrength(
  password: string
): Promise<boolean> {
  if (
    password.length < options.password.minLength ||
    password.length > options.password.maxLength
  ) {
    return false;
  }

  if (options.password.checkCompromised) {
    const hash = encodeHexLowerCase(sha1(new TextEncoder().encode(password)));
    const hashPrefix = hash.slice(0, 5);
    const response = await fetch(
      `https://api.pwnedpasswords.com/range/${hashPrefix}`
    );
    const data = await response.text();
    const items = data.split("\n");
    for (const item of items) {
      const hashSuffix = item.slice(0, 35).toLowerCase();
      if (hash === hashPrefix + hashSuffix) {
        console.log(
          "User's new password was found in list of compromised passwords, reject"
        );
        return false;
      }
    }
  }
  return true;
}
