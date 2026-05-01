import { Download } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { LargeSearchToggle } from "@/components/search-toggle";
import { ThemeToggle } from "@/components/theme-toggle";

export default function WhyProofkitPage() {
  return (
    <main className="min-h-screen bg-white text-gray-900 dark:bg-black dark:text-white">
      {/* Nav */}
      <header className="mx-auto mt-6 flex w-full max-w-4xl items-center justify-between rounded-2xl border border-gray-200 bg-white/80 px-4 py-3 shadow-lg backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.06] dark:shadow-purple-950/30">
        <div className="flex items-center gap-8">
          <Link aria-label="ProofKit home" className="flex items-center gap-2 font-semibold" href="/">
            <Image
              alt="ProofKit"
              className="h-6 w-auto dark:brightness-0 dark:invert"
              height={40}
              src="/proofkit-horiz.png"
              width={120}
            />
          </Link>
          <nav aria-label="Primary navigation" className="hidden items-center gap-8 sm:flex">
            <Link
              className="font-medium text-gray-500 text-sm transition hover:text-gray-900 dark:text-white/55 dark:hover:text-white"
              href="/docs/cli"
            >
              Docs
            </Link>
            <Link
              className="font-medium text-gray-500 text-sm transition hover:text-gray-900 dark:text-white/55 dark:hover:text-white"
              href="/why-proofkit"
            >
              Features
            </Link>
            <Link
              className="font-medium text-gray-500 text-sm transition hover:text-gray-900 dark:text-white/55 dark:hover:text-white"
              href="https://community.ottomatic.cloud/c/proofkit"
            >
              Community
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <LargeSearchToggle
            className="hidden min-w-40 border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-900 md:inline-flex dark:border-white/10 dark:bg-white/[0.06] dark:text-white/55 dark:hover:bg-white/10 dark:hover:text-white [&_kbd]:border-gray-200 [&_kbd]:bg-gray-100 [&_kbd]:text-gray-400 dark:[&_kbd]:border-white/10 dark:[&_kbd]:bg-white/[0.06] dark:[&_kbd]:text-white/45"
            hideIfDisabled
          />
          <ThemeToggle className="border-gray-200 bg-gray-50 text-gray-500 dark:border-white/10 dark:bg-white/[0.06] dark:text-white/55 [&_.bg-fd-accent]:bg-gray-200 dark:[&_.bg-fd-accent]:bg-white/15 [&_.text-fd-accent-foreground]:text-gray-900 dark:[&_.text-fd-accent-foreground]:text-white [&_svg]:text-gray-500 dark:[&_svg]:text-white/60" />
        </div>
      </header>

      {/* Page Header */}
      <section className="py-24 pb-16">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-balance font-bold text-4xl tracking-tight sm:text-5xl md:text-6xl">Why ProofKit</h1>
            <p className="mt-6 text-gray-600 text-lg leading-8 dark:text-white/60">
              Most tools were built for humans writing code. ProofKit is built for agents writing code with humans
              supervising. That's a different problem.
            </p>
          </div>
        </div>
      </section>

      {/* The Shift — alternate bg */}
      <section className="bg-gray-50 py-16 dark:bg-gray-950">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-3xl">
            <h2 className="font-bold text-2xl sm:text-3xl">The shift that changes everything</h2>
            <p className="mt-4 text-gray-600 leading-7 dark:text-white/60">
              AI agents don't just help you write code faster — they change the problem entirely. The bottleneck isn't
              typing speed or syntax knowledge. It's giving the agent the context it needs, the feedback loops it needs,
              and the deployment pipeline it needs. ProofKit solves those problems.
            </p>
          </div>
        </div>
      </section>

      {/* Comparison sections — primary bg */}
      <section className="py-16">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-4xl space-y-8">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-8 dark:border-white/10 dark:bg-white/[0.03]">
              <h3 className="font-bold text-xl">Hand-rolled WebViewers</h3>
              <p className="mt-3 text-gray-600 leading-7 dark:text-white/60">
                Works — but every iteration is a copy-paste cycle. You write the code, manually bundle it, paste it into
                a FileMaker field or file, refresh the WebViewer, and check. No agent feedback loop. No type safety. No
                self-correction. It's 2015-era workflow with 2026-era tools sitting unused.
              </p>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-8 dark:border-white/10 dark:bg-white/[0.03]">
              <h3 className="font-bold text-xl">Pre-agentic FileMaker web frameworks</h3>
              <p className="mt-3 text-gray-600 leading-7 dark:text-white/60">
                Good for their era. But they were designed for humans writing code by hand — not for agents that need
                schema access through MCP, automated deployment, and visual verification in a real browser. The problem
                has moved.
              </p>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-8 dark:border-white/10 dark:bg-white/[0.03]">
              <h3 className="font-bold text-xl">Commercial tools</h3>
              <p className="mt-3 text-gray-600 leading-7 dark:text-white/60">
                ProofKit is free, agent-first by design, and transparent about scope. No license fees. No lock-in. The
                apps you build run without ProofKit installed.
              </p>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-8 dark:border-white/10 dark:bg-white/[0.03]">
              <h3 className="font-bold text-xl">Leaving FileMaker entirely</h3>
              <p className="mt-3 text-gray-600 leading-7 dark:text-white/60">
                Sometimes the right move. But it's the highest cost and highest risk path. You're rebuilding security,
                multi-user data, scripting, file system access, and printing from scratch. Real stories of codebases
                collapsing under that weight. ProofKit gives you the safe, staged on-ramp — start inside FileMaker,
                expand from there.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom Line — alternate bg */}
      <section className="bg-gray-50 py-16 dark:bg-gray-950">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-3xl">
            <h2 className="font-bold text-2xl sm:text-3xl">The bottom line</h2>
            <p className="mt-4 text-gray-600 leading-7 dark:text-white/60">
              It's not "ProofKit vs. X" — it's "what are you optimizing for?" If you want agent-first development that
              works with FileMaker instead of against it, ProofKit is the only tool built for that world.
            </p>
          </div>
        </div>
      </section>

      {/* CTA — primary bg */}
      <section className="py-24">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="font-bold text-2xl sm:text-3xl">Try ProofKit free</h2>
            <div className="mt-8">
              <Link
                className="inline-flex h-12 items-center gap-3 rounded-full border border-gray-900 bg-gray-900 px-6 font-semibold text-base text-white shadow-lg transition hover:bg-gray-800 dark:border-white/15 dark:bg-white/[0.06] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_36px_rgba(255,255,255,0.08)] dark:hover:border-white/25 dark:hover:bg-white/[0.1]"
                href="/docs/cli/guides/getting-started"
              >
                <Download className="size-5" />
                Download ProofKit
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
