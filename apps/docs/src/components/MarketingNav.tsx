"use client";

import { ChevronDown, Menu } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { trackMarketingNavClick } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { LargeSearchToggle } from "./search-toggle";
import { ThemeToggle } from "./theme-toggle";
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from "./ui/popover";

const primaryNavLinks = [
  { href: "/docs", label: "Docs" },
  { href: "https://community.proof.sh/c/proofkit", label: "Community" },
];

const moreNavLinks = [
  { href: "/examples", label: "Examples" },
  { href: "/how-it-works", label: "How it Works" },
  { href: "/why-webviewers", label: "Why WebViewers" },
  { href: "/why-proofkit", label: "Why ProofKit" },
];

const navLinks = [...primaryNavLinks, ...moreNavLinks];

interface MarketingNavProps {
  variant?: "dark" | "light";
}

export function MarketingNav({ variant = "light" }: MarketingNavProps) {
  const isDark = variant === "dark";

  return (
    <header
      className={cn(
        "mx-auto mt-6 flex w-full max-w-6xl items-center justify-between rounded-2xl border px-4 py-3 shadow-lg backdrop-blur-xl",
        isDark
          ? "border-white/10 bg-white/[0.06] shadow-purple-950/30"
          : "border-gray-200 bg-white/80 dark:border-white/10 dark:bg-white/[0.06] dark:shadow-purple-950/30",
      )}
    >
      <div className="flex min-w-0 items-center gap-2 lg:gap-8">
        <MobileNavPopover isDark={isDark} links={navLinks} />
        <Link
          aria-label="ProofKit home"
          className={cn("flex items-center gap-2 font-semibold", isDark && "text-white")}
          href="/"
        >
          <Image
            alt="ProofKit"
            className={cn("h-6 w-auto", isDark ? "brightness-0 invert" : "dark:brightness-0 dark:invert")}
            height={40}
            src="/proofkit-horiz.png"
            width={120}
          />
        </Link>

        <nav aria-label="Primary navigation" className="hidden items-center gap-6 lg:flex">
          {primaryNavLinks.map((link) => (
            <Link
              className={cn(
                "whitespace-nowrap font-medium text-sm transition",
                isDark
                  ? "text-white/55 hover:text-white"
                  : "text-gray-500 hover:text-gray-900 dark:text-white/55 dark:hover:text-white",
              )}
              href={link.href}
              key={link.href}
              onClick={() =>
                trackMarketingNavClick({
                  destination: link.href,
                  label: link.label,
                  navSurface: "primary",
                })
              }
            >
              {link.label}
            </Link>
          ))}
          <NavPopover isDark={isDark} label="More" links={moreNavLinks} />
        </nav>
      </div>

      <div className="flex items-center gap-2">
        <LargeSearchToggle
          className={cn(
            "hidden min-w-40 md:inline-flex",
            isDark
              ? "border-white/10 bg-white/[0.06] text-white/55 hover:bg-white/10 hover:text-white [&_kbd]:border-white/10 [&_kbd]:bg-white/[0.06] [&_kbd]:text-white/45"
              : "border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:border-white/10 dark:bg-white/[0.06] dark:text-white/55 dark:hover:bg-white/10 dark:hover:text-white [&_kbd]:border-gray-200 [&_kbd]:bg-gray-100 [&_kbd]:text-gray-400 dark:[&_kbd]:border-white/10 dark:[&_kbd]:bg-white/[0.06] dark:[&_kbd]:text-white/45",
          )}
          hideIfDisabled
        />
        <ThemeToggle
          className={cn(
            isDark
              ? "border-white/10 bg-white/[0.06] text-white/55 [&_.bg-fd-accent]:bg-white/15 [&_.text-fd-accent-foreground]:text-white [&_svg]:text-white/60"
              : "border-gray-200 bg-gray-50 text-gray-500 dark:border-white/10 dark:bg-white/[0.06] dark:text-white/55 [&_.bg-fd-accent]:bg-gray-200 dark:[&_.bg-fd-accent]:bg-white/15 [&_.text-fd-accent-foreground]:text-gray-900 dark:[&_.text-fd-accent-foreground]:text-white [&_svg]:text-gray-500 dark:[&_svg]:text-white/60",
          )}
        />
      </div>
    </header>
  );
}

function NavPopover({ isDark, label, links }: { isDark: boolean; label: string; links: typeof navLinks }) {
  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          "inline-flex items-center gap-1.5 whitespace-nowrap font-medium text-sm transition",
          isDark
            ? "text-white/55 hover:text-white"
            : "text-gray-500 hover:text-gray-900 dark:text-white/55 dark:hover:text-white",
        )}
      >
        {label}
        <ChevronDown className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className={cn(
          "min-w-56 border p-2",
          isDark
            ? "border-white/10 bg-black/80 text-white"
            : "border-gray-200 bg-white/90 dark:border-white/10 dark:bg-black/80 dark:text-white",
        )}
      >
        <NavMenuList isDark={isDark} links={links} navSurface="more" />
      </PopoverContent>
    </Popover>
  );
}

function MobileNavPopover({ isDark, links }: { isDark: boolean; links: typeof navLinks }) {
  return (
    <Popover>
      <PopoverTrigger
        aria-label="Open navigation menu"
        className={cn(
          "inline-flex size-10 items-center justify-center rounded-full border transition lg:hidden",
          isDark
            ? "border-white/10 bg-white/[0.06] text-white/70 hover:bg-white/10 hover:text-white"
            : "border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:border-white/10 dark:bg-white/[0.06] dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-white",
        )}
      >
        <Menu className="size-5" />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn(
          "min-w-64 border p-2",
          isDark
            ? "border-white/10 bg-black/85 text-white"
            : "border-gray-200 bg-white/95 dark:border-white/10 dark:bg-black/85 dark:text-white",
        )}
      >
        <NavMenuList isDark={isDark} links={links} navSurface="mobile" />
      </PopoverContent>
    </Popover>
  );
}

function NavMenuList({ isDark, links, navSurface }: { isDark: boolean; links: typeof navLinks; navSurface: string }) {
  return (
    <div className="grid gap-1">
      {links.map((link) => (
        <PopoverClose asChild key={link.href}>
          <Link
            className={cn(
              "rounded-lg px-3 py-2 font-medium text-sm transition",
              isDark
                ? "text-white/70 hover:bg-white/10 hover:text-white"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-950 dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white",
            )}
            href={link.href}
            onClick={() =>
              trackMarketingNavClick({
                destination: link.href,
                label: link.label,
                navSurface,
              })
            }
          >
            {link.label}
          </Link>
        </PopoverClose>
      ))}
    </div>
  );
}
