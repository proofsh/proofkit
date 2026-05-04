"use client";

import { ChevronDown, Download } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type Platform = "mac" | "win";

const platformOptions: Record<Platform, { label: string; href: string; icon: React.ReactNode }> = {
  mac: {
    label: "Download for macOS",
    href: "/download/mac",
    icon: <Download className="size-5" />,
  },
  win: {
    label: "Download for Windows",
    href: "/download/win",
    icon: (
      <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
        <path d="M4 5.5h7v6H4zM13 5.5h7v6h-7zM4 13h7v5.5H4zM13 13h7v5.5h-7z" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    ),
  },
};

const detectPlatform = (): Platform => {
  if (typeof navigator === "undefined") {
    return "mac";
  }
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("win")) {
    return "win";
  }
  return "mac";
};

export type DownloadButtonVariant = "dark" | "light";

interface DownloadButtonProps {
  variant?: DownloadButtonVariant;
  className?: string;
}

const variantStyles: Record<DownloadButtonVariant, { primary: string; chevron: string }> = {
  dark: {
    primary:
      "h-12 border border-white/15 bg-white/[0.06] px-6 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_36px_rgba(255,255,255,0.08)] backdrop-blur-md transition hover:border-white/25 hover:bg-white/[0.1]",
    chevron:
      "h-12 border border-white/15 border-l-0 bg-white/[0.06] px-3 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_36px_rgba(255,255,255,0.08)] backdrop-blur-md transition hover:border-white/25 hover:bg-white/[0.1]",
  },
  light: {
    primary:
      "h-12 border border-gray-900 bg-gray-900 px-6 text-white shadow-lg transition hover:bg-gray-800 dark:border-white/15 dark:bg-white/[0.06] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_36px_rgba(255,255,255,0.08)] dark:hover:border-white/25 dark:hover:bg-white/[0.1]",
    chevron:
      "h-12 border border-gray-900 border-l-0 bg-gray-900 px-3 text-white shadow-lg transition hover:bg-gray-800 dark:border-white/15 dark:border-l-0 dark:bg-white/[0.06] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_36px_rgba(255,255,255,0.08)] dark:hover:border-white/25 dark:hover:bg-white/[0.1]",
  },
};

export function DownloadButton({ variant = "light", className }: DownloadButtonProps) {
  const [platform, setPlatform] = useState<Platform>("mac");

  useEffect(() => {
    setPlatform(detectPlatform());
  }, []);

  const primary = platformOptions[platform];
  const otherKey: Platform = platform === "mac" ? "win" : "mac";
  const other = platformOptions[otherKey];
  const styles = variantStyles[variant];

  return (
    <ButtonGroup className={className}>
      <Link
        className={cn("inline-flex items-center gap-3 rounded-l-full font-semibold text-base", styles.primary)}
        href={primary.href}
      >
        {primary.icon}
        {primary.label}
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Show other download options"
          className={cn(
            "inline-flex items-center justify-center rounded-r-full font-semibold focus-visible:outline-none",
            styles.chevron,
          )}
        >
          <ChevronDown className="size-5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link className="gap-3" href={other.href}>
              {other.icon}
              {other.label}
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </ButtonGroup>
  );
}
