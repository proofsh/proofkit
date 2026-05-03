"use client";

import { CheckCircle2, Clock3, MapPin, MessageSquareText, Navigation, Phone, Route, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const technicians = [
  { id: "lena", name: "Lena Ortiz", zone: "North", load: 3 },
  { id: "miles", name: "Miles Grant", zone: "Central", load: 2 },
  { id: "ari", name: "Ari Patel", zone: "South", load: 4 },
] as const;

const jobs = [
  {
    id: "job-1048",
    account: "Acme Services",
    address: "141 Market St",
    window: "9:00-11:00",
    status: "Scheduled",
    priority: "High",
    technicianId: "lena",
    notes: "Bring replacement sensor kit and confirm lobby access.",
  },
  {
    id: "job-1051",
    account: "Northstar Labs",
    address: "8 Research Way",
    window: "11:30-1:00",
    status: "En route",
    priority: "Standard",
    technicianId: "miles",
    notes: "Check in at security desk before entering lab wing.",
  },
  {
    id: "job-1057",
    account: "Harbor Studio",
    address: "22 Pier Ave",
    window: "2:00-4:00",
    status: "Pending",
    priority: "Standard",
    technicianId: "ari",
    notes: "Customer requested call 20 minutes before arrival.",
  },
  {
    id: "job-1060",
    account: "Brightline Co.",
    address: "77 Grove Blvd",
    window: "4:30-5:30",
    status: "Scheduled",
    priority: "Rush",
    technicianId: "lena",
    notes: "Route after Acme if first job closes early.",
  },
] as const;

const statuses = ["Pending", "Scheduled", "En route", "Complete"] as const;

type JobId = (typeof jobs)[number]["id"];
type TechnicianId = (typeof technicians)[number]["id"];
type JobStatus = (typeof statuses)[number];

interface ServiceDispatchProps {
  className?: string;
  interactive?: boolean;
}

export function ServiceDispatch({ className, interactive = false }: ServiceDispatchProps) {
  const [selectedJobId, setSelectedJobId] = useState<JobId>("job-1048");
  const [selectedTechnicianId, setSelectedTechnicianId] = useState<TechnicianId>("lena");
  const [statusByJobId, setStatusByJobId] = useState<Record<JobId, JobStatus>>({
    "job-1048": "Scheduled",
    "job-1051": "En route",
    "job-1057": "Pending",
    "job-1060": "Scheduled",
  });
  const [assignmentByJobId, setAssignmentByJobId] = useState<Record<JobId, TechnicianId>>({
    "job-1048": "lena",
    "job-1051": "miles",
    "job-1057": "ari",
    "job-1060": "lena",
  });
  const [routeNote, setRouteNote] = useState("Optimize North route before lunch window.");

  const enrichedJobs = useMemo(
    () =>
      jobs.map((job) => ({
        ...job,
        status: statusByJobId[job.id],
        technicianId: assignmentByJobId[job.id],
      })),
    [assignmentByJobId, statusByJobId],
  );
  const selectedJob = enrichedJobs.find((job) => job.id === selectedJobId) ?? enrichedJobs[0];
  const selectedTechnician = technicians.find((technician) => technician.id === selectedTechnicianId) ?? technicians[0];
  const visibleJobs = enrichedJobs.filter((job) => job.technicianId === selectedTechnicianId);
  const completedCount = enrichedJobs.filter((job) => job.status === "Complete").length;

  const assignSelectedJob = (technicianId: TechnicianId) => {
    if (!interactive) {
      return;
    }

    setAssignmentByJobId((current) => ({ ...current, [selectedJob.id]: technicianId }));
    setSelectedTechnicianId(technicianId);
  };

  const updateSelectedStatus = (status: JobStatus) => {
    if (!interactive) {
      return;
    }

    setStatusByJobId((current) => ({ ...current, [selectedJob.id]: status }));
  };

  return (
    <div className={cn("grid min-h-[620px] grid-cols-[285px_1fr_300px] bg-background", className)}>
      <aside className="border-border border-r bg-muted/35 p-5">
        <Badge appearance="outline" className="border-[#D15ABB]/20 bg-[#D15ABB]/10 text-[#8b1f6a]" size="sm">
          Dispatch
        </Badge>
        <h3 className="mt-3 font-bold text-2xl tracking-tight">Service Dispatch</h3>
        <p className="mt-1 text-muted-foreground text-sm">Technician assignments and route status.</p>

        <div className="mt-6 space-y-3">
          {technicians.map((technician) => (
            <button
              className={cn(
                "w-full rounded-2xl border border-border bg-background p-4 text-left shadow-sm transition",
                interactive && "hover:border-[#D15ABB]/35",
                selectedTechnicianId === technician.id && "border-[#D15ABB]/45 bg-card shadow-md",
              )}
              disabled={!interactive}
              key={technician.id}
              onClick={() => setSelectedTechnicianId(technician.id)}
              type="button"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-full bg-[#D15ABB]/10 text-[#8b1f6a]">
                    <UserRound className="size-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-sm">{technician.name}</div>
                    <div className="text-muted-foreground text-xs">{technician.zone} zone</div>
                  </div>
                </div>
                <Badge appearance="light" size="sm" variant="secondary">
                  {enrichedJobs.filter((job) => job.technicianId === technician.id).length}
                </Badge>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-5 rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="text-muted-foreground text-sm">Route progress</div>
          <div className="mt-3 font-bold text-2xl">
            {completedCount}/{enrichedJobs.length}
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-[#D15ABB]"
              style={{ width: `${(completedCount / enrichedJobs.length) * 100}%` }}
            />
          </div>
        </div>
      </aside>

      <section className="p-6">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h3 className="font-bold text-3xl tracking-tight">{selectedTechnician.name}</h3>
            <p className="mt-1 text-muted-foreground text-sm">
              {selectedTechnician.zone} route - {visibleJobs.length} assigned jobs
            </p>
          </div>
          <button
            className={cn(buttonVariants({ variant: "primary" }), "h-10 rounded-full px-5")}
            disabled={!interactive}
            type="button"
          >
            <Navigation className="size-4" />
            Optimize route
          </button>
        </div>

        <div className="mt-6 rounded-[1.75rem] border border-border bg-card p-4 shadow-sm">
          <div className="relative h-56 overflow-hidden rounded-2xl border border-border bg-muted/45">
            <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_24px,hsl(var(--border))_25px,transparent_26px),linear-gradient(0deg,transparent_24px,hsl(var(--border))_25px,transparent_26px)] bg-[size:52px_52px] opacity-60" />
            {visibleJobs.map((job, index) => (
              <button
                className={cn(
                  "absolute z-10 flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-sm shadow-sm transition",
                  interactive && "hover:border-[#D15ABB]/40",
                  selectedJob.id === job.id && "border-[#D15ABB]/50 bg-[#D15ABB] text-white",
                )}
                disabled={!interactive}
                key={job.id}
                onClick={() => setSelectedJobId(job.id)}
                style={{ left: `${18 + index * 23}%`, top: `${24 + (index % 2) * 34}%` }}
                type="button"
              >
                <MapPin className="size-4" />
                {job.account}
              </button>
            ))}
            <div className="absolute right-4 bottom-4 rounded-2xl border border-border bg-background/90 p-3 text-sm shadow-sm backdrop-blur">
              <div className="flex items-center gap-2 font-medium">
                <Route className="size-4 text-[#8b1f6a]" />
                {selectedTechnician.zone} loop
              </div>
              <div className="mt-1 text-muted-foreground text-xs">Estimated drive: 42 min</div>
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4">
          {visibleJobs.map((job) => (
            <button
              className={cn(
                "rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition",
                interactive && "hover:border-[#D15ABB]/35",
                selectedJob.id === job.id && "border-[#D15ABB]/45",
              )}
              disabled={!interactive}
              key={job.id}
              onClick={() => setSelectedJobId(job.id)}
              type="button"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold">{job.account}</div>
                  <div className="mt-1 text-muted-foreground text-sm">{job.address}</div>
                </div>
                <StatusBadge status={job.status} />
              </div>
              <div className="mt-4 flex items-center gap-2 text-muted-foreground text-sm">
                <Clock3 className="size-4" />
                {job.window}
              </div>
            </button>
          ))}
        </div>
      </section>

      <aside className="border-border border-l bg-muted/35 p-5">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h4 className="font-semibold">{selectedJob.account}</h4>
              <p className="text-muted-foreground text-xs">{selectedJob.id}</p>
            </div>
            <StatusBadge status={selectedJob.status} />
          </div>

          <div className="mt-5 space-y-3 text-sm">
            <DetailRow icon={<MapPin className="size-4" />} label={selectedJob.address} />
            <DetailRow icon={<Clock3 className="size-4" />} label={selectedJob.window} />
            <DetailRow icon={<Phone className="size-4" />} label="Call before arrival" />
          </div>

          <div className="mt-5">
            <div className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-[0.16em]">Status</div>
            <div className="grid grid-cols-2 gap-2">
              {statuses.map((status) => (
                <button
                  className={cn(
                    "rounded-full border border-border px-3 py-2 font-medium text-xs transition",
                    selectedJob.status === status
                      ? "bg-[#D15ABB] text-white"
                      : "bg-background text-muted-foreground hover:bg-muted",
                  )}
                  disabled={!interactive}
                  key={status}
                  onClick={() => updateSelectedStatus(status)}
                  type="button"
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5">
            <div className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-[0.16em]">Assign</div>
            <div className="space-y-2">
              {technicians.map((technician) => (
                <button
                  className={cn(
                    "flex w-full items-center justify-between rounded-xl border border-border bg-background p-3 text-left text-sm transition",
                    interactive && "hover:bg-muted",
                    selectedJob.technicianId === technician.id && "border-[#D15ABB]/45 bg-[#D15ABB]/5",
                  )}
                  disabled={!interactive}
                  key={technician.id}
                  onClick={() => assignSelectedJob(technician.id)}
                  type="button"
                >
                  <span>{technician.name}</span>
                  {selectedJob.technicianId === technician.id && <CheckCircle2 className="size-4 text-[#8b1f6a]" />}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 font-semibold text-sm">
            <MessageSquareText className="size-4 text-[#8b1f6a]" />
            Route notes
          </div>
          <textarea
            className="mt-4 min-h-24 w-full resize-none rounded-2xl border border-border bg-background p-3 text-sm outline-none transition focus:border-[#D15ABB]/60 focus:ring-2 focus:ring-[#D15ABB]/15"
            disabled={!interactive}
            onChange={(event) => setRouteNote(event.target.value)}
            value={routeNote}
          />
        </div>
      </aside>
    </div>
  );
}

function StatusBadge({ status }: { status: JobStatus }) {
  if (status === "Complete") {
    return (
      <Badge appearance="light" size="sm" variant="success">
        Complete
      </Badge>
    );
  }

  if (status === "En route") {
    return (
      <Badge appearance="light" size="sm" variant="info">
        En route
      </Badge>
    );
  }

  return (
    <Badge appearance={status === "Pending" ? "outline" : "light"} size="sm" variant="warning">
      {status}
    </Badge>
  );
}

function DetailRow({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-background p-3">
      <span className="text-muted-foreground">{icon}</span>
      <span>{label}</span>
    </div>
  );
}
