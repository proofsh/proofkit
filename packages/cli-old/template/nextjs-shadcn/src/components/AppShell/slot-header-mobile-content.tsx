"use client";

import { primaryRoutes } from "@/app/navigation";
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
    <div className="flex flex-col">
      {primaryRoutes.map((route) => (
        <button
          key={route.label}
          className="flex items-center gap-2 rounded px-3 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800"
          onClick={() => {
            closeMenu();
            if (route.type === "function") {
              route.onClick();
            } else if (route.type === "link") {
              router.push(route.href);
            }
          }}
        >
          {route.icon}
          <span>{route.label}</span>
        </button>
      ))}
    </div>
  );
}

export default SlotHeaderMobileMenuContent;
