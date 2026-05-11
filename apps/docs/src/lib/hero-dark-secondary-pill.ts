import { cn } from "@/lib/utils";

/** Pill chrome for secondary actions on the dark homepage hero (matches primary download tone). */
export const heroDarkSecondaryPillClassName = cn(
  "inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-5 py-2.5 font-semibold text-sm text-white no-underline shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-md transition hover:border-white/25 hover:bg-white/[0.1] hover:text-white hover:no-underline",
);
