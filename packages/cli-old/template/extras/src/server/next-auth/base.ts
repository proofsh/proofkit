



import { env } from "@/config/env";
import { OttoAdapter } from "@proofkit/fmdapi";
import NextAuth, { type DefaultSession } from "next-auth";
import { FilemakerAdapter } from "next-auth-adapter-filemaker";
import { type Provider } from "next-auth/providers";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod/v4";

import { verifyPassword } from "./password";

export const fmAdapter = FilemakerAdapter({
  adapter: new OttoAdapter({
    auth: { apiKey: env.OTTO_API_KEY },
    db: env.FM_DATABASE,
    server: env.FM_SERVER,
  }),
});

/**
 * Module augmentation for `next-auth` types. Alldows us to add custom properties to the `session`
 * object and keep type safety.
 *
 * @see https://next-auth.js.org/getting-started/typescript#module-augmentation
 */
declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      // ...other properties
      // role: UserRole;
    } & DefaultSession["user"];
  }

  // interface User {
  //   // ...other properties
  //   // role: UserRole;
  // }
}

const signInSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const providers: Provider[] = [
  Credentials({
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    authorize: async (credentials) => {
      const parsed = signInSchema.safeParse(credentials);
      if (!parsed.success) {
        return null;
      }

      const { email, password } = parsed.data;

      try {
        // logic to verify if the user exists with the password hash
        const userResponse =
          await fmAdapter.typedClients.userWithPasswordHash.findOne({
            query: { email: `==${email.replace("@", "\\@")}` },
          });
        const { passwordHash, ...userData } = userResponse.data.fieldData;
        const isValid = await verifyPassword(password, passwordHash);
        if (!isValid) return null;

        return userData;
      } catch (error) {
        console.log("error", error);
        throw new Error("User not found.");
      }
    },
  }),
];

export const providerMap = providers
  .map((provider) => {
    if (typeof provider === "function") {
      const providerData = provider();
      return { id: providerData.id, name: providerData.name };
    } else {
      return { id: provider.id, name: provider.name };
    }
  })
  .filter((provider) => provider.id !== "credentials");

export const { auth, handlers, signIn, signOut } = NextAuth({
  pages: {
    signIn: "/auth/signin",
    newUser: "/auth/signup",
    error: "/auth/signin",
  },
  callbacks: {
    session: ({ session, token }) => ({
      ...session,
      user: {
        ...session.user,
        id: token.sub,
      },
    }),
  },
  adapter: fmAdapter.Adapter,
  session: { strategy: "jwt" },
  providers,
});
