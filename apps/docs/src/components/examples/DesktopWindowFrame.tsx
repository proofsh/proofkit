import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface DesktopWindowFrameProps {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  title?: string;
}

export function DesktopWindowFrame({
  children,
  className,
  contentClassName,
  title = "proofkit-crm.fmp12",
}: DesktopWindowFrameProps) {
  return (
    <div
      className={cn(
        "w-[1040px] overflow-hidden rounded-[2rem] border border-border bg-card text-card-foreground shadow-2xl shadow-black/10",
        className,
      )}
    >
      <div className="relative flex h-11 items-center border-border border-b bg-muted/55 px-4">
        <div className="flex items-center gap-2">
          <span className="size-3 rounded-full bg-[#ff5f57]" />
          <span className="size-3 rounded-full bg-[#ffbd2e]" />
          <span className="size-3 rounded-full bg-[#28c840]" />
        </div>
        <div className="absolute left-1/2 -translate-x-1/2 rounded-full border border-border bg-background/70 px-3 py-1 font-medium text-muted-foreground text-xs shadow-sm">
          {title}
        </div>
      </div>
      <div className={cn("bg-background", contentClassName)}>{children}</div>
    </div>
  );
}
