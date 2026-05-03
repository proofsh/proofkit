import { Download } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { ExamplesGallery } from "@/components/examples/ExamplesGallery";
import { ShadcnPresetThemes } from "@/components/ShadcnPresetThemes";
import { LargeSearchToggle } from "@/components/search-toggle";
import { ThemeToggle } from "@/components/theme-toggle";

const examples: {
  desc: string;
  liveExampleId?: string;
  title: string;
}[] = [
  {
    title: "Customer Workspace",
    desc: "Record detail views with tabs, timelines, related contacts, notes, and files.",
    liveExampleId: "customer-workspace",
  },
  {
    title: "Rich Record Form",
    desc: "Validated forms with sections, conditional fields, save states, and review panels.",
    liveExampleId: "rich-record-form",
  },
  {
    title: "Approval Inbox",
    desc: "Review requests, approve or reject changes, comment, and inspect status history.",
    liveExampleId: "approval-inbox",
  },
  {
    title: "Document Center",
    desc: "File cards, preview panels, tags, attachment metadata, and document actions.",
    liveExampleId: "document-center",
  },
  {
    title: "Inventory Tracker",
    desc: "Stock levels, reorder alerts, bin locations, and adjustment workflows.",
    liveExampleId: "inventory-tracker",
  },
  {
    title: "Command Center",
    desc: "Global search, command palette, recent records, and quick actions for power users.",
    liveExampleId: "command-center",
  },
  {
    title: "Service Dispatch",
    desc: "Map-like technician assignments, appointment status, route notes, and job updates.",
    liveExampleId: "service-dispatch",
  },
  {
    title: "Reporting Builder",
    desc: "Saved report views, grouped metrics, export actions, and configurable chart blocks.",
    liveExampleId: "reporting-builder",
  },
  {
    title: "Dashboard with Charts",
    desc: "KPIs, trend charts, pipeline mix, and executive reporting views.",
    liveExampleId: "dashboard-with-charts",
  },
  {
    title: "Kanban Board",
    desc: "Drag-and-drop project management for deals, tasks, and service queues.",
    liveExampleId: "kanban-board",
  },
  {
    title: "Interactive Calendar",
    desc: "Drag-and-drop scheduling with event details, filters, and editable agenda cards.",
    liveExampleId: "interactive-calendar",
  },
  {
    title: "Data Grid with Filtering",
    desc: "Search, filters, column visibility, and dense record browsing.",
    liveExampleId: "data-grid",
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
              Examples of modern web UI you can build for FileMaker with Agentic Coding and a modern web stack.
            </p>
          </div>
        </div>
      </section>

      {/* Examples Gallery — alternate bg */}
      <section className="bg-gray-50 py-16 dark:bg-gray-950">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <ExamplesGallery examples={examples} />
        </div>
      </section>

      <ShadcnPresetThemes />

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
