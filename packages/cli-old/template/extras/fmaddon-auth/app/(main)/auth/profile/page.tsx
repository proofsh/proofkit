import { getCurrentSession } from "@/server/auth/utils/session";
import { Anchor, Container, Paper, Stack, Text, Title } from "@mantine/core";
import { redirect } from "next/navigation";

import UpdateEmailForm from "./profile-form";
import UpdatePasswordForm from "./reset-password-form";

// import EmailVerificationForm from "./email-verification-form";

export default async function Page() {
  const { user } = await getCurrentSession();

  if (user === null) {
    return redirect("/auth/login");
  }

  return (
    <Container size={420} my={40}>
      <Title ta="center">Profile Details</Title>

      <Paper withBorder shadow="md" p={30} mt={30} radius="md">
        <Stack>
          <UpdateEmailForm currentEmail={user.email} />
          <UpdatePasswordForm />
        </Stack>
      </Paper>
    </Container>
  );
}
