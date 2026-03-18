"use client";

import { Button, Menu, px, Skeleton } from "@mantine/core";
import { IconChevronDown, IconLogout, IconUser } from "@tabler/icons-react";
import Link from "next/link";

import { useUser } from "./use-user";

export default function UserMenu() {
  const { state, session, user, logout } = useUser();

  if (state === "loading") {
    return <Skeleton w={100} h={20} />;
  }
  if (state === "unauthenticated") {
    return (
      <Button component="a" href="/auth/login" variant="subtle" size="sm">
        Sign in
      </Button>
    );
  }
  return (
    <Menu position="bottom-end">
      <Menu.Target>
        <Button
          variant="subtle"
          size="sm"
          color="gray"
          rightSection={<IconChevronDown size={px("1rem")} />}
        >
          {user.email}
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item
          component={Link}
          href="/auth/profile"
          leftSection={<IconUser size={px("1rem")} />}
        >
          My Profile
        </Menu.Item>
        <Menu.Divider />
        <Menu.Item
          leftSection={<IconLogout size={px("1rem")} />}
          onClick={logout}
        >
          Sign out
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
