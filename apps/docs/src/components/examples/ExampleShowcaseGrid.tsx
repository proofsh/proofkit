"use client";

import { ArrowUpRight, X } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { ApprovalInbox } from "@/components/examples/ApprovalInbox";
import { CommandCenter } from "@/components/examples/CommandCenter";
import { CustomerWorkspace } from "@/components/examples/CustomerWorkspace";
import { DashboardWithCharts } from "@/components/examples/DashboardWithCharts";
import { DataGridWithFiltering } from "@/components/examples/DataGridWithFiltering";
import { DesktopWindowFrame } from "@/components/examples/DesktopWindowFrame";
import { DocumentCenter } from "@/components/examples/DocumentCenter";
import { InteractiveCalendar } from "@/components/examples/InteractiveCalendar";
import { InventoryTracker } from "@/components/examples/InventoryTracker";
import { KanbanBoard } from "@/components/examples/KanbanBoard";
import { ReportingBuilder } from "@/components/examples/ReportingBuilder";
import { RichRecordForm } from "@/components/examples/RichRecordForm";
import { ServiceDispatch } from "@/components/examples/ServiceDispatch";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface LiveExample {
  description: string;
  id: string;
  modalDescription: string;
  render: (options: { interactive: boolean }) => ReactNode;
  title: string;
  windowTitle?: string;
}

interface PlaceholderExample {
  id: string;
  placeholder: true;
  title: string;
}

type Example = LiveExample | PlaceholderExample;

export const liveExamples: LiveExample[] = [
  {
    id: "customer-workspace",
    title: "Customer workspace",
    description: "Click to explore related records and notes",
    modalDescription: "A full-size FileMaker Web Viewer customer workspace example.",
    windowTitle: "proofkit-accounts.fmp12",
    render: ({ interactive }) => <CustomerWorkspace interactive={interactive} />,
  },
  {
    id: "rich-record-form",
    title: "Rich record form",
    description: "Click to edit a guided record form",
    modalDescription: "A full-size FileMaker Web Viewer rich record form example.",
    windowTitle: "proofkit-intake.fmp12",
    render: ({ interactive }) => <RichRecordForm interactive={interactive} />,
  },
  {
    id: "approval-inbox",
    title: "Approval inbox",
    description: "Click to review and approve requests",
    modalDescription: "A full-size FileMaker Web Viewer approval inbox example.",
    windowTitle: "proofkit-approvals.fmp12",
    render: ({ interactive }) => <ApprovalInbox interactive={interactive} />,
  },
  {
    id: "document-center",
    title: "Document center",
    description: "Click to preview files and metadata",
    modalDescription: "A full-size FileMaker Web Viewer document center example.",
    windowTitle: "proofkit-documents.fmp12",
    render: ({ interactive }) => <DocumentCenter interactive={interactive} />,
  },
  {
    id: "inventory-tracker",
    title: "Inventory tracker",
    description: "Click to adjust stock and reorder points",
    modalDescription: "A full-size FileMaker Web Viewer inventory tracker example.",
    windowTitle: "proofkit-inventory.fmp12",
    render: ({ interactive }) => <InventoryTracker interactive={interactive} />,
  },
  {
    id: "command-center",
    title: "Command center",
    description: "Click to search records and run actions",
    modalDescription: "A full-size FileMaker Web Viewer command center example.",
    windowTitle: "proofkit-command.fmp12",
    render: ({ interactive }) => <CommandCenter interactive={interactive} />,
  },
  {
    id: "service-dispatch",
    title: "Service dispatch",
    description: "Click to manage routes and job status",
    modalDescription: "A full-size FileMaker Web Viewer service dispatch example.",
    windowTitle: "proofkit-dispatch.fmp12",
    render: ({ interactive }) => <ServiceDispatch interactive={interactive} />,
  },
  {
    id: "reporting-builder",
    title: "Reporting builder",
    description: "Click to configure reports and charts",
    modalDescription: "A full-size FileMaker Web Viewer reporting builder example.",
    windowTitle: "proofkit-reports.fmp12",
    render: ({ interactive }) => <ReportingBuilder interactive={interactive} />,
  },
  {
    id: "dashboard-with-charts",
    title: "Dashboard with charts",
    description: "Click to expand the live component",
    modalDescription: "A full-size FileMaker Web Viewer dashboard example.",
    windowTitle: "proofkit-crm.fmp12",
    render: () => <DashboardWithCharts />,
  },
  {
    id: "data-grid",
    title: "Data grid with filtering",
    description: "Click to explore the filtered records view",
    modalDescription: "A full-size FileMaker Web Viewer data grid example.",
    windowTitle: "proofkit-contacts.fmp12",
    render: ({ interactive }) => <DataGridWithFiltering interactive={interactive} />,
  },
  {
    id: "kanban-board",
    title: "Kanban board",
    description: "Click to move cards across stages",
    modalDescription: "A full-size FileMaker Web Viewer Kanban board example.",
    windowTitle: "proofkit-projects.fmp12",
    render: ({ interactive }) => <KanbanBoard interactive={interactive} />,
  },
  {
    id: "interactive-calendar",
    title: "Interactive calendar",
    description: "Click to manage a customer schedule",
    modalDescription: "A full-size FileMaker Web Viewer calendar example.",
    windowTitle: "proofkit-schedule.fmp12",
    render: ({ interactive }) => <InteractiveCalendar interactive={interactive} />,
  },
];

