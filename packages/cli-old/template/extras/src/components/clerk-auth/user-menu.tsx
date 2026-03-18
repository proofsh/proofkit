"use client";

import { useClerk, UserButton, useUser } from "@clerk/nextjs";
import { Button } from "@mantine/core";
import { useRouter } from "next/navigation";

export default function UserMenu() {
  const { isSignedIn, isLoaded } = useUser();
  const { buildSignInUrl } = useClerk();
  const router = useRouter();

  if (!isLoaded) return null;

  if (!isSignedIn)
    return (
      <Button variant="subtle" onClick={() => router.push(buildSignInUrl())}>
        Sign In
      </Button>
    );

  if (isSignedIn) return <UserButton />;

  return null;
}
