import { encodeBase32UpperCaseNoPadding } from "@oslojs/encoding";

export function generateRandomOTP(): string {
  const bytes = new Uint8Array(5);
  crypto.getRandomValues(bytes);
  const code = encodeBase32UpperCaseNoPadding(bytes);
  return code;
}

export const options = {
  password: {
    minLength: 8,
    maxLength: 255,
    checkCompromised: false, // set to true to prevent known compromised passwords on signup
  },
};
