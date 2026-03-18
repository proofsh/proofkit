import "server-only";

import { fmAdapter } from "../auth";
import { saltAndHashPassword } from "../password";

type UserSignUpInput = {
  email: string;
  password: string;
};

export async function userSignUp(input: UserSignUpInput) {
  const passwordHash = await saltAndHashPassword(input.password);

  // create the user in our database
  const user = await fmAdapter.typedClients.userWithPasswordHash.create({
    fieldData: {
      email: input.email,
      passwordHash,
    },
  });

  return user;
}
