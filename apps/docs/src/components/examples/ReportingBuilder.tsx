"use client";

import {
  BarChart3,
  Check,
  Download,
  Eye,
  Filter,
  LineChart,
  PieChart,
  Plus,
  Save,
  Settings2,
  Table2,
} from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const savedViews = [
  { id: "revenue", name: "Revenue by account", groupBy: "Account", metric: "Revenue" },
  { id: "pipeline", name: "Pipeline health", groupBy: "Stage", metric: "Open value" },
  { id: "service", name: "Service workload", groupBy: "Technician", metric: "Open jobs" },
] as const;

const chartTypes = [
  { id: "bar", label: "Bar", icon: BarChart3 },
  { id: "line", label: "Line", icon: LineChart },
  { id: "pie", label: "Donut", icon: PieChart },
  { id: "table", label: "Table", icon: Table2 },
] as const;

const reportRows = [
  { label: "Acme Services", revenue: 42_800, jobs: 8, margin: 61 },
  { label: "Northstar Labs", revenue: 38_200, jobs: 6, margin: 58 },
  { label: "Harbor Studio", revenue: 18_600, jobs: 4, margin: 44 },
  { label: "Brightline Co.", revenue: 31_400, jobs: 7, margin: 53 },
] as const;

type SavedViewId = (typeof savedViews)[number]["id"];
type ChartTypeId = (typeof chartTypes)[number]["id"];
type ReportRow = (typeof reportRows)[number];

interface ReportingBuilderProps {
  className?: string;
  interactive?: boolean;
}

export function ReportingBuilder({ className, interactive = false }: ReportingBuilderProps) {
  const [selectedViewId, setSelectedViewId] = useState<SavedViewId>("revenue");
  const [chartType, setChartType] = useState<ChartTypeId>("bar");
  const [includeDrafts, setIncludeDrafts] = useState(false);
  const [dateRange, setDateRange] = useState("This quarter");
  const [lastRun, setLastRun] = useState("Report ready");

  const selectedView = savedViews.find((view) => view.id === selectedViewId) ?? savedViews[0];
  const totalRevenue = reportRows.reduce((sum, row) => sum + row.revenue, 0);
  const totalJobs = reportRows.reduce((sum, row) => sum + row.jobs, 0);
  const averageMargin = Math.round(reportRows.reduce((sum, row) => sum + row.margin, 0) / reportRows.length);
  const sortedRows = useMemo(
    () =>
      [...reportRows].sort((a, b) => (selectedView.metric === "Open jobs" ? b.jobs - a.jobs : b.revenue - a.revenue)),
    [selectedView.metric],
  );

  const runReport = () => {
    if (!interactive) {
      return;
    }

    setLastRun(`Ran ${selectedView.name} for ${dateRange.toLowerCase()}`);
  };

  return (
    <div className={cn("grid min-h-[620px] grid-cols-[275px_1fr_310px] bg-background", className)}>
      <aside className="border-border border-r bg-muted/35 p-5">
        <Badge appearance="outline" className="border-[#D15ABB]/20 bg-[#D15ABB]/10 text-[#8b1f6a]" size="sm">
          Reporting
        </Badge>
        <h3 className="mt-3 font-bold text-2xl tracking-tight">Reporting Builder</h3>
        <p className="mt-1 text-muted-foreground text-sm">Saved views, metrics, and configurable charts.</p>

        <div className="mt-6 space-y-3">
          {savedViews.map((view) => (
            <button
              className={cn(
                "w-full rounded-2xl border border-border bg-background p-4 text-left shadow-sm transition",
                interactive && "hover:border-[#D15ABB]/35",
                selectedView.id === view.id && "border-[#D15ABB]/45 bg-card shadow-md",
              )}
              disabled={!interactive}
              key={view.id}
              onClick={() => setSelectedViewId(view.id)}
              type="button"
            >
              <div className="font-semibold text-sm">{view.name}</div>
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Group: {view.groupBy}</span>
                <Badge appearance="outline" size="sm" variant="secondary">
                  {view.metric}
                </Badge>
              </div>
            </button>
          ))}
        </div>

        <button
          className={cn(buttonVariants({ variant: "outline" }), "mt-5 w-full rounded-full")}
          disabled={!interactive}
          type="button"
        >
          <Plus className="size-4" />
          New view
        </button>
      </aside>

      <section className="p-6">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h3 className="font-bold text-3xl tracking-tight">{selectedView.name}</h3>
            <p className="mt-1 text-muted-foreground text-sm">
              Grouped by {selectedView.groupBy} - showing {selectedView.metric.toLowerCase()}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              className={cn(buttonVariants({ variant: "outline" }), "h-10 rounded-full px-4")}
              disabled={!interactive}
              type="button"
            >
              <Save className="size-4" />
              Save
            </button>
            <button
              className={cn(buttonVariants({ variant: "primary" }), "h-10 rounded-full px-5")}
              disabled={!interactive}
              onClick={runReport}
              type="button"
            >
              <Eye className="size-4" />
              Run report
            </button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-4">
          <Metric label="Revenue" value={`$${Math.round(totalRevenue / 1000)}K`} />
          <Metric label="Open jobs" value={String(totalJobs)} />
          <Metric label="Avg. margin" value={`${averageMargin}%`} />
        </div>

        <div className="mt-5 rounded-[1.75rem] border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h4 className="font-semibold">Chart block</h4>
              <p className="text-muted-foreground text-sm">Switch views and configure output.</p>
            </div>
            <div className="flex rounded-full border border-border bg-background p-1">
              {chartTypes.map((type) => (
                <button
                  aria-label={`${type.label} chart`}
                  className={cn(
                    "rounded-full px-3 py-2 text-muted-foreground transition",
                    chartType === type.id && "bg-[#D15ABB] text-white",
                  )}
                  disabled={!interactive}
                  key={type.id}
                  onClick={() => setChartType(type.id)}
                  type="button"
                >
                  <type.icon className="size-4" />
                </button>
              ))}
            </div>
          </div>

          <ReportVisualization chartType={chartType} rows={sortedRows} />
        </div>

        <div className="mt-5 rounded-2xl border border-border bg-card shadow-sm">
          <div className="grid grid-cols-[1.3fr_0.8fr_0.8fr_0.8fr] border-border border-b bg-muted/35 px-4 py-3 font-medium text-[0.68rem] text-muted-foreground uppercase tracking-[0.16em]">
            <span>Group</span>
            <span>Revenue</span>
            <span>Jobs</span>
            <span>Margin</span>
          </div>
          {sortedRows.map((row) => (
            <div
              className="grid grid-cols-[1.3fr_0.8fr_0.8fr_0.8fr] items-center border-border border-b px-4 py-3 text-sm last:border-b-0"
              key={row.label}
            >
              <span className="font-semibold">{row.label}</span>
              <span>${row.revenue.toLocaleString()}</span>
              <span className="text-muted-foreground">{row.jobs}</span>
              <span>{row.margin}%</span>
            </div>
          ))}
        </div>
      </section>

      <aside className="border-border border-l bg-muted/35 p-5">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 font-semibold text-sm">
            <Settings2 className="size-4 text-[#8b1f6a]" />
            Report settings
          </div>

          <div className="mt-5 space-y-4">
            <SettingBlock label="Date range">
              {["This month", "This quarter", "Year to date"].map((range) => (
                <button
                  className={cn(
                    "rounded-full border border-border px-3 py-2 font-medium text-xs transition",
                    dateRange === range
                      ? "bg-[#D15ABB] text-white"
                      : "bg-background text-muted-foreground hover:bg-muted",
                  )}
                  disabled={!interactive}
                  key={range}
                  onClick={() => setDateRange(range)}
                  type="button"
                >
                  {range}
                </button>
              ))}
            </SettingBlock>

            <button
              className="flex w-full items-center justify-between rounded-2xl border border-border bg-background p-4 text-left"
              disabled={!interactive}
              onClick={() => setIncludeDrafts((current) => !current)}
              type="button"
            >
              <span>
                <span className="block font-semibold text-sm">Include draft records</span>
                <span className="mt-1 block text-muted-foreground text-xs">Toggle records not yet finalized.</span>
              </span>
              <span
                className={cn(
                  "flex size-6 items-center justify-center rounded-md border border-border",
                  includeDrafts && "border-[#D15ABB] bg-[#D15ABB] text-white",
                )}
              >
                {includeDrafts && <Check className="size-4" />}
              </span>
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 font-semibold text-sm">
            <Filter className="size-4 text-muted-foreground" />
            Output
          </div>
          <div className="mt-4 space-y-3 text-sm">
            <OutputRow label="Chart" value={chartTypes.find((type) => type.id === chartType)?.label ?? "Bar"} />
            <OutputRow label="Group" value={selectedView.groupBy} />
            <OutputRow label="Drafts" value={includeDrafts ? "Included" : "Excluded"} />
          </div>
          <button
            className={cn(buttonVariants({ variant: "outline" }), "mt-5 w-full rounded-full")}
            disabled={!interactive}
            type="button"
          >
            <Download className="size-4" />
            Export CSV
          </button>
        </div>

        <div className="mt-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="text-muted-foreground text-sm">Last action</div>
          <p className="mt-2 font-medium text-sm">{lastRun}</p>
        </div>
      </aside>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="text-muted-foreground text-sm">{label}</div>
      <div className="mt-3 font-bold text-2xl">{value}</div>
    </div>
  );
}

