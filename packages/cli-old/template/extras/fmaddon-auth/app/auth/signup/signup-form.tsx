"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Anchor,
  Button,
  Group,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { useHookFormAction } from "@next-safe-action/adapter-react-hook-form/hooks";

import { signupAction } from "./actions";
import { signupSchema } from "./schema";

export default function SignupForm() {
  const { form, handleSubmitWithAction, action } = useHookFormAction(
    signupAction,
    zodResolver(signupSchema),
    {}
  );

  return (
    <form onSubmit={handleSubmitWithAction}>
      <Paper withBorder shadow="md" p={30} mt={30} radius="md">
        <Stack>
          <TextInput
            label="Email"
            placeholder="you@proofkit.dev"
            required
            withAsterisk={false}
            {...form.register("email")}
            error={form.formState.errors.email?.message}
          />
          <PasswordInput
            label="Password"
            placeholder="Your password"
            autoComplete="new-password"
            required
            withAsterisk={false}
            {...form.register("password")}
            error={form.formState.errors.password?.message}
          />
          <PasswordInput
            label="Confirm Password"
            placeholder="Your password (again)"
            autoComplete="new-password"
            required
            withAsterisk={false}
            {...form.register("confirmPassword")}
            error={form.formState.errors.confirmPassword?.message}
          />
          {action.result.data?.error ? (
            <Text c="red">{action.result.data.error}</Text>
          ) : action.hasErrored ? (
            <Text c="red">An error occured</Text>
          ) : null}
          <Button fullWidth type="submit" loading={action.isPending}>
            Create Account
          </Button>
        </Stack>
      </Paper>
    </form>
  );
}
