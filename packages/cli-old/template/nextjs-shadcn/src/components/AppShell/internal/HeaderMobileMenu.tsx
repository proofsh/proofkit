"use client";

import { useState } from "react";
import SlotHeaderMobileMenuContent from "../slot-header-mobile-content";

export default function HeaderMobileMenu() {
  const [opened, setOpened] = useState(false);

  return (
    <div className="relative">
      <button
        className="inline-flex h-8 w-8 items-center justify-center rounded border border-zinc-300 dark:border-zinc-700"
        aria-label="Open menu"
        onClick={() => setOpened((v) => !v)}
      >
        <span className="block h-0.5 w-4 bg-current" />
      </button>
      {opened && (
        <div className="absolute right-0 z-50 mt-2 w-[90vw] max-w-xs rounded-md border border-zinc-200 bg-white p-2 shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
          <SlotHeaderMobileMenuContent closeMenu={() => setOpened(false)} />
        </div>
      )}
    </div>
  );
}
