"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import { Menu } from "@mantine/core";
import { useRouter } from "next/navigation";
import React from "react";

/**
 * Shown in the mobile header menu
 */
export default function UserMenuMobile() {
  const { isSignedIn, isLoaded, user } = useUser();
  const { signOut, buildSignInUrl } = useClerk();
  const router = useRouter();

  if (!isLoaded) return null;

  if (!isSignedIn)
    return (
      <>
        <Menu.Divider />
        <Menu.Item onClick={() => router.push(buildSignInUrl())}>
          Sign In
        </Menu.Item>
      </>
    );

  if (isSignedIn)
    return (
      <>
        <Menu.Divider />
        <Menu.Item>{user.primaryEmailAddress?.emailAddress}</Menu.Item>
        <Menu.Item onClick={() => signOut()}>Sign Out</Menu.Item>
      </>
    );
}
