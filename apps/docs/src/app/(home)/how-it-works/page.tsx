import { ArrowRight, Code, Download, Eye, RefreshCw, Server, Zap } from "lucide-react";
import Link from "next/link";
import { MarketingNav } from "@/components/MarketingNav";
import { MarketingCard, MarketingSection } from "@/components/marketing-section";
import { getMarketingMetadata } from "@/lib/og";

export const metadata = getMarketingMetadata("how-it-works");

export default function HowItWorksPage() {
  return (
    <main className="min-h-screen bg-white text-gray-900 dark:bg-black dark:text-white">
      <MarketingNav />

      {/* Page Header */}
      <section className="py-24 pb-16">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-balance font-bold text-4xl tracking-tight sm:text-5xl md:text-6xl">
              How ProofKit Works
            </h1>
            <p className="mt-6 text-gray-600 text-lg leading-8 dark:text-white/60">
              Agent-first architecture — from schema to deployed app in a single session.
            </p>
          </div>
        </div>
      </section>

      {/* What Gets Installed — alternate bg */}
      <MarketingSection variant="alternate">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-3xl">
            <h2 className="font-bold text-2xl sm:text-3xl">What gets installed</h2>
            <p className="mt-4 mb-10 text-gray-600 leading-7 dark:text-white/60">
              ProofKit is four pieces that work together to connect your AI agent to your FileMaker file:
            </p>
          </div>

          <div className="mx-auto max-w-3xl space-y-4">
            {[
              {
                num: "1",
                title: "The Add-on",
                desc: "Installed into your FileMaker file. Provides the Web Viewer and the bridge between your app and FileMaker scripts/data.",
              },
              {
                num: "2",
                title: "The Plug-in",
                desc: "Runs on the machine. Handles communication between the MCP server and the add-on inside FileMaker.",
              },
              {
                num: "3",
                title: "The MCP Server",
                desc: "Exposes your FileMaker schema, scripts, and data to AI agents through the Model Context Protocol.",
              },
              {
                num: "4",
                title: "Agent Integrations",
                desc: "Skills, rules, and context that teach your AI agent how to build ProofKit apps effectively.",
              },
            ].map((piece) => (
              <MarketingCard className="flex gap-4" key={piece.num} surface="alternate">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-gray-100 font-bold text-gray-500 text-sm dark:border-white/10 dark:bg-white/[0.06] dark:text-white/60">
                  {piece.num}
                </div>
                <div>
                  <h3 className="font-semibold">{piece.title}</h3>
                  <p className="mt-1 text-gray-500 text-sm dark:text-white/50">{piece.desc}</p>
                </div>
              </MarketingCard>
            ))}
          </div>
        </div>
      </MarketingSection>

      {/* How the Pieces Connect — primary bg */}
      <MarketingSection>
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-3xl">
            <h2 className="font-bold text-2xl sm:text-3xl">How the pieces connect</h2>
            <p className="mt-4 mb-10 text-gray-600 leading-7 dark:text-white/60">
              A chain from your editor to your FileMaker file:
            </p>
          </div>

          <MarketingCard className="mx-auto max-w-3xl p-8">
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
              {["AI Agent", "MCP Server", "Plug-in", "Add-on", "Your FM File"].map((node, i) => (
                <div className="flex items-center gap-3" key={node}>
                  <div className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-center font-medium text-gray-700 text-sm dark:border-white/10 dark:bg-white/[0.06] dark:text-white/80">
                    {node}
                  </div>
                  {i < 4 && <ArrowRight className="hidden size-4 text-gray-300 sm:block dark:text-white/30" />}
                </div>
              ))}
            </div>
          </MarketingCard>
        </div>
      </MarketingSection>

      {/* The Feedback Loop — alternate bg */}
      <MarketingSection variant="alternate">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-3xl">
            <h2 className="font-bold text-2xl sm:text-3xl">The feedback loop</h2>
            <p className="mt-4 text-gray-600 leading-7 dark:text-white/60">
              This is what makes ProofKit different from "just using ChatGPT to write code." The agent doesn't just
              write — it deploys, verifies in a real browser, sees what it built, and can inspect, iterate, and fix
              common issues in the same loop.
            </p>

            <MarketingCard className="mt-8" surface="alternate">
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  { icon: <Server className="size-4" />, label: "Read your schema and understand your data" },
                  { icon: <Code className="size-4" />, label: "Generate app code from real project context" },
                  { icon: <Zap className="size-4" />, label: "Deploy into FileMaker with one command" },
                  { icon: <Eye className="size-4" />, label: "Open the app in a real browser" },
                  { icon: <RefreshCw className="size-4" />, label: "Spot and fix common issues" },
                ].map((step) => (
                  <div className="flex items-center gap-3" key={step.label}>
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-gray-100 text-gray-500 dark:border-white/10 dark:bg-white/[0.06] dark:text-white/60">
                      {step.icon}
                    </div>
                    <span className="text-gray-600 text-sm dark:text-white/70">{step.label}</span>
                  </div>
                ))}
              </div>
            </MarketingCard>
          </div>
        </div>
      </MarketingSection>

      {/* Type Safety — primary bg */}
      <MarketingSection>
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-3xl">
            <h2 className="font-bold text-2xl sm:text-3xl">TypeGen and type safety</h2>
            <p className="mt-4 text-gray-600 leading-7 dark:text-white/60">
              The agent can work from the shape of your data at compile time. TypeGen reads your FileMaker schema and
              generates TypeScript types — field names, value lists, relationships. Many field-name mistakes are caught
              before you run the app.
            </p>
          </div>
        </div>
      </MarketingSection>

      {/* The Stack — alternate bg */}
      <MarketingSection variant="alternate">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-3xl">
            <h2 className="font-bold text-2xl sm:text-3xl">The opinionated stack</h2>
            <p className="mt-4 text-gray-600 leading-7 dark:text-white/60">
              ProofKit ships with a curated set of tools that AI agents work best with:
            </p>
            <ul className="mt-6 space-y-3 text-gray-600 dark:text-white/60">
              <li className="flex items-start gap-3">
                <span className="mt-1.5 block size-1.5 shrink-0 rounded-full bg-gray-400 dark:bg-white/40" />
                <span>
                  <strong className="text-gray-900 dark:text-white">React + TypeScript</strong> — the language models
                  know best
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1.5 block size-1.5 shrink-0 rounded-full bg-gray-400 dark:bg-white/40" />
                <span>
                  <strong className="text-gray-900 dark:text-white">shadcn/ui</strong> — beautiful, accessible component
                  library
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1.5 block size-1.5 shrink-0 rounded-full bg-gray-400 dark:bg-white/40" />
                <span>
                  <strong className="text-gray-900 dark:text-white">TanStack Query + Router</strong> — caching, routing,
                  and data fetching
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1.5 block size-1.5 shrink-0 rounded-full bg-gray-400 dark:bg-white/40" />
                <span>
                  <strong className="text-gray-900 dark:text-white">Vite</strong> — lightning-fast builds and hot reload
                </span>
              </li>
            </ul>
            <p className="mt-6 text-gray-500 text-sm dark:text-white/50">
              Already using Svelte, Vue, or another framework? ProofKit can accommodate your existing stack too.
            </p>
          </div>
        </div>
      </MarketingSection>

      {/* CTA — primary bg */}
      <MarketingSection className="py-24">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="font-bold text-2xl sm:text-3xl">Ready to try it?</h2>
            <div className="mt-8">
              <Link
                className="inline-flex h-12 items-center gap-3 rounded-full border border-gray-900 bg-gray-900 px-6 font-semibold text-base text-white shadow-lg transition hover:bg-gray-800 dark:border-white/15 dark:bg-white/[0.06] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_36px_rgba(255,255,255,0.08)] dark:hover:border-white/25 dark:hover:bg-white/[0.1]"
                href="/docs/ai/agent-workflow"
              >
                <Download className="size-5" />
                Read the Agent Workflow
              </Link>
            </div>
          </div>
        </div>
      </MarketingSection>
    </main>
  );
}
