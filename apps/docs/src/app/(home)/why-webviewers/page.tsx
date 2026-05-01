import { Download, Globe, HardDrive, Lock, Printer, Server, Shield, Wifi } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import DataFlowDiagram from "@/components/DataFlowDiagramLazy";
import { LargeSearchToggle } from "@/components/search-toggle";
import { ThemeToggle } from "@/components/theme-toggle";

export default function WhyWebviewersPage() {
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
      <section className="bg-gray-50 py-16 dark:bg-gray-950">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-3xl">
            <h2 className="font-bold text-2xl sm:text-3xl">What is a hybrid app?</h2>
            <p className="mt-4 text-gray-600 leading-7 dark:text-white/60">
              A hybrid app renders modern web UI inside a FileMaker WebViewer. The web layer handles the interface —
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
      </section>

      {/* What You Inherit for Free — primary bg */}
      <section className="py-16">
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
              <div
                className="rounded-2xl border border-gray-200 bg-gray-50 p-6 dark:border-white/10 dark:bg-white/[0.03]"
                key={item.title}
              >
                <div className="mb-3 flex size-10 items-center justify-center rounded-full border border-gray-200 bg-gray-100 text-gray-500 dark:border-white/10 dark:bg-white/[0.06] dark:text-white/60">
                  {item.icon}
                </div>
                <h3 className="font-semibold">{item.title}</h3>
                <p className="mt-1 text-gray-500 text-sm dark:text-white/50">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What You'd Have to Build — alternate bg */}
      <section className="bg-gray-50 py-16 dark:bg-gray-950">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-3xl">
            <h2 className="font-bold text-2xl sm:text-3xl">What you'd have to build yourself if you left</h2>
            <p className="mt-4 text-gray-600 leading-7 dark:text-white/60">
              Leaving FileMaker means rebuilding every one of those capabilities from scratch — authentication,
              role-based access, a secure API layer, file handling, offline sync, PDF generation. It's months of
              infrastructure work before you write your first feature.
            </p>
            <p className="mt-4 text-gray-600 leading-7 dark:text-white/60">
              With ProofKit, you skip all of that. FileMaker already solved those problems. You just build the UI.
            </p>
          </div>
        </div>
      </section>

      {/* CTA — primary bg */}
      <section className="py-24">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="font-bold text-2xl sm:text-3xl">Ready to try it?</h2>
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
