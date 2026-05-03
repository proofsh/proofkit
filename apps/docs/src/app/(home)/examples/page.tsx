import { Download } from "lucide-react";
import Link from "next/link";
import { ExamplesGallery } from "@/components/examples/ExamplesGallery";
import { MarketingNav } from "@/components/MarketingNav";
import { ShadcnPresetThemes } from "@/components/ShadcnPresetThemes";

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

const featuredExamples = examples.slice(0, 6);
const morePatternExamples = examples.slice(6);

export default function ExamplesPage() {
  return (
    <main className="min-h-screen bg-white text-gray-900 dark:bg-black dark:text-white">
      <MarketingNav />

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
          <div className="mb-8 max-w-2xl">
            <p className="font-semibold text-[#D15ABB] text-sm uppercase tracking-[0.18em]">Featured examples</p>
            <h2 className="mt-3 font-bold text-2xl tracking-tight sm:text-3xl">Start with complete app patterns</h2>
            <p className="mt-3 text-gray-600 leading-7 dark:text-white/60">
              These examples show the richest FileMaker web viewer experiences: record workspaces, approval flows,
              document management, inventory, and power-user command surfaces.
            </p>
          </div>
          <ExamplesGallery examples={featuredExamples} />

          <div className="mt-16 border-gray-200 border-t pt-12 dark:border-white/10">
            <div className="mb-8 max-w-2xl">
              <p className="font-semibold text-gray-500 text-sm uppercase tracking-[0.18em] dark:text-white/40">
                More patterns
              </p>
              <h2 className="mt-3 font-bold text-2xl tracking-tight sm:text-3xl">Explore focused UI building blocks</h2>
              <p className="mt-3 text-gray-600 leading-7 dark:text-white/60">
                Use these as reusable patterns for scheduling, dashboards, reporting, kanban workflows, and dense data
                browsing.
              </p>
            </div>
            <ExamplesGallery examples={morePatternExamples} />
          </div>
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
