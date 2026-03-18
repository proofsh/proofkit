"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Paper, PinInput, Stack, Text } from "@mantine/core";
import { useHookFormAction } from "@next-safe-action/adapter-react-hook-form/hooks";

import { verifyEmailAction } from "./actions";
import { verifyEmailSchema } from "./schema";

export default function VerifyEmailForm() {
  const { form, handleSubmitWithAction, action } = useHookFormAction(
    verifyEmailAction,
    zodResolver(verifyEmailSchema),
    {}
  );

  return (
    <form onSubmit={handleSubmitWithAction}>
      <Paper withBorder shadow="md" p={30} mt={30} radius="md">
        <Stack>
          <PinInput
            oneTimeCode
            length={8}
            {...form.register("code")}
            onChange={(value) => {
              form.setValue("code", value);
              if (value.length === 8) {
                handleSubmitWithAction();
              }
            }}
            error={!!form.formState.errors.code?.message}
            autoFocus
          />
          {form.formState.errors.code?.message && (
            <Text>{form.formState.errors.code.message}</Text>
          )}
          {action.result.data?.error ? (
            <Text c="red">{action.result.data.error}</Text>
          ) : action.hasErrored ? (
            <Text c="red">An error occured</Text>
          ) : null}
          <Button fullWidth type="submit" loading={action.isPending}>
            Continue
          </Button>
        </Stack>
      </Paper>
    </form>
  );
}
