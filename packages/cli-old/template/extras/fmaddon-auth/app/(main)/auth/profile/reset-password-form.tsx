"use client";

import { showSuccessNotification } from "@/utils/notification-helpers";
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
import { useState } from "react";

import { updatePasswordAction } from "./actions";
import { updatePasswordSchema } from "./schema";

export default function UpdatePasswordForm() {
  const [showForm, setShowForm] = useState(false);
  const { form, handleSubmitWithAction, action } = useHookFormAction(
    updatePasswordAction,
    zodResolver(updatePasswordSchema),
    {
      formProps: { defaultValues: {} },
      actionProps: {
        onSuccess: ({ data }) => {
          if (data?.message) {
            showSuccessNotification(data.message);
            setShowForm(false);
          }
        },
      },
    }
  );

  if (!showForm) {
    return (
      <Group>
        <TextInput
          variant="subtle"
          label="Password"
          style={{ flexGrow: 1 }}
          value="••••••••"
          readOnly
        />
        <Button
          size="sm"
          variant="subtle"
          color="gray"
          onClick={() => setShowForm(true)}
        >
          Update
        </Button>
      </Group>
    );
  }

  return (
    <form onSubmit={handleSubmitWithAction}>
      <Stack>
        <PasswordInput
          label="Current Password"
          type="password"
          autoComplete="current-password"
          required
          withAsterisk={false}
          {...form.register("currentPassword")}
          error={form.formState.errors.currentPassword?.message}
        />

        <PasswordInput
          label="New Password"
          type="password"
          required
          withAsterisk={false}
          {...form.register("newPassword")}
          error={form.formState.errors.newPassword?.message}
          autoComplete="new-password"
        />

        <PasswordInput
          label="Confirm New Password"
          type="password"
          required
          autoComplete="new-password"
          withAsterisk={false}
          {...form.register("confirmNewPassword")}
        />

        {action.result.data?.error ? (
          <Text c="red">{action.result.data.error}</Text>
        ) : action.hasErrored ? (
          <Text c="red">An error occured</Text>
        ) : null}

        <Group justify="end">
          <Button
            type="submit"
            variant="light"
            disabled={!form.formState.isDirty}
            loading={action.isPending}
          >
            Update Password
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
