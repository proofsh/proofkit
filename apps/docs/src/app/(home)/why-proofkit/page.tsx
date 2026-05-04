import { Download } from "lucide-react";
import Link from "next/link";
import { MarketingNav } from "@/components/MarketingNav";
import { MarketingCard, MarketingSection } from "@/components/marketing-section";

export default function WhyProofkitPage() {
  return (
    <main className="min-h-screen bg-white text-gray-900 dark:bg-black dark:text-white">
      <MarketingNav />

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
      <MarketingSection variant="alternate">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-3xl">
            <h2 className="font-bold text-2xl sm:text-3xl">The shift that changes everything</h2>
            <p className="mt-4 text-gray-600 leading-7 dark:text-white/60">
              AI agents don't just help you write code faster — they shift the problem. The bottleneck isn't typing
              speed or syntax knowledge. It's giving the agent enough context, feedback, and deployment access to be
              useful. ProofKit is built around those needs.
            </p>
          </div>
        </div>
      </MarketingSection>

      {/* Comparison sections — primary bg */}
      <MarketingSection>
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-4xl space-y-8">
            <MarketingCard className="p-8">
              <h3 className="font-bold text-xl">Hand-rolled WebViewers</h3>
              <p className="mt-3 text-gray-600 leading-7 dark:text-white/60">
                Works — but every iteration is a copy-paste cycle. You write the code, manually bundle it, paste it into
                a FileMaker field or file, refresh the Web Viewer, and check. No agent feedback loop. No type safety. No
                self-correction. It's 2015-era workflow with 2026-era tools sitting unused.
              </p>
            </MarketingCard>

            <MarketingCard className="p-8">
              <h3 className="font-bold text-xl">Pre-agentic FileMaker web frameworks</h3>
              <p className="mt-3 text-gray-600 leading-7 dark:text-white/60">
                Good for their era. But they were designed for humans writing code by hand — not for agents that need
                schema access through MCP, automated deployment, and visual verification in a real browser. The problem
                has moved.
              </p>
            </MarketingCard>

            <MarketingCard className="p-8">
              <h3 className="font-bold text-xl">Commercial tools</h3>
              <p className="mt-3 text-gray-600 leading-7 dark:text-white/60">
                ProofKit is free, agent-first by design, and transparent about scope. No license fees. No lock-in. The
                apps you build run without ProofKit installed.
              </p>
            </MarketingCard>

            <MarketingCard className="p-8">
              <h3 className="font-bold text-xl">Leaving FileMaker entirely</h3>
              <p className="mt-3 text-gray-600 leading-7 dark:text-white/60">
                Sometimes the right move. But it's the highest cost and highest risk path. You're rebuilding security,
                multi-user data, scripting, file system access, and printing from scratch. Real stories of codebases
                collapsing under that weight. ProofKit gives you the safe, staged on-ramp — start inside FileMaker,
                expand from there.
              </p>
            </MarketingCard>
          </div>
        </div>
      </MarketingSection>

      {/* Bottom Line — alternate bg */}
      <MarketingSection variant="alternate">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-3xl">
            <h2 className="font-bold text-2xl sm:text-3xl">The bottom line</h2>
            <p className="mt-4 text-gray-600 leading-7 dark:text-white/60">
              It's not "ProofKit vs. X" — it's "what are you optimizing for?" If you want agent-first development that
              works with FileMaker instead of against it, ProofKit is built for that world.
            </p>
          </div>
        </div>
      </MarketingSection>

      {/* CTA — primary bg */}
      <MarketingSection className="py-24">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="font-bold text-2xl sm:text-3xl">Try ProofKit free</h2>
            <div className="mt-8">
              <Link
                className="inline-flex h-12 items-center gap-3 rounded-full border border-gray-900 bg-gray-900 px-6 font-semibold text-base text-white shadow-lg transition hover:bg-gray-800 dark:border-white/15 dark:bg-white/[0.06] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_36px_rgba(255,255,255,0.08)] dark:hover:border-white/25 dark:hover:bg-white/[0.1]"
                href="/docs/ai/getting-started"
              >
                <Download className="size-5" />
                Download ProofKit
              </Link>
            </div>
          </div>
        </div>
      </MarketingSection>
    </main>
  );
}
