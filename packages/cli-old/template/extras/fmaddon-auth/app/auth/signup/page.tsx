import { getCurrentSession } from "@/server/auth/utils/session";
import { Anchor, Container, Text, Title } from "@mantine/core";
import { redirect } from "next/navigation";

import SignupForm from "./signup-form";

export default async function Page() {
  const { session } = await getCurrentSession();

  if (session !== null) {
    return redirect("/");
  }

  return (
    <Container size={420} my={40}>
      <Title ta="center">Create account</Title>
      <Text c="dimmed" size="sm" ta="center" mt={5}>
        Already have an account?{" "}
        <Anchor size="sm" component="a" href="/auth/login">
          Sign in
        </Anchor>
      </Text>

      <SignupForm />
    </Container>
  );
}