function ReportVisualization({ chartType, rows }: { chartType: ChartTypeId; rows: ReportRow[] }) {
  if (chartType === "pie") {
    return (
      <div className="mt-6 flex h-56 items-center justify-center">
        <div className="relative flex size-40 items-center justify-center rounded-full bg-[conic-gradient(#D15ABB_0_42%,#8b5cf6_42%_70%,#f59e0b_70%_86%,#10b981_86%_100%)]">
          <div className="flex size-24 items-center justify-center rounded-full bg-card font-bold">100%</div>
        </div>
      </div>
    );
  }

  if (chartType === "line") {
    return (
      <div className="mt-6 flex h-56 items-end gap-5 border-border border-b px-4">
        {rows.map((row, index) => (
          <div className="flex flex-1 flex-col items-center gap-2" key={row.label}>
            <div className="w-full rounded-t-xl bg-[#D15ABB]" style={{ height: `${70 + index * 24}px` }} />
            <span className="text-muted-foreground text-xs">{index + 1}</span>
          </div>
        ))}
      </div>
    );
  }

  if (chartType === "table") {
    return (
      <div className="mt-6 grid gap-3">
        {rows.map((row) => (
          <div
            className="flex items-center justify-between rounded-xl border border-border bg-background p-3 text-sm"
            key={row.label}
          >
            <span className="font-medium">{row.label}</span>
            <span className="text-muted-foreground">${row.revenue.toLocaleString()}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="mt-6 flex h-56 items-end gap-4 border-border border-b px-4">
      {rows.map((row) => (
        <div className="flex flex-1 flex-col items-center gap-2" key={row.label}>
          <div className="w-full rounded-t-xl bg-[#D15ABB]" style={{ height: `${row.revenue / 260}px` }} />
          <span className="max-w-20 truncate text-muted-foreground text-xs">{row.label.split(" ")[0]}</span>
        </div>
      ))}
    </div>
  );
}

function SettingBlock({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div>
      <div className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-[0.16em]">{label}</div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function OutputRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
