import { Bot, Code, Download, Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import DarkVeil from "@/components/DarkVeil";
import { LargeSearchToggle } from "@/components/search-toggle";
import { ThemeToggle } from "@/components/theme-toggle";

const stackItems = [
  { name: "Cursor", icon: <Sparkles className="size-5" /> },
  { name: "Claude", icon: <Bot className="size-5" /> },
  { name: "Codex", icon: <Code className="size-5" /> },
  {
    name: "React",
    icon: (
      <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
        <circle cx="12" cy="12" fill="currentColor" r="1.8" />
        <ellipse cx="12" cy="12" rx="9" ry="3.8" stroke="currentColor" strokeWidth="1.5" />
        <ellipse cx="12" cy="12" rx="9" ry="3.8" stroke="currentColor" strokeWidth="1.5" transform="rotate(60 12 12)" />
        <ellipse
          cx="12"
          cy="12"
          rx="9"
          ry="3.8"
          stroke="currentColor"
          strokeWidth="1.5"
          transform="rotate(120 12 12)"
        />
      </svg>
    ),
  },
  { name: "ShadCN", icon: <span className="text-lg leading-none">/</span> },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <section className="relative isolate min-h-screen overflow-hidden rounded-b-[2rem] border-white/10 border-b">
        <div className="absolute inset-0">
          <DarkVeil
            hueShift={315}
            noiseIntensity={0}
            scanlineFrequency={0}
            scanlineIntensity={0}
            speed={0.5}
            warpAmount={0}
          />
        </div>
        <div className="absolute -top-32 left-[-18%] h-72 w-[78%] rotate-[15deg] rounded-full bg-[#D15ABB]/65 blur-3xl" />
        <div className="absolute -top-24 right-[-10%] h-64 w-[58%] rotate-[-12deg] rounded-full bg-[#D15ABB]/45 blur-3xl" />
        <div className="absolute top-2 left-[20%] h-40 w-[58%] rotate-[-18deg] rounded-full bg-[#D15ABB]/30 blur-2xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,transparent_0,rgba(0,0,0,0.08)_34%,rgba(0,0,0,0.78)_74%)]" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-black/35 to-black" />
        <div className="absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-[#D15ABB]/25 to-transparent blur-3xl" />

        <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-6 sm:px-6">
          <header className="mx-auto flex w-full max-w-4xl items-center justify-between rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 shadow-2xl shadow-purple-950/30 backdrop-blur-xl">
            <div className="flex items-center gap-8">
              <Link aria-label="ProofKit home" className="flex items-center gap-2 font-semibold text-white" href="/">
                <Image
                  alt="ProofKit"
                  className="h-6 w-auto brightness-0 invert"
                  height={40}
                  src="/proofkit-horiz.png"
                  width={120}
                />
              </Link>

              <nav aria-label="Primary navigation" className="hidden items-center gap-8 sm:flex">
                <Link className="font-medium text-sm text-white/55 transition hover:text-white" href="/docs/cli">
                  Docs
                </Link>
                <Link className="font-medium text-sm text-white/55 transition hover:text-white" href="/docs/webviewer">
                  Features
                </Link>
                <Link
                  className="font-medium text-sm text-white/55 transition hover:text-white"
                  href="https://community.ottomatic.cloud/c/proofkit"
                >
                  Community
                </Link>
              </nav>
            </div>

            <div className="flex items-center gap-2">
              <LargeSearchToggle
                className="hidden min-w-40 border-white/10 bg-white/[0.06] text-white/55 hover:bg-white/10 hover:text-white md:inline-flex [&_kbd]:border-white/10 [&_kbd]:bg-white/[0.06] [&_kbd]:text-white/45"
                hideIfDisabled
              />
              <ThemeToggle className="border-white/10 bg-white/[0.06] text-white/55 [&_.bg-fd-accent]:bg-white/15 [&_.text-fd-accent-foreground]:text-white [&_svg]:text-white/60" />
            </div>
          </header>

          <div className="flex flex-1 flex-col pt-20 text-center">
            <div className="flex flex-1 items-center justify-center pb-16">
              <div className="mx-auto max-w-3xl">
                <div className="mb-8 inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.06] p-1 pr-4 text-sm text-white/55 shadow-purple-950/20 shadow-xl backdrop-blur-md">
                  <span className="rounded-full bg-white px-3 py-1 font-bold text-black text-xs">NEW</span>
                  FileMaker-aware TypeScript tools
                </div>

                <h1 className="text-balance font-bold text-5xl tracking-tight sm:text-6xl md:text-7xl">
                  Agentic Coding for FileMaker!
                </h1>

                <p className="mx-auto mt-6 max-w-2xl text-lg text-white/60 leading-8">
                  Build beautiful, modern interfaces for any FileMaker app using your favorite coding agent. Type-safe
                  data, scaffolded apps, and agent skills built from decades of FileMaker experience.
                </p>

                <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
                  <Link
                    className="inline-flex h-12 items-center gap-3 rounded-full border border-white/15 bg-white/[0.06] px-6 font-semibold text-base text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_36px_rgba(255,255,255,0.08)] backdrop-blur-md transition hover:border-white/25 hover:bg-white/[0.1]"
                    href="/docs/cli/guides/getting-started"
                  >
                    <Download className="size-5" />
                    Download for macOS
                  </Link>
                  <button
                    aria-disabled="true"
                    className="inline-flex h-12 cursor-not-allowed items-center gap-3 rounded-full border border-white/10 bg-white/[0.04] px-6 font-semibold text-base text-white/45 backdrop-blur-md"
                    type="button"
                  >
                    <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
                      <path
                        d="M4 5.5h7v6H4zM13 5.5h7v6h-7zM4 13h7v5.5H4zM13 13h7v5.5h-7z"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      />
                    </svg>
                    Download for Windows
                    <span className="rounded-full border border-white/10 px-2 py-1 font-semibold text-[0.62rem] text-white/35 uppercase tracking-[0.2em]">
                      Coming soon
                    </span>
                  </button>
                </div>
              </div>
            </div>

            <div className="pb-8">
              <p className="font-semibold text-[0.7rem] text-white/35 uppercase tracking-[0.42em]">
                Built for the modern stack
              </p>
              <div className="mx-auto mt-6 flex max-w-4xl flex-wrap items-center justify-center gap-x-10 gap-y-5 text-white/45">
                {stackItems.map((item) => (
                  <div className="flex items-center gap-2.5 font-medium text-base" key={item.name}>
                    {item.icon}
                    {item.name}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
