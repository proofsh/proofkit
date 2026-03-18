import { createCipheriv, createDecipheriv } from "crypto";
import { DynamicBuffer } from "@oslojs/binary";
import { decodeBase64 } from "@oslojs/encoding";

const key = decodeBase64(process.env.ENCRYPTION_KEY ?? "");

export function encrypt(data: Uint8Array): Uint8Array {
  const iv = new Uint8Array(16);
  crypto.getRandomValues(iv);
  const cipher = createCipheriv("aes-128-gcm", key, iv);
  const encrypted = new DynamicBuffer(0);
  encrypted.write(iv);
  encrypted.write(cipher.update(data));
  encrypted.write(cipher.final());
  encrypted.write(cipher.getAuthTag());
  return encrypted.bytes();
}

/**
 * Encrypt a string for storage in the database.
 * Here we're returning a base64 encoded string since FileMaker doesn't store binary data.
 * @param data - The string to encrypt.
 * @returns The encrypted string.
 */
export function encryptString(data: string): string {
  const encrypted = encrypt(new TextEncoder().encode(data));
  return Buffer.from(encrypted).toString("base64");
}

/**
 * Decrypt a string stored in the database.
 * @param encrypted - The encrypted string to decrypt.
 * @returns The decrypted string.
 */
export function decrypt(encrypted: Uint8Array): Uint8Array {
  if (encrypted.byteLength < 33) {
    throw new Error("Invalid data");
  }
  const decipher = createDecipheriv("aes-128-gcm", key, encrypted.slice(0, 16));
  decipher.setAuthTag(encrypted.slice(encrypted.byteLength - 16));
  const decrypted = new DynamicBuffer(0);
  decrypted.write(
    decipher.update(encrypted.slice(16, encrypted.byteLength - 16))
  );
  decrypted.write(decipher.final());
  return decrypted.bytes();
}

export function decryptToString(data: Uint8Array): string {
  return new TextDecoder().decode(decrypt(data));
}
