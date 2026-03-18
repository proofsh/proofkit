"use client";

import { Menu } from "@mantine/core";
import { signIn, signOut, useSession } from "next-auth/react";
import React from "react";

/**
 * Shown in the mobile header menu
 */
export default function UserMenuMobile() {
  const { data: session, status } = useSession();

  if (status === "loading") return null;

  if (status === "unauthenticated")
    return (
      <>
        <Menu.Divider />
        <Menu.Item onClick={() => signIn()}>Sign In</Menu.Item>
      </>
    );

  if (status === "authenticated")
    return (
      <>
        <Menu.Divider />
        <Menu.Item>{session.user.email}</Menu.Item>
        <Menu.Item onClick={() => signOut()}>Sign Out</Menu.Item>
      </>
    );
}
