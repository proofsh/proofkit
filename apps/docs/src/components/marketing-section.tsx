import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface MarketingSectionProps {
  children: ReactNode;
  className?: string;
  variant?: "primary" | "alternate";
}

interface MarketingCardProps {
  children: ReactNode;
  className?: string;
  surface?: "primary" | "alternate";
}

export function MarketingSection({ children, className, variant = "primary" }: MarketingSectionProps) {
  return (
    <section className={cn("py-16", variant === "alternate" && "bg-gray-100 dark:bg-gray-900", className)}>
      {children}
    </section>
  );
}

export function MarketingCard({ children, className, surface = "primary" }: MarketingCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-gray-200 p-6 dark:border-white/10 dark:bg-white/[0.03]",
        surface === "primary" && "bg-gray-50",
        surface === "alternate" && "bg-white",
        className,
      )}
    >
      {children}
    </div>
  );
}
