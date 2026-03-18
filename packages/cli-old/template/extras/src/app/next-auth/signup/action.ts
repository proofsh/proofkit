"use server";

import { signIn } from "@/server/auth";
import { userSignUp } from "@/server/data/users";
import { actionClient } from "@/server/safe-action";

import { signUpSchema } from "./validation";

export const signUpAction = actionClient
  .schema(signUpSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { email, password } = parsedInput;

    await userSignUp({ email, password });

    await signIn("credentials", {
      email,
      password,
    });

    return {
      success: true,
    };
  });