const homepageExampleIds = ["dashboard-with-charts", "kanban-board", "interactive-calendar", "data-grid"] as const;

const examples: Example[] = homepageExampleIds.flatMap((id) => {
  const example = liveExamples.find((liveExample) => liveExample.id === id);

  return example ? [example] : [];
});

function isLiveExample(example: Example): example is LiveExample {
  return !("placeholder" in example);
}

export function ExampleShowcaseGrid() {
  const [openExampleId, setOpenExampleId] = useState<string | null>(null);
  const openExample = examples.find((example) => example.id === openExampleId);

  useEffect(() => {
    if (!openExampleId) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenExampleId(null);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [openExampleId]);

  return (
    <>
      <div className="mx-auto mt-16 grid max-w-5xl gap-8 sm:grid-cols-2">
        {examples.map((example) =>
          isLiveExample(example) ? (
            <ExamplePreviewCard example={example} key={example.id} onOpen={() => setOpenExampleId(example.id)} />
          ) : (
            <ExamplePlaceholderCard example={example} key={example.id} />
          ),
        )}
      </div>

      {openExample && isLiveExample(openExample) && (
        <ExampleLightbox example={openExample} onClose={() => setOpenExampleId(null)} />
      )}
    </>
  );
}

interface ExamplePreviewCardProps {
  example: LiveExample;
  onOpen: () => void;
}

function ExamplePreviewCard({ example, onOpen }: ExamplePreviewCardProps) {
  return (
    <div className="group relative aspect-video overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 text-left shadow-sm transition hover:-translate-y-1 hover:border-[#D15ABB]/40 hover:shadow-[#D15ABB]/10 hover:shadow-xl dark:border-white/10 dark:bg-white/[0.03]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(209,90,187,0.18),transparent_38%)]" />
      <div className="absolute top-5 left-5 origin-top-left scale-[0.4] transition duration-300 group-hover:scale-[0.42] sm:scale-[0.37] sm:group-hover:scale-[0.39] lg:scale-[0.43] lg:group-hover:scale-[0.45]">
        <DesktopWindowFrame className="shadow-2xl" title={example.windowTitle}>
          {example.render({ interactive: false })}
        </DesktopWindowFrame>
      </div>
      <button
        aria-label={`Open ${example.title} example`}
        className="absolute inset-0 z-10 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D15ABB] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-black"
        onClick={onOpen}
        type="button"
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-end justify-between gap-4 bg-gradient-to-t from-white via-white/90 to-transparent p-5 pt-20 dark:from-black dark:via-black/85">
        <div>
          <div className="font-semibold text-gray-900 dark:text-white">{example.title}</div>
          <div className="mt-1 text-gray-500 text-sm dark:text-white/55">{example.description}</div>
        </div>
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 transition group-hover:border-[#D15ABB]/30 group-hover:text-[#D15ABB] dark:border-white/10 dark:bg-white/[0.06] dark:text-white/60">
          <ArrowUpRight className="size-4" />
        </span>
      </div>
    </div>
  );
}

interface ExamplePlaceholderCardProps {
  example: PlaceholderExample;
}

function ExamplePlaceholderCard({ example }: ExamplePlaceholderCardProps) {
  return (
    <div className="flex aspect-video items-center justify-center rounded-2xl border border-gray-200 bg-gray-50 dark:border-white/10 dark:bg-white/[0.03]">
      <span className="text-gray-400 text-sm dark:text-white/30">[Screenshot: {example.title}]</span>
    </div>
  );
}

interface ExampleLightboxProps {
  example: LiveExample;
  onClose: () => void;
}

export function ExampleLightbox({ example, onClose }: ExampleLightboxProps) {
  return (
    <div
      aria-labelledby={`${example.id}-title`}
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md"
      role="dialog"
    >
      <button
        aria-label={`Close ${example.title} example`}
        className="absolute inset-0 cursor-default"
        onClick={onClose}
        type="button"
      />
      <div className="relative max-h-[92vh] w-full max-w-[1120px] overflow-auto rounded-[2rem] border border-black/10 bg-gray-200 p-3 shadow-2xl dark:border-white/10 dark:bg-neutral-800">
        <div className="mb-3 flex items-center justify-between gap-4 px-2">
          <div>
            <h3 className="font-semibold text-lg" id={`${example.id}-title`}>
              {example.title}
            </h3>
            <p className="text-muted-foreground text-sm">{example.modalDescription}</p>
          </div>
          <button
            autoFocus
            className={cn(buttonVariants({ variant: "outline", size: "icon" }), "size-9 rounded-full")}
            onClick={onClose}
            type="button"
          >
            <X className="size-4" />
            <span className="sr-only">Close</span>
          </button>
        </div>
        <div className="min-w-[1040px]">
          <DesktopWindowFrame className="w-full" title={example.windowTitle}>
            {example.render({ interactive: true })}
          </DesktopWindowFrame>
        </div>
      </div>
    </div>
  );
}
