import { primaryRoutes } from "@/app/navigation";
import { Group } from "@mantine/core";

import HeaderNavLink from "./internal/HeaderNavLink";

/**
 * DO NOT REMOVE / RENAME THIS FILE
 *
 * You may CUSTOMIZE the content of this file, but the ProofKit CLI expects
 * this file to exist and may use it to inject content for other components.
 *
 * If you don't want it to be used, you may return null or an empty fragment
 */
export function SlotHeaderRight() {
  return (
    <>
      <Group gap={5} visibleFrom="xs">
        {primaryRoutes.map((route) => (
          <HeaderNavLink key={route.label} {...route} />
        ))}
      </Group>
    </>
  );
}

export default SlotHeaderRight;
