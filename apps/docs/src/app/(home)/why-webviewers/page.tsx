import { Download, Globe, HardDrive, Lock, Printer, Server, Shield, Wifi } from "lucide-react";
import Link from "next/link";
import DataFlowDiagram from "@/components/DataFlowDiagramLazy";
import { MarketingNav } from "@/components/MarketingNav";
import { MarketingCard, MarketingSection } from "@/components/marketing-section";
import { getMarketingMetadata } from "@/lib/og";

export const metadata = getMarketingMetadata("why-webviewers");

export default function WhyWebviewersPage() {
  return (
    <main className="min-h-screen bg-white text-gray-900 dark:bg-black dark:text-white">
      <MarketingNav />

      {/* Page Header */}
      <section className="py-24 pb-16">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-balance font-bold text-4xl tracking-tight sm:text-5xl md:text-6xl">
              The Hybrid App Advantage
            </h1>
            <p className="mt-6 text-gray-600 text-lg leading-8 dark:text-white/60">
              Web UI in a FileMaker shell — and why that's more powerful than it sounds.
            </p>
          </div>
        </div>
      </section>

      {/* Data Flow Diagram — always dark, tight */}
      <section className="relative isolate overflow-hidden bg-[#080608]">
        <div className="relative aspect-[16/7] w-full">
          <DataFlowDiagram />
        </div>
      </section>

      {/* What is a Hybrid App — alternate bg */}
      <MarketingSection variant="alternate">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-3xl">
            <h2 className="font-bold text-2xl sm:text-3xl">What is a hybrid app?</h2>
            <p className="mt-4 text-gray-600 leading-7 dark:text-white/60">
              A hybrid app renders modern web UI inside a FileMaker Web Viewer. The web layer handles the interface —
              rich interactions, beautiful components, responsive layouts — while FileMaker provides the backend: data,
              security, scripting, and infrastructure.
            </p>
            <p className="mt-4 text-gray-600 leading-7 dark:text-white/60">
              Think of it like Electron, but better. Slack, VS Code, and Figma are all web apps in a native shell. A
              ProofKit hybrid app does the same thing — but with a multi-user database, a security model, and a backend
              included out of the box.
            </p>
          </div>
        </div>
      </MarketingSection>

      {/* Anything a FileMaker Script Can Do — primary bg */}
      <MarketingSection>
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-3xl">
            <p className="font-semibold text-[#D15ABB] text-sm uppercase tracking-[0.2em]">The core idea</p>
            <h2 className="mt-3 font-bold text-2xl sm:text-3xl">Anything a FileMaker script can do</h2>
            <p className="mt-4 text-gray-600 leading-7 dark:text-white/60">
              A Web Viewer app can call FileMaker scripts. That means the modern web UI is not trapped in the browser
              sandbox — it can reach the database, run business logic, generate PDFs, call external APIs, and use the
              local machine through FileMaker.
            </p>
            <MarketingCard className="mt-8">
              <p className="text-balance font-semibold text-xl leading-8">
                You build the interface with web tools. FileMaker remains the secure, scriptable application platform
                underneath it.
              </p>
            </MarketingCard>
          </div>
        </div>
      </MarketingSection>

      {/* What You Inherit for Free — primary bg */}
      <MarketingSection variant="alternate">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-3xl">
            <h2 className="font-bold text-2xl sm:text-3xl">What you inherit for free</h2>
            <p className="mt-4 mb-10 text-gray-600 leading-7 dark:text-white/60">
              By building inside FileMaker, your app gets all of this without writing a single line of infrastructure
              code:
            </p>
          </div>

          <div className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: <Lock className="size-5" />,
                title: "Security",
                desc: "Privilege sets, user accounts, encrypted data at rest.",
              },
              {
                icon: <Server className="size-5" />,
                title: "A secure backend",
                desc: "FileMaker scripts — no secrets exposed in the browser.",
              },
              {
                icon: <Globe className="size-5" />,
                title: "CORS-free network",
                desc: "Access any API without proxy servers or CORS headaches.",
              },
              {
                icon: <HardDrive className="size-5" />,
                title: "File system access",
                desc: "Read and write files on the local machine.",
              },
              {
                icon: <Printer className="size-5" />,
                title: "Printing & PDFs",
                desc: "Use FileMaker's built-in PDF engine.",
              },
              {
                icon: <Wifi className="size-5" />,
                title: "Offline support",
                desc: "Works without a server or internet connection.",
              },
              {
                icon: <Shield className="size-5" />,
                title: "Plugin extensibility",
                desc: "Access the full FileMaker plugin SDK.",
              },
            ].map((item) => (
              <MarketingCard key={item.title} surface="alternate">
                <div className="mb-3 flex size-10 items-center justify-center rounded-full border border-gray-200 bg-gray-100 text-gray-500 dark:border-white/10 dark:bg-white/[0.06] dark:text-white/60">
                  {item.icon}
                </div>
                <h3 className="font-semibold">{item.title}</h3>
                <p className="mt-1 text-gray-500 text-sm dark:text-white/50">{item.desc}</p>
              </MarketingCard>
            ))}
          </div>
        </div>
      </MarketingSection>

      {/* Performance + Staged Adoption — primary bg */}
      <MarketingSection>
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <MarketingCard className="rounded-3xl p-8">
              <h2 className="font-bold text-2xl sm:text-3xl">Faster screens, not just prettier screens</h2>
              <p className="mt-4 text-gray-600 leading-7 dark:text-white/60">
                A lot of FileMaker layout behavior is powered by show/hide logic, conditional formatting, filtered
                portals, sortable portal headers, and unstored calculations. Those patterns work, but they can make the
                database do expensive work just to draw a screen.
              </p>
              <p className="mt-4 text-gray-600 leading-7 dark:text-white/60">
                A Web Viewer can move that presentation logic into the browser, where filtering, sorting, conditional
                rendering, and rich interactions are cheap. The result is often a layout that feels faster and asks less
                of the FileMaker engine.
              </p>
            </MarketingCard>

            <MarketingCard className="rounded-3xl p-8">
              <h2 className="font-bold text-2xl sm:text-3xl">Start with one layout</h2>
              <p className="mt-4 text-gray-600 leading-7 dark:text-white/60">
                You do not have to rewrite your system to get value from a hybrid app. Replace one FileMaker layout with
                a Web Viewer experience, keep the same users, data, security, scripts, and deployment model, then expand
                when the next workflow is ready.
              </p>
              <p className="mt-4 text-gray-600 leading-7 dark:text-white/60">
                That staged path is the practical advantage: modernize the parts of your app that need a better
                interface without putting the whole business system at risk.
              </p>
            </MarketingCard>
          </div>
        </div>
      </MarketingSection>

      {/* Migration Risk — primary bg */}
      <MarketingSection variant="alternate">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-3xl">
            <h2 className="font-bold text-2xl sm:text-3xl">
              AI makes migration easier. It does not make it risk-free.
            </h2>
            <p className="mt-4 text-gray-600 leading-7 dark:text-white/60">
              AI coding tools can dramatically reduce the time it takes to move a complex FileMaker solution to a modern
              web stack. But migration is still migration. You still have to learn new systems, rebuild authentication,
              reproduce permissions, handle files, replace offline workflows, recreate PDF generation, and operate new
              infrastructure.
            </p>
            <p className="mt-4 text-gray-600 leading-7 dark:text-white/60">
              With ProofKit, you do not have to trade all of that working FileMaker capability just to give users the
              interfaces they want. Keep the platform you know. Modernize the experience on top of it.
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
                href="/docs/webviewer/why-webviewers"
              >
                <Download className="size-5" />
                Read the Hybrid Apps Guide
              </Link>
            </div>
          </div>
        </div>
      </MarketingSection>
    </main>
  );
}
