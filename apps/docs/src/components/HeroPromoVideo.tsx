"use client";

import { Play } from "lucide-react";
import { useState } from "react";
import { flushSync } from "react-dom";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { getYouTubeNocookieEmbedSrc, YouTubeVideo } from "@/components/YouTubeVideo";
import { trackPromoVideoClosed, trackPromoVideoOpened } from "@/lib/analytics";
import { heroDarkSecondaryPillClassName } from "@/lib/hero-dark-secondary-pill";
import { cn } from "@/lib/utils";

const PROMO_VIDEO_URL = "https://youtu.be/dj3fn3RKeQ0";
const PROMO_VIDEO_ID = "dj3fn3RKeQ0";
const SURFACE = "home_hero";

interface HeroPromoVideoProps {
  className?: string;
}

export function HeroPromoVideo({ className }: HeroPromoVideoProps) {
  const [open, setOpen] = useState(false);
  const [embedSrc, setEmbedSrc] = useState<string | null>(null);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      trackPromoVideoClosed({ video_id: PROMO_VIDEO_ID, surface: SURFACE });
      setEmbedSrc(null);
    }
    setOpen(next);
  };

  const openDialog = () => {
    trackPromoVideoOpened({
      video_id: PROMO_VIDEO_ID,
      surface: SURFACE,
      video_url: PROMO_VIDEO_URL,
    });
    const src = getYouTubeNocookieEmbedSrc({
      url: PROMO_VIDEO_URL,
      autoPlay: true,
      origin: window.location.origin,
    });
    flushSync(() => {
      setEmbedSrc(src);
      setOpen(true);
    });
  };

  return (
    <>
      <button
        aria-haspopup="dialog"
        className={cn(heroDarkSecondaryPillClassName, className)}
        onClick={openDialog}
        type="button"
      >
        <Play aria-hidden className="size-4 shrink-0 fill-current" />
        Watch overview
      </button>

      <Dialog onOpenChange={handleOpenChange} open={open}>
        <DialogContent
          className={cn(
            "max-w-[min(100vw-2rem,85rem)] gap-0 overflow-hidden border-2 border-white bg-black p-0 shadow-2xl",
            "[&>button]:text-white [&>button]:opacity-90 [&>button]:hover:opacity-100 [&>button]:focus:ring-white [&>button]:focus:ring-offset-black",
          )}
        >
          <DialogTitle className="sr-only">ProofKit overview video</DialogTitle>
          {open && embedSrc ? (
            <YouTubeVideo embedSrc={embedSrc} title="ProofKit overview video" variant="plain" />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
