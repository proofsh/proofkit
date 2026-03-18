"use client";

import { Button, Menu, px } from "@mantine/core";
import { IconChevronDown } from "@tabler/icons-react";
import { signIn, signOut, useSession } from "next-auth/react";

export default function UserMenu() {
  const { data: session, status } = useSession();

  if (status === "loading") return null;

  if (status === "unauthenticated")
    return (
      <Button variant="subtle" onClick={() => signIn()}>
        Sign In
      </Button>
    );

  if (status === "authenticated")
    return (
      <Menu position="bottom-end" withArrow>
        <Menu.Target>
          <Button
            variant="subtle"
            color="gray"
            rightSection={<IconChevronDown size={px("1rem")} />}
          >
            {session?.user?.email}
          </Button>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item onClick={() => signOut()}>Sign Out</Menu.Item>
        </Menu.Dropdown>
      </Menu>
    );

  return null;
}
