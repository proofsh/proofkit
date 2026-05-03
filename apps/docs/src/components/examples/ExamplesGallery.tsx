"use client";

import { ArrowUpRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { DesktopWindowFrame } from "@/components/examples/DesktopWindowFrame";
import { ExampleLightbox, type LiveExample, liveExamples } from "@/components/examples/ExampleShowcaseGrid";
import { cn } from "@/lib/utils";

interface ExampleCatalogItem {
  desc: string;
  liveExampleId?: string;
  title: string;
}

interface ExamplesGalleryProps {
  examples: ExampleCatalogItem[];
}

export function ExamplesGallery({ examples }: ExamplesGalleryProps) {
  const [openExampleId, setOpenExampleId] = useState<string | null>(null);
  const liveExampleById = useMemo(() => new Map(liveExamples.map((example) => [example.id, example] as const)), []);
  const openExample = openExampleId ? liveExampleById.get(openExampleId) : undefined;

  useEffect(() => {
    if (!openExampleId) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenExampleId(null);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [openExampleId]);

  return (
    <>
      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {examples.map((example) => {
          const liveExample = example.liveExampleId ? liveExampleById.get(example.liveExampleId) : undefined;

          return (
            <ExampleCatalogCard
              example={example}
              key={example.title}
              liveExample={liveExample}
              onOpen={liveExample ? () => setOpenExampleId(liveExample.id) : undefined}
            />
          );
        })}
      </div>

      {openExample && <ExampleLightbox example={openExample} onClose={() => setOpenExampleId(null)} />}
    </>
  );
}

function ExampleCatalogCard({
  example,
  liveExample,
  onOpen,
}: {
  example: ExampleCatalogItem;
  liveExample?: LiveExample;
  onOpen?: () => void;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/10 dark:bg-white/[0.03]",
        liveExample &&
          "group transition hover:-translate-y-1 hover:border-[#D15ABB]/40 hover:shadow-[#D15ABB]/10 hover:shadow-xl",
      )}
    >
      <div className="relative flex aspect-video items-center justify-center overflow-hidden border-gray-100 border-b bg-gray-50 dark:border-white/10 dark:bg-white/[0.02]">
        {liveExample ? (
          <>
            <ExampleWindowPreview example={liveExample} />
            <button
              aria-label={`Open ${example.title} example`}
              className="absolute inset-0 z-10 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D15ABB] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-black"
              onClick={onOpen}
              type="button"
            />
            <span className="pointer-events-none absolute right-4 bottom-4 z-20 flex size-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 transition group-hover:border-[#D15ABB]/30 group-hover:text-[#D15ABB] dark:border-white/10 dark:bg-white/[0.08] dark:text-white/60">
              <ArrowUpRight className="size-4" />
            </span>
          </>
        ) : (
          <span className="text-gray-400 text-sm dark:text-white/25">[Example preview: {example.title}]</span>
        )}
      </div>
      <div className="p-5">
        <h3 className="font-semibold">{example.title}</h3>
        <p className="mt-1 text-gray-500 text-sm dark:text-white/50">{example.desc}</p>
      </div>
    </div>
  );
}

function ExampleWindowPreview({ example }: { example: LiveExample }) {
  return (
    <div className="relative size-full overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(209,90,187,0.16),transparent_42%)]">
      <div className="absolute top-3 left-3 origin-top-left scale-[0.3] transition duration-300 group-hover:scale-[0.315]">
        <DesktopWindowFrame className="shadow-2xl" title={example.windowTitle}>
          {example.render({ interactive: false })}
        </DesktopWindowFrame>
      </div>
    </div>
  );
}
