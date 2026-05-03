import {
  ArrowRight,
  Bot,
  Code,
  Download,
  Eye,
  Gift,
  Layers,
  LayoutGrid,
  RefreshCw,
  Route,
  Server,
  Shield,
  Sparkles,
  Zap,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import DarkVeil from "@/components/DarkVeil";
import { ExampleShowcaseGrid } from "@/components/examples/ExampleShowcaseGrid";
import { MarketingCard, MarketingSection } from "@/components/marketing-section";
import { ProofkitLogo } from "@/components/ProofkitLogo";
import { ProofLogo } from "@/components/ProofLogo";
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
    <main className="min-h-screen bg-white text-gray-900 dark:bg-black dark:text-white">
      {/* Hero — always dark */}
      <section className="relative isolate min-h-[75vh] overflow-hidden bg-black text-white">
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

        <div className="relative z-10 mx-auto flex min-h-[75vh] w-full max-w-6xl flex-col px-4 py-6 sm:px-6">
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
                <Link className="font-medium text-sm text-white/55 transition hover:text-white" href="/why-proofkit">
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

          <div className="flex flex-1 flex-col pt-12 text-center">
            <div className="flex flex-1 items-center justify-center pb-10">
              <div className="mx-auto max-w-3xl">
                <div className="mb-8 inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.06] p-1 pr-4 text-sm text-white/55 shadow-purple-950/20 shadow-xl backdrop-blur-md">
                  <span className="rounded-full bg-white px-3 py-1 font-bold text-black text-xs">NEW</span>
                  MCP Server connects to your file.
                </div>

                <h1 className="text-balance font-bold text-5xl tracking-tight sm:text-6xl md:text-7xl">
                  Build modern FileMaker UIs with AI.
                </h1>

                <p className="mx-auto mt-6 max-w-2xl text-lg text-white/60 leading-8">
                  ProofKit helps you create modern web interfaces for FileMaker without becoming a web developer first.
                  It connects your AI agent to your file, gives it the intelligence it needs, and closes the loop so it
                  can write, test, fix, and deploy interfaces that fit your app.
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

            <div className="pb-2">
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

      {/* Section 2: The UI Ceiling Disappears — primary bg */}
      {/* Hero curve sweeping down */}
      <div aria-hidden="true" className="h-12 rounded-b-[50%] bg-black" />

      <section className="relative pt-6 pb-24 sm:pt-8 sm:pb-32">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-balance font-bold text-3xl tracking-tight sm:text-4xl md:text-5xl">
              Build any UI you can imagine — inside FileMaker.
            </h2>
            <p className="mt-6 text-gray-600 text-lg leading-8 dark:text-white/60">
              Native FileMaker layouts have limits. ProofKit removes them. Anything you can build on the web — kanban
              boards, interactive calendars, data grids, dashboards, drag-and-drop interfaces — now runs inside a
              FileMaker WebViewer.
            </p>
          </div>

          <ExampleShowcaseGrid />

          <div className="mt-10 text-center">
            <Link
              className="inline-flex items-center gap-2 font-medium text-gray-500 text-sm transition hover:text-gray-900 dark:text-white/60 dark:hover:text-white"
              href="/examples"
            >
              See more examples
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Section 3: The Agent Does the Work — alternate bg */}
      <MarketingSection className="py-24 sm:py-32" variant="alternate">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="grid items-center gap-16 lg:grid-cols-2">
            <div>
              <h2 className="text-balance font-bold text-3xl tracking-tight sm:text-4xl md:text-5xl">
                Your AI agent reads your FileMaker file, writes the code, and deploys it.
              </h2>
              <p className="mt-6 text-gray-600 text-lg leading-8 dark:text-white/60">
                The agent reads your schema through MCP, generates a working app, deploys it into your file, opens it in
                a real browser, catches its own mistakes, and self-corrects. No copy-paste. No shepherding.
              </p>
              <Link
                className="mt-8 inline-flex items-center gap-2 font-medium text-gray-500 text-sm transition hover:text-gray-900 dark:text-white/60 dark:hover:text-white"
                href="/how-it-works"
              >
                How it works
                <ArrowRight className="size-4" />
              </Link>
            </div>

            <MarketingCard className="flex flex-col gap-3 p-8" surface="alternate">
              {[
                { icon: <Server className="size-5" />, label: "Read Schema" },
                { icon: <Code className="size-5" />, label: "Write Code" },
                { icon: <Zap className="size-5" />, label: "Deploy" },
                { icon: <Eye className="size-5" />, label: "Verify in Browser" },
                { icon: <RefreshCw className="size-5" />, label: "Fix & Iterate" },
              ].map((step, i) => (
                <div className="flex items-center gap-4" key={step.label}>
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-gray-100 text-gray-500 dark:border-white/10 dark:bg-white/[0.06] dark:text-white/60">
                    {step.icon}
                  </div>
                  <span className="font-medium text-gray-700 dark:text-white/80">{step.label}</span>
                  {i < 4 && <div className="ml-auto text-gray-300 dark:text-white/20">↓</div>}
                </div>
              ))}
            </MarketingCard>
          </div>
        </div>
      </MarketingSection>

      {/* Section 4: Everything You Need, Ready to Go — primary bg */}
      <section className="py-24 sm:py-32">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-balance font-bold text-3xl tracking-tight sm:text-4xl md:text-5xl">
              An opinionated stack — so you can focus on your app, not your toolchain.
            </h2>
          </div>

          <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: <Code className="size-5" />,
                title: "React + TypeScript",
                desc: "The foundation agents know best.",
              },
              {
                icon: <Layers className="size-5" />,
                title: "shadcn/ui",
                desc: "Beautiful, accessible components with dark/light mode.",
              },
              {
                icon: <Route className="size-5" />,
                title: "Multi-page routing",
                desc: "Sidebar nav, detail views, dashboards in one app.",
              },
              {
                icon: <RefreshCw className="size-5" />,
                title: "Intelligent caching",
                desc: "TanStack Query keeps your UI in sync without hammering the server.",
              },
              {
                icon: <Shield className="size-5" />,
                title: "Type-safe data",
                desc: "TypeGen generates types from your actual FileMaker schema.",
              },
              {
                icon: <Zap className="size-5" />,
                title: "One-command deploy",
                desc: "Bundle and ship into your FileMaker file.",
              },
            ].map((feature) => (
              <MarketingCard key={feature.title}>
                <div className="mb-3 flex size-10 items-center justify-center rounded-full border border-gray-200 bg-gray-100 text-gray-500 dark:border-white/10 dark:bg-white/[0.06] dark:text-white/60">
                  {feature.icon}
                </div>
                <h3 className="font-semibold">{feature.title}</h3>
                <p className="mt-1 text-gray-500 text-sm dark:text-white/50">{feature.desc}</p>
              </MarketingCard>
            ))}
          </div>
        </div>
      </section>

      {/* Section 5: It's Free + Start in Stages — alternate bg */}
      <MarketingSection className="py-24 sm:py-32" variant="alternate">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="grid gap-8 lg:grid-cols-2">
            <MarketingCard className="p-8 sm:p-10" surface="alternate">
              <div className="mb-4 flex size-10 items-center justify-center rounded-full border border-gray-200 bg-gray-100 text-gray-500 dark:border-white/10 dark:bg-white/[0.06] dark:text-white/60">
                <Gift className="size-5" />
              </div>
              <h3 className="font-bold text-2xl sm:text-3xl">Free. No catch.</h3>
              <p className="mt-4 text-gray-600 leading-7 dark:text-white/60">
                ProofKit is free to download, free to use, and the apps you build are yours. You don't even need
                ProofKit installed to run what you deploy. The only cost is your AI agent subscription.
              </p>
            </MarketingCard>

            <MarketingCard className="p-8 sm:p-10" surface="alternate">
              <div className="mb-4 flex size-10 items-center justify-center rounded-full border border-gray-200 bg-gray-100 text-gray-500 dark:border-white/10 dark:bg-white/[0.06] dark:text-white/60">
                <LayoutGrid className="size-5" />
              </div>
              <h3 className="font-bold text-2xl sm:text-3xl">Replace one layout. Then go from there.</h3>
              <p className="mt-4 text-gray-600 leading-7 dark:text-white/60">
                Start by replacing a single FileMaker layout with a WebViewer app — low risk, security inherited, no
                infrastructure changes. When you're ready, progress to full web apps with a FileMaker backend. Each step
                builds on the last.
              </p>
              <Link
                className="mt-6 inline-flex items-center gap-2 font-medium text-gray-500 text-sm transition hover:text-gray-900 dark:text-white/60 dark:hover:text-white"
                href="/why-webviewers"
              >
                Why WebViewers?
                <ArrowRight className="size-4" />
              </Link>
            </MarketingCard>
          </div>
        </div>
      </MarketingSection>

      {/* Section 6: Community & Closing CTA — primary bg */}
      <section className="relative py-24 sm:py-32">
        <div className="absolute -top-20 left-1/2 h-64 w-[60%] -translate-x-1/2 rounded-full bg-[#D15ABB]/10 blur-3xl dark:bg-[#D15ABB]/15" />

        <div className="relative mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <ProofkitLogo className="mx-auto mb-8 block h-auto w-52 sm:w-64" />
            <h2 className="text-balance font-bold text-3xl tracking-tight sm:text-4xl md:text-5xl">
              Build like anything is possible again.
            </h2>
            <p className="mx-auto mt-6 max-w-2xl text-gray-600 text-lg leading-8 dark:text-white/60">
              FileMaker gave a generation of problem-solvers the power to build the systems they imagined. ProofKit
              brings that same creative momentum into the AI coding era.
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                className="inline-flex h-12 items-center gap-3 rounded-full border border-gray-900 bg-gray-900 px-6 font-semibold text-base text-white shadow-lg transition hover:bg-gray-800 dark:border-white/15 dark:bg-white/[0.06] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_36px_rgba(255,255,255,0.08)] dark:hover:border-white/25 dark:hover:bg-white/[0.1]"
                href="/docs/cli/guides/getting-started"
              >
                <Download className="size-5" />
                Download for macOS
              </Link>
              <Link
                className="inline-flex h-12 items-center gap-3 rounded-full border border-gray-300 bg-white px-6 font-semibold text-base text-gray-700 transition hover:border-gray-400 hover:text-gray-900 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/70 dark:hover:border-white/20 dark:hover:text-white"
                href="https://community.ottomatic.cloud/c/proofkit"
              >
                Join the Community
              </Link>
            </div>

            <div className="mt-16 flex flex-col items-center gap-0 border-gray-200 border-t pt-10 dark:border-white/10">
              <p className="font-semibold text-[0.68rem] text-gray-400 uppercase tracking-[0.36em] dark:text-white/35">
                Made by
              </p>
              <ProofLogo className="block h-auto w-24 sm:w-28" />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
