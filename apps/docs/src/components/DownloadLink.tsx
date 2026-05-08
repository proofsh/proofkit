"use client";

import { Download } from "lucide-react";
import { useEffect, useState } from "react";
import { DownloadDialog } from "@/components/DownloadDialog";

type Platform = "mac" | "win";

const detectPlatform = (): Platform => {
  if (typeof navigator === "undefined") {
    return "mac";
  }
  return navigator.userAgent.toLowerCase().includes("win") ? "win" : "mac";
};

export function DownloadLink() {
  const [platform, setPlatform] = useState<Platform>("mac");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setPlatform(detectPlatform());
  }, []);

  return (
    <>
      <button
        className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 font-medium text-sm transition hover:bg-gray-100 dark:border-white/15 dark:hover:bg-white/10"
        onClick={() => setOpen(true)}
        type="button"
      >
        <Download className="size-4" />
        Download ProofKit
      </button>
      <DownloadDialog onOpenChange={setOpen} open={open} platform={platform} />
    </>
  );
}
