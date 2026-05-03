"use client";

import { Check, Copy, ExternalLink, Moon, Sun, X } from "lucide-react";
import Image, { type StaticImageData } from "next/image";
import { useEffect, useState } from "react";
import lumaDark from "../../v2-plans/screenshots/luma-inter-dk.png";
import lumaLight from "../../v2-plans/screenshots/luma-inter-lt.png";
import lyraDark from "../../v2-plans/screenshots/lyra-jetbrains-mono-dk.png";
import lyraLight from "../../v2-plans/screenshots/lyra-jetbrains-mono-lt.png";
import maiaDark from "../../v2-plans/screenshots/maia-ibm-plex-sans-dk.png";
import maiaLight from "../../v2-plans/screenshots/maia-ibm-plex-sans-lt.png";
import vegaDark from "../../v2-plans/screenshots/vega-eb-garamond-dk.png";
import vegaLight from "../../v2-plans/screenshots/vega-eb-garamond-lt.png";

interface PresetTheme {
  description: string;
  images: Record<ScreenshotMode, StaticImageData>;
  name: string;
  preset?: string;
}

type ScreenshotMode = "light" | "dark";

const presetThemes: PresetTheme[] = [
  {
    name: "Lyra Terminal",
    preset: "b1GLYNP5U",
    description: "Sharp mono typography, electric indigo controls, and amber charts for dense technical workspaces.",
    images: {
      dark: lyraDark,
      light: lyraLight,
    },
  },
  {
    name: "Luma Workspace",
    preset: "b2WOINJcO",
    description: "Soft Inter layouts with emerald actions and magenta analytics for polished operations apps.",
    images: {
      dark: lumaDark,
      light: lumaLight,
    },
  },
  {
    name: "Vega Editorial",
    preset: "b4gfKIwlc",
    description: "Elegant Garamond typography, deep teal actions, and warm red charts for refined business tools.",
    images: {
      dark: vegaDark,
      light: vegaLight,
    },
  },
  {
    name: "Maia Operations",
    preset: "b4gzXVxFz",
    description: "Balanced IBM Plex Sans screens with blue primary actions and red alert-friendly reporting.",
    images: {
      dark: maiaDark,
      light: maiaLight,
    },
  },
];

