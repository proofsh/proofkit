"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Button,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { useHookFormAction } from "@next-safe-action/adapter-react-hook-form/hooks";

import { resetPasswordAction } from "./actions";
import { resetPasswordSchema } from "./schema";

export default function ForgotForm() {
  const { form, handleSubmitWithAction, action } = useHookFormAction(
    resetPasswordAction,
    zodResolver(resetPasswordSchema),
    {}
  );

  return (
    <form onSubmit={handleSubmitWithAction}>
      <Paper withBorder shadow="md" p={30} mt={30} radius="md">
        <Stack>
          <PasswordInput
            autoFocus
            label="Password"
            required
            withAsterisk={false}
            {...form.register("password")}
            error={form.formState.errors.password?.message}
            autoComplete="new-password"
          />

          <PasswordInput
            label="Confirm Password"
            required
            withAsterisk={false}
            {...form.register("confirmPassword")}
            error={form.formState.errors.confirmPassword?.message}
            autoComplete="new-password"
          />

          {action.result.data?.error ? (
            <Text c="red">{action.result.data.error}</Text>
          ) : action.hasErrored ? (
            <Text c="red">An error occured</Text>
          ) : null}

          <Button fullWidth type="submit" loading={action.isPending}>
            Reset Password
          </Button>
        </Stack>
      </Paper>
    </form>
  );
}
