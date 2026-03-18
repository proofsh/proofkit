"use client";

import { Burger, Menu } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";

import SlotHeaderMobileMenuContent from "../slot-header-mobile-content";

export default function HeaderMobileMenu() {
  const [opened, { toggle }] = useDisclosure(false);

  return (
    <Menu
      opened={opened}
      onClose={toggle}
      styles={{ item: { padding: "1rem" } }}
      shadow="md"
      radius="md"
    >
      <Menu.Target>
        <Burger opened={opened} hiddenFrom="sm" onClick={toggle} size="sm" />
      </Menu.Target>
      <Menu.Dropdown w={"90%"}>
        <SlotHeaderMobileMenuContent closeMenu={toggle} />
      </Menu.Dropdown>
    </Menu>
  );
}
