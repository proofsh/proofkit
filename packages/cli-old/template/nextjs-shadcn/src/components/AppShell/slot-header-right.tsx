import { primaryRoutes } from "@/app/navigation";

import HeaderNavLink from "./internal/HeaderNavLink";
import { ModeToggle } from "../mode-toggle";

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
    <div className="flex items-center space-x-1">
      {primaryRoutes.map((route) => (
        <HeaderNavLink key={route.label} {...route} />
      ))}
      <ModeToggle />
    </div>
  );
}

export default SlotHeaderRight;
