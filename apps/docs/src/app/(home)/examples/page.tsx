import { Download } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { LargeSearchToggle } from "@/components/search-toggle";
import { ThemeToggle } from "@/components/theme-toggle";

const examples = [
  {
    title: "Sales Dashboard",
    desc: "Charts, KPIs, and filters. Pulls data via Execute Data API.",
    buildTime: "~15 minutes with an agent",
  },
  {
    title: "Kanban Board",
    desc: "Drag-and-drop project management. Updates records via FileMaker scripts.",
    buildTime: "~20 minutes with an agent",
  },
  {
    title: "Interactive Calendar",
    desc: "Drag-and-drop scheduling. Syncs with FileMaker date fields.",
    buildTime: "~15 minutes with an agent",
  },
  {
    title: "Data Grid",
    desc: "Sorting, filtering, inline editing. Powered by TanStack Table.",
    buildTime: "~10 minutes with an agent",
  },
  {
    title: "Customer Portal",
    desc: "Modern navigation, detail views, tabbed interfaces.",
    buildTime: "~25 minutes with an agent",
  },
  {
    title: "Rich Form",
    desc: "Date pickers, accordions, disclosure panels, validation.",
    buildTime: "~10 minutes with an agent",
  },
];

export default function ExamplesPage() {
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
              What You Can Build
            </h1>
            <p className="mt-6 text-gray-600 text-lg leading-8 dark:text-white/60">
              Real examples of modern web UI running inside FileMaker — all built with an AI agent and ProofKit.
            </p>
          </div>
        </div>
      </section>

      {/* Examples Gallery — alternate bg */}
      <section className="bg-gray-50 py-16 dark:bg-gray-950">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {examples.map((example) => (
              <div
                className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/10 dark:bg-white/[0.03]"
                key={example.title}
              >
                <div className="flex aspect-video items-center justify-center border-gray-100 border-b bg-gray-50 dark:border-white/10 dark:bg-white/[0.02]">
                  <span className="text-gray-400 text-sm dark:text-white/25">[Screenshot: {example.title}]</span>
                </div>
                <div className="p-5">
                  <h3 className="font-semibold">{example.title}</h3>
                  <p className="mt-1 text-gray-500 text-sm dark:text-white/50">{example.desc}</p>
                  <p className="mt-3 text-gray-400 text-xs dark:text-white/35">{example.buildTime}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Before & After — primary bg */}
      <section className="py-16">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="font-bold text-2xl sm:text-3xl">Before and after</h2>
            <p className="mt-4 text-gray-600 leading-7 dark:text-white/60">
              The same workflow — native FileMaker layout vs. ProofKit WebViewer.
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/10 dark:bg-white/[0.03]">
              <div className="flex aspect-video items-center justify-center bg-gray-50 dark:bg-white/[0.02]">
                <span className="text-gray-400 text-sm dark:text-white/25">[Before: Native FM Layout]</span>
              </div>
              <div className="p-4 text-center">
                <p className="font-medium text-gray-500 text-sm dark:text-white/50">Native FileMaker Layout</p>
              </div>
            </div>
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/10 dark:bg-white/[0.03]">
              <div className="flex aspect-video items-center justify-center bg-gray-50 dark:bg-white/[0.02]">
                <span className="text-gray-400 text-sm dark:text-white/25">[After: ProofKit WebViewer]</span>
              </div>
              <div className="p-4 text-center">
                <p className="font-medium text-gray-500 text-sm dark:text-white/50">ProofKit WebViewer</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA — alternate bg */}
      <section className="bg-gray-50 py-24 dark:bg-gray-950">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="font-bold text-2xl sm:text-3xl">Ready to build your own?</h2>
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
