import { Anchor, Container, Text, Title } from "@mantine/core";

import ForgotForm from "./forgot-form";

export default async function Page() {
  return (
    <Container size={420} my={40}>
      <Title ta="center">Forgot Password</Title>
      <Text c="dimmed" size="sm" ta="center" mt={5}>
        Enter your email for a link to reset your password.
      </Text>

      <ForgotForm />

      <Text ta="center" mt={10}>
        <Anchor size="sm" component="a" href="/auth/login" c="dimmed">
          Back to login
        </Anchor>
      </Text>
    </Container>
  );
}
