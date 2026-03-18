import { env } from "@/config/env";
import { validatePasswordResetSessionRequest } from "@/server/auth/utils/password-reset";
import { Alert, Anchor, Container, Text, Title } from "@mantine/core";
import { redirect } from "next/navigation";

import ResetPasswordForm from "./reset-password-form";

export default async function Page() {
  const { session, user } = await validatePasswordResetSessionRequest();
  if (session === null) {
    return redirect("/auth/forgot-password");
  }
  if (!session.email_verified) {
    return redirect("/auth/reset-password/verify-email");
  }

  return (
    <Container size={420} my={40}>
      <Title ta="center">Reset Password</Title>
      <Text c="dimmed" size="sm" ta="center" mt={5}>
        Enter your new password.
      </Text>

      <ResetPasswordForm />

      <Text ta="center" mt={10}>
        <Anchor size="sm" component="a" href="/auth/login" c="dimmed">
          Back to login
        </Anchor>
      </Text>
    </Container>
  );
}