export function ShadcnPresetThemes() {
  const [copiedPreset, setCopiedPreset] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ mode: ScreenshotMode; theme: PresetTheme } | null>(null);

  useEffect(() => {
    if (!preview) {
      return;
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPreview(null);
      }
    }

    window.addEventListener("keydown", closeOnEscape);

    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [preview]);

  async function copyPrompt(preset: string) {
    const prompt = `apply this shadcn preset to this project --preset ${preset}`;

    await navigator.clipboard.writeText(prompt);
    setCopiedPreset(preset);
    window.setTimeout(() => setCopiedPreset(null), 1800);
  }

  return (
    <section className="py-16">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-bold text-2xl sm:text-3xl">Choose a shadcn preset</h2>
          <p className="mt-4 text-gray-600 leading-7 dark:text-white/60">
            Pick a visual direction, copy the prompt, and hand it to your coding agent to apply the matching shadcn
            preset to your ProofKit project.
          </p>
          <a
            className="mt-5 inline-flex items-center gap-2 font-medium text-gray-900 text-sm underline-offset-4 hover:underline dark:text-white"
            href="https://ui.shadcn.com/create"
            rel="noreferrer"
            target="_blank"
          >
            Build presets in shadcn/ui Create
            <ExternalLink className="size-3.5" />
          </a>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          {presetThemes.map((theme) => {
            const prompt = theme.preset ? `apply this shadcn preset to this project --preset ${theme.preset}` : null;
            const isCopied = copiedPreset === theme.preset;

            return (
              <article
                className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.03]"
                key={theme.name}
              >
                <div className="grid gap-px bg-gray-200 sm:grid-cols-2 dark:bg-white/10">
                  {(["light", "dark"] as const).map((mode) => (
                    <button
                      className="group relative aspect-video overflow-hidden text-left"
                      key={mode}
                      onClick={() => setPreview({ mode, theme })}
                      type="button"
                    >
                      <Image
                        alt={`${theme.name} ${mode} mode screenshot`}
                        className="size-full object-cover transition duration-300 group-hover:scale-[1.03]"
                        placeholder="blur"
                        src={theme.images[mode]}
                      />
                      <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full border border-white/30 bg-black/55 px-2.5 py-1 text-white text-xs backdrop-blur">
                        {mode === "light" ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
                        <span className="capitalize">{mode}</span>
                      </div>
                    </button>
                  ))}
                </div>
                <div className="space-y-4 p-5">
                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-semibold text-lg">{theme.name}</h3>
                      <span className="rounded-full border border-gray-200 px-2.5 py-1 font-mono text-gray-500 text-xs dark:border-white/10 dark:text-white/50">
                        {theme.preset ? `--preset ${theme.preset}` : "preset pending"}
                      </span>
                    </div>
                    <p className="mt-2 text-gray-500 text-sm leading-6 dark:text-white/50">{theme.description}</p>
                  </div>

                  {prompt && theme.preset ? (
                    <button
                      className="flex w-full items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-left font-mono text-gray-600 text-xs transition hover:border-gray-300 hover:bg-gray-100 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/65 dark:hover:border-white/20 dark:hover:bg-white/[0.08]"
                      onClick={async () => {
                        await copyPrompt(theme.preset);
                      }}
                      type="button"
                    >
                      <span className="truncate">{prompt}</span>
                      {isCopied ? (
                        <Check className="size-4 shrink-0 text-emerald-500" />
                      ) : (
                        <Copy className="size-4 shrink-0 text-gray-400 dark:text-white/40" />
                      )}
                    </button>
                  ) : (
                    <div className="rounded-xl border border-gray-200 border-dashed bg-gray-50 px-3 py-2 font-mono text-gray-400 text-xs dark:border-white/10 dark:bg-white/[0.04] dark:text-white/35">
                      Add Vega preset ID to enable copy prompt
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        <div className="mx-auto mt-12 max-w-3xl rounded-2xl border border-gray-200 bg-gray-50 p-6 text-center dark:border-white/10 dark:bg-white/[0.04]">
          <h3 className="font-semibold text-lg">Design beyond these presets</h3>
          <p className="mt-3 text-gray-600 text-sm leading-6 dark:text-white/60">
            shadcn/ui Create is a visual theme builder for generating shadcn presets: choose fonts, colors, radius,
            charts, and component styling, then copy the resulting preset into your agent prompt. These examples are
            starting points, not limits.
          </p>
          <p className="mt-3 text-gray-500 text-sm leading-6 dark:text-white/50">
            ProofKit works with shadcn-compatible presets from shadcn/ui Create or any other shadcn theme creator,
            design tool, or preset generator that produces a usable preset ID or theme configuration.
          </p>
        </div>
      </div>

      {preview ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            aria-label="Close screenshot preview"
            className="absolute inset-0 bg-black/75 backdrop-blur-sm"
            onClick={() => setPreview(null)}
            type="button"
          />
          <div
            aria-label={`${preview.theme.name} ${preview.mode} mode screenshot preview`}
            aria-modal="true"
            className="relative w-full max-w-5xl overflow-hidden rounded-3xl border border-white/15 bg-white shadow-2xl dark:bg-zinc-950"
            role="dialog"
          >
            <button
              aria-label="Close screenshot preview"
              className="absolute top-4 right-4 z-10 flex size-9 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white backdrop-blur transition hover:bg-black/55"
              onClick={() => setPreview(null)}
              type="button"
            >
              <X className="size-4" />
            </button>
            <div className="relative aspect-video">
              <Image
                alt={`${preview.theme.name} ${preview.mode} mode screenshot`}
                className="size-full object-contain"
                placeholder="blur"
                src={preview.theme.images[preview.mode]}
              />
              <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-full border border-white/20 bg-black/55 px-3 py-1.5 text-sm text-white backdrop-blur">
                {preview.mode === "light" ? <Sun className="size-4" /> : <Moon className="size-4" />}
                <span>
                  {preview.theme.name} · {preview.mode} mode
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
