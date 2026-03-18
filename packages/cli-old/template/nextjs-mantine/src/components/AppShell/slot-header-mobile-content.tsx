"use client";

import { primaryRoutes } from "@/app/navigation";
import { Menu } from "@mantine/core";
import { useRouter } from "next/navigation";

/**
 * DO NOT REMOVE / RENAME THIS FILE
 *
 * You may CUSTOMIZE the content of this file, but the ProofKit CLI expects
 * this file to exist and may use it to inject content for other components.
 *
 * If you don't want it to be used, you may return null or an empty fragment
 */
export function SlotHeaderMobileMenuContent({
  closeMenu,
}: {
  closeMenu: () => void;
}) {
  const router = useRouter();
  return (
    <>
      {primaryRoutes.map((route) => (
        <Menu.Item
          key={route.label}
          leftSection={route.icon}
          onClick={() => {
            closeMenu();
            if (route.type === "function") {
              route.onClick();
            } else if (route.type === "link") {
              router.push(route.href);
            }
          }}
        >
          {route.label}
        </Menu.Item>
      ))}
    </>
  );
}

export default SlotHeaderMobileMenuContent;
