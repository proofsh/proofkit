"use client";

import { Alert, Anchor, Button, Group, Stack, Text } from "@mantine/core";
import { useAction } from "next-safe-action/hooks";

import { resendEmailVerificationAction } from "./actions";

export default function ResendButton() {
  const action = useAction(resendEmailVerificationAction);
  return (
    <Stack>
      <Group gap={4} justify="center" mt={5}>
        <Text c="dimmed" size="sm">
          {"Didn't receive the email?"}
        </Text>
        <Button
          size="compact-sm"
          variant="subtle"
          disabled={action.isPending}
          onClick={() => action.execute()}
        >
          Resend
        </Button>
      </Group>

      {action.result.data?.message && (
        <Alert ta="center">{action.result.data.message}</Alert>
      )}

      {action.result.data?.error && (
        <Alert ta="center" color="red">
          {action.result.data.error}
        </Alert>
      )}
    </Stack>
  );
}
