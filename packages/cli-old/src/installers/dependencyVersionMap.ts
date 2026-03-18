import { getNodeMajorVersion } from "~/utils/getProofKitVersion.js";
import { getProofkitReleaseTag } from "~/utils/proofkitReleaseChannel.js";

const proofkitReleaseTag = getProofkitReleaseTag();

/*
 * This maps the necessary packages to a version.
 * This improves performance significantly over fetching it from the npm registry.
 */
export const dependencyVersionMap = {
  // Resolve to "latest" or "beta" based on current changeset state / versions.
  "@proofkit/fmdapi": proofkitReleaseTag,
  "@proofkit/webviewer": proofkitReleaseTag,
  "@proofkit/cli": proofkitReleaseTag,
  "@proofkit/typegen": proofkitReleaseTag,
  "@proofkit/better-auth": proofkitReleaseTag,

  // NextAuth.js
  "next-auth": "beta",
  "next-auth-adapter-filemaker": "beta",

  "@auth/prisma-adapter": "^1.6.0",
  "@auth/drizzle-adapter": "^1.1.0",

  // Prisma
  prisma: "^5.14.0",
  "@prisma/client": "^5.14.0",
  "@prisma/adapter-planetscale": "^5.14.0",

  // Drizzle
  "drizzle-orm": "^0.30.10",
  "drizzle-kit": "^0.21.4",
  mysql2: "^3.9.7",
  "@planetscale/database": "^1.18.0",
  postgres: "^3.4.4",
  "@libsql/client": "^0.6.0",

  // TailwindCSS
  tailwindcss: "^4.1.10",
  postcss: "^8.4.41",
  "@tailwindcss/postcss": "^4.1.10",
  "@tailwindcss/vite": "^4.2.1",
  "class-variance-authority": "^0.7.1",
  clsx: "^2.1.1",
  "tailwind-merge": "^3.5.0",
  "tw-animate-css": "^1.4.0",

  // tRPC
  "@trpc/client": "^11.0.0-rc.446",
  "@trpc/server": "^11.0.0-rc.446",
  "@trpc/react-query": "^11.0.0-rc.446",
  "@trpc/next": "^11.0.0-rc.446",
  superjson: "^2.2.1",
  "server-only": "^0.0.1",

  // Clerk
  "@clerk/nextjs": "^6.3.1",
  "@clerk/themes": "^2.1.33",

  // Tanstack Query
  "@tanstack/react-query": "^5.59.0",
  "@tanstack/react-query-devtools": "^5.59.0",

  // ProofKit Auth
  "@node-rs/argon2": "^2.0.2",
  "@oslojs/binary": "^1.0.0",
  "@oslojs/crypto": "^1.0.1",
  "@oslojs/encoding": "^1.1.0",
  "js-cookie": "^3.0.5",
  "@types/js-cookie": "^3.0.6",

  // React Email
  "@react-email/components": "^0.5.0",
  "@react-email/render": "1.2.0",
  "@react-email/preview-server": "^4.2.8",
  "@plunk/node": "^3.0.3",
  "react-email": "^4.2.8",
  resend: "^4.0.0",
  "@sendgrid/mail": "^8.1.4",

  // Node
  "@types/node": `^${getNodeMajorVersion()}`,

  // Radix (for shadcn/ui)
  "@radix-ui/react-slot": "^1.2.3",

  // Icons (for shadcn/ui)
  "lucide-react": "^0.577.0",

  // better-auth
  "better-auth": "^1.3.4",
  "@daveyplate/better-auth-ui": "^2.1.3",

  // Mantine UI
  "@mantine/core": "^7.15.0",
  "@mantine/dates": "^7.15.0",
  "@mantine/hooks": "^7.15.0",
  "@mantine/modals": "^7.15.0",
  "@mantine/notifications": "^7.15.0",
  "mantine-react-table": "^2.0.0",

  // Theme utilities
  "next-themes": "^0.4.6",

  // Zod
  zod: "^4",
} as const;
export type AvailableDependencies = keyof typeof dependencyVersionMap;
