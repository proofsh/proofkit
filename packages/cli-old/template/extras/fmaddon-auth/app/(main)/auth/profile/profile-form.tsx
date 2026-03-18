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

import { updateEmailAction } from "./actions";
import { updateEmailSchema } from "./schema";

export default function UpdateEmailForm({
  currentEmail,
}: {
  currentEmail: string;
}) {
  const { form, handleSubmitWithAction, action } = useHookFormAction(
    updateEmailAction,
    zodResolver(updateEmailSchema),
    { formProps: { defaultValues: { email: currentEmail } } }
  );

  return (
    <form onSubmit={handleSubmitWithAction}>
      <Stack>
        <TextInput
          label="Email"
          type="email"
          required
          withAsterisk={false}
          {...form.register("email")}
          error={form.formState.errors.email?.message}
        />

        {action.result.data?.error ? (
          <Text c="red">{action.result.data.error}</Text>
        ) : action.hasErrored ? (
          <Text c="red">An error occured</Text>
        ) : null}

        {form.formState.isDirty && (
          <Group justify="end">
            <Button type="submit" loading={action.isPending}>
              Update Email
            </Button>
          </Group>
        )}
      </Stack>
    </form>
  );
}
