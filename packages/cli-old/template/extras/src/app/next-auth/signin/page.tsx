import { providerMap, signIn } from "@/server/auth";
import {
  Button,
  Card,
  Divider,
  PasswordInput,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { AuthError } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function SignInPage(props: {
  searchParams: Promise<{ callbackUrl: string | undefined }>;
}) {
  const searchParams = await props.searchParams;
  return (
    <Stack>
      <form
        action={async (formData) => {
          "use server";
          try {
            await signIn("credentials", formData);
          } catch (error) {
            if (error instanceof AuthError) {
              return redirect(`/auth/signin?error=${error.type}`);
            }
            throw error;
          }
        }}
      >
        <Stack>
          <TextInput type="email" name="email" id="email" label="Email" />
          <PasswordInput name="password" id="password" label="Password" />

          <Button type="submit">Sign in</Button>
        </Stack>
      </form>
      {providerMap.length > 0 && (
        <>
          <Divider label="Or" />
          {Object.values(providerMap).map((provider) => (
            <form
              key={provider.id}
              action={async () => {
                "use server";
                try {
                  await signIn(provider.id, {
                    redirectTo: searchParams.callbackUrl ?? "",
                  });
                } catch (error) {
                  // Signin can fail for a number of reasons, such as the user
                  // not existing, or the user not having the correct role.
                  // In some cases, you may want to redirect to a custom error
                  if (error instanceof AuthError) {
                    return redirect(`/auth/signin?error=${error.type}`);
                  }

                  // Otherwise if a redirects happens Next.js can handle it
                  // so you can just re-thrown the error and let Next.js handle it.
                  // Docs:
                  // https://nextjs.org/docs/app/api-reference/functions/redirect#server-component
                  throw error;
                }
              }}
            >
              <Button type="submit" variant="white">
                <span>Sign in with {provider.name}</span>
              </Button>
            </form>
          ))}
        </>
      )}

      <Text size="sm" c="dimmed">
        {"Don't have an account? "}
        <Link href="/auth/signup">Sign up</Link>
      </Text>
    </Stack>
  );
}
