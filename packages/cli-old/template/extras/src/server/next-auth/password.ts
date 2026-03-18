export async function saltAndHashPassword(password: string): Promise<string> {
  const bcrypt = await import("bcrypt");
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
}

export async function verifyPassword(
  plainTextPassword: string,
  hashedPassword: string
): Promise<boolean> {
  const bcrypt = await import("bcrypt");
  return bcrypt.compare(plainTextPassword, hashedPassword);
}
