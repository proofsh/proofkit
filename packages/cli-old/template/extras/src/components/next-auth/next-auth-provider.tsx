"use client";

import { Session } from "next-auth";
import { SessionProvider } from "next-auth/react";

export function NextAuthProvider({
  children,
  session,
}: {
  children: React.ReactNode;
  session: Session | null | undefined;
}) {
  return <SessionProvider session={session}>{children}</SessionProvider>;
}
