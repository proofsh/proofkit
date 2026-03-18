import { getCurrentSession } from "@/server/auth/utils/session";

import AuthRedirect from "./redirect";

/**
 * This server component will protect the contents of it's children from users who aren't logged in
 * It will redirect to the login page if the user is not logged in, or the verify email page if the user is logged in but hasn't verified their email
 */
export default async function Protect({
  children,
}: {
  children: React.ReactNode;
}) {
  const { session, user } = await getCurrentSession();
  if (!session) return <AuthRedirect path="/auth/login" />;
  if (!user.emailVerified) return <AuthRedirect path="/auth/verify-email" />;
  return <>{children}</>;
}
