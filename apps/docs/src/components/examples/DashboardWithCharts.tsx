import { Activity, ArrowUpRight, CircleDollarSign, Clock, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const metrics = [
  {
    label: "Revenue",
    value: "$128.4K",
    change: "+18.2%",
    icon: CircleDollarSign,
  },
  {
    label: "Active accounts",
    value: "2,842",
    change: "+12.5%",
    icon: Users,
  },
  {
    label: "Avg. cycle",
    value: "3.8 days",
    change: "-9.1%",
    icon: Clock,
  },
];

const revenueBars = [46, 64, 54, 78, 68, 88, 74, 92, 84, 96, 78, 90];
const pipelineRows = [
  ["Discovery", "$24.8K", "42%", "bg-chart-2"],
  ["Proposal", "$41.2K", "68%", "bg-chart-1"],
  ["Contract", "$33.6K", "55%", "bg-chart-4"],
  ["Launch", "$28.8K", "74%", "bg-chart-5"],
];

interface DashboardWithChartsProps {
  className?: string;
}

export function DashboardWithCharts({ className }: DashboardWithChartsProps) {
  return (
    <div className={cn("grid min-h-[620px] grid-cols-[220px_1fr] bg-background", className)}>
      <aside className="border-border border-r bg-muted/35 p-5">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-[#D15ABB] font-bold text-white">P</div>
          <div>
            <div className="font-semibold text-sm">ProofKit CRM</div>
            <div className="text-muted-foreground text-xs">Live FileMaker data</div>
          </div>
        </div>

        <nav className="mt-8 space-y-1.5 text-sm">
          {["Dashboard", "Pipeline", "Accounts", "Reports"].map((item, index) => (
            <div
              className={cn(
                "rounded-xl px-3 py-2.5 font-medium text-muted-foreground",
                index === 0 && "bg-background text-foreground shadow-sm",
              )}
              key={item}
            >
              {item}
            </div>
          ))}
        </nav>

        <div className="mt-8 rounded-2xl border border-border bg-background p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <Activity className="size-3.5" />
            Sync status
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className="size-2 rounded-full bg-emerald-500" />
            <span className="font-medium text-sm">Up to date</span>
          </div>
          <p className="mt-2 text-muted-foreground text-xs leading-5">Last pull completed 34 seconds ago.</p>
        </div>
      </aside>

      <section className="p-6">
        <div className="flex items-start justify-between gap-6">
          <div>
            <Badge appearance="outline" className="border-[#D15ABB]/20 bg-[#D15ABB]/10 text-[#8b1f6a]" size="sm">
              Q2 performance
            </Badge>
            <h3 className="mt-3 font-bold text-3xl tracking-tight">Dashboard</h3>
            <p className="mt-1 text-muted-foreground text-sm">Revenue, pipeline, and account health at a glance.</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 font-medium text-sm shadow-sm">
            Export
            <ArrowUpRight className="size-4" />
          </div>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-4">
          {metrics.map((metric) => (
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm" key={metric.label}>
              <div className="flex items-center justify-between">
                <div className="text-muted-foreground text-sm">{metric.label}</div>
                <metric.icon className="size-4 text-muted-foreground" />
              </div>
              <div className="mt-4 font-bold text-2xl">{metric.value}</div>
              <div className="mt-1 font-medium text-emerald-600 text-sm">{metric.change} from last month</div>
            </div>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-[1.45fr_1fr] gap-4">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold">Revenue trend</h4>
                <p className="text-muted-foreground text-sm">Monthly booked revenue</p>
              </div>
              <Badge appearance="light" size="sm" variant="success">
                Healthy
              </Badge>
            </div>

            <div className="mt-8 flex h-52 items-end gap-3 border-border border-b">
              {revenueBars.map((height, index) => (
                <div className="flex flex-1 flex-col items-center gap-2" key={`${height}-${index}`}>
                  <div
                    className="w-full rounded-t-lg bg-[#D15ABB] opacity-85"
                    style={{ height: `${height * 1.55}px` }}
                  />
                  <span className="text-[0.65rem] text-muted-foreground">{index + 1}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h4 className="font-semibold">Pipeline mix</h4>
            <p className="text-muted-foreground text-sm">Open opportunities</p>

            <div className="mt-6 space-y-5">
              {pipelineRows.map(([stage, value, percent, color]) => (
                <div key={stage}>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="font-medium">{stage}</span>
                    <span className="text-muted-foreground">{value}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className={cn("h-full rounded-full", color)} style={{ width: percent }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="grid grid-cols-[1.3fr_1fr_1fr_0.8fr] border-border border-b pb-3 font-medium text-muted-foreground text-xs uppercase tracking-[0.18em]">
            <span>Account</span>
            <span>Owner</span>
            <span>Value</span>
            <span>Status</span>
          </div>
          {[
            ["Acme Services", "Lena", "$18.4K", "Active"],
            ["Northstar Labs", "Miles", "$12.1K", "Review"],
            ["Brightline Co.", "Ari", "$9.7K", "Active"],
          ].map((row) => (
            <div className="grid grid-cols-[1.3fr_1fr_1fr_0.8fr] items-center py-3 text-sm" key={row[0]}>
              <span className="font-medium">{row[0]}</span>
              <span className="text-muted-foreground">{row[1]}</span>
              <span>{row[2]}</span>
              <Badge appearance={row[3] === "Active" ? "light" : "outline"} size="sm" variant="secondary">
                {row[3]}
              </Badge>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
