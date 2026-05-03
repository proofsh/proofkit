"use client";

import { AlertCircle, Check, ChevronDown, ClipboardCheck, Eye, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const requestTypes = ["Implementation", "Support", "Training"] as const;
const priorities = ["Standard", "Rush", "Critical"] as const;
const fieldSections = [
  { label: "Request", complete: true },
  { label: "Customer", complete: true },
  { label: "Billing", complete: false },
] as const;

type RequestType = (typeof requestTypes)[number];
type Priority = (typeof priorities)[number];

interface RichRecordFormProps {
  className?: string;
  interactive?: boolean;
}

export function RichRecordForm({ className, interactive = false }: RichRecordFormProps) {
  const [requestType, setRequestType] = useState<RequestType>("Implementation");
  const [priority, setPriority] = useState<Priority>("Rush");
  const [customer, setCustomer] = useState("Northstar Labs");
  const [owner, setOwner] = useState("Miles");
  const [budgetApproved, setBudgetApproved] = useState(true);
  const [notes, setNotes] = useState("Add portal launch support and weekly check-ins for the first month.");
  const [saveState, setSaveState] = useState<"idle" | "saved">("idle");

  const readiness = useMemo(() => {
    let score = 68;

    if (customer.trim()) {
      score += 10;
    }

    if (owner.trim()) {
      score += 8;
    }

    if (budgetApproved) {
      score += 9;
    }

    if (notes.trim().length > 20) {
      score += 5;
    }

    return Math.min(score, 100);
  }, [budgetApproved, customer, notes, owner]);

  const saveRecord = () => {
    if (!interactive) {
      return;
    }

    setSaveState("saved");
  };

  return (
    <div className={cn("grid min-h-[620px] grid-cols-[1fr_300px] bg-background", className)}>
      <section className="p-6">
        <div className="flex items-start justify-between gap-6">
          <div>
            <Badge appearance="outline" className="border-[#D15ABB]/20 bg-[#D15ABB]/10 text-[#8b1f6a]" size="sm">
              Form layout
            </Badge>
            <h3 className="mt-3 font-bold text-3xl tracking-tight">Project Intake</h3>
            <p className="mt-1 text-muted-foreground text-sm">
              A guided FileMaker record form with validation, review, and save states.
            </p>
          </div>
          <button
            className={cn(buttonVariants({ variant: "primary" }), "h-10 rounded-full px-5")}
            disabled={!interactive}
            onClick={saveRecord}
            type="button"
          >
            <Check className="size-4" />
            {saveState === "saved" ? "Saved" : "Save record"}
          </button>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-4">
          {fieldSections.map((section, index) => (
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm" key={section.label}>
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{section.label}</span>
                <span
                  className={cn(
                    "flex size-7 items-center justify-center rounded-full text-xs",
                    section.complete || index === 2
                      ? "bg-[#D15ABB]/10 text-[#8b1f6a]"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {index + 1}
                </span>
              </div>
              <p className="mt-3 text-muted-foreground text-xs">
                {section.complete ? "Required fields complete" : "Conditional fields shown"}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Customer">
              <input
                className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none transition focus:border-[#D15ABB]/60 focus:ring-2 focus:ring-[#D15ABB]/15"
                disabled={!interactive}
                onChange={(event) => {
                  setCustomer(event.target.value);
                  setSaveState("idle");
                }}
                value={customer}
              />
            </Field>
            <Field label="Owner">
              <input
                className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none transition focus:border-[#D15ABB]/60 focus:ring-2 focus:ring-[#D15ABB]/15"
                disabled={!interactive}
                onChange={(event) => {
                  setOwner(event.target.value);
                  setSaveState("idle");
                }}
                value={owner}
              />
            </Field>
            <Field label="Request type">
              <SegmentedPicker
                disabled={!interactive}
                onChange={(value) => {
                  setRequestType(value);
                  setSaveState("idle");
                }}
                options={requestTypes}
                value={requestType}
              />
            </Field>
            <Field label="Priority">
              <SegmentedPicker
                disabled={!interactive}
                onChange={(value) => {
                  setPriority(value);
                  setSaveState("idle");
                }}
                options={priorities}
                value={priority}
              />
            </Field>
          </div>

          <div className="mt-5 rounded-2xl border border-border bg-background p-4">
            <button
              className="flex w-full items-center justify-between text-left"
              disabled={!interactive}
              onClick={() => {
                setBudgetApproved((current) => !current);
                setSaveState("idle");
              }}
              type="button"
            >
              <span>
                <span className="block font-semibold text-sm">Billing review</span>
                <span className="mt-1 block text-muted-foreground text-xs">
                  {budgetApproved ? "Budget approved, show invoice setup." : "Budget pending, hide invoice setup."}
                </span>
              </span>
              <span
                className={cn(
                  "flex size-6 items-center justify-center rounded-md border border-border",
                  budgetApproved && "border-[#D15ABB] bg-[#D15ABB] text-white",
                )}
              >
                {budgetApproved && <Check className="size-4" />}
              </span>
            </button>

            {budgetApproved && (
              <div className="mt-4 grid grid-cols-2 gap-3 border-border border-t pt-4">
                <div className="rounded-xl bg-muted/45 p-3">
                  <div className="text-muted-foreground text-xs">Billing code</div>
                  <div className="mt-1 font-semibold text-sm">PK-IMPL-204</div>
                </div>
                <div className="rounded-xl bg-muted/45 p-3">
                  <div className="text-muted-foreground text-xs">Deposit</div>
                  <div className="mt-1 font-semibold text-sm">$4,800</div>
                </div>
              </div>
            )}
          </div>

          <Field className="mt-5" label="Internal notes">
            <textarea
              className="min-h-28 w-full resize-none rounded-xl border border-border bg-background p-3 text-sm outline-none transition focus:border-[#D15ABB]/60 focus:ring-2 focus:ring-[#D15ABB]/15"
              disabled={!interactive}
              onChange={(event) => {
                setNotes(event.target.value);
                setSaveState("idle");
              }}
              value={notes}
            />
          </Field>
        </div>
      </section>

      <aside className="border-border border-l bg-muted/35 p-5">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 font-semibold text-sm">
            <ClipboardCheck className="size-4 text-[#8b1f6a]" />
            Review panel
          </div>
          <div className="mt-5">
            <div className="flex items-end justify-between">
              <span className="text-muted-foreground text-sm">Readiness</span>
              <span className="font-bold text-2xl">{readiness}%</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-[#D15ABB]" style={{ width: `${readiness}%` }} />
            </div>
          </div>
          <div className="mt-5 space-y-3">
            <ChecklistItem checked={Boolean(customer.trim())} label="Customer selected" />
            <ChecklistItem checked={Boolean(owner.trim())} label="Owner assigned" />
            <ChecklistItem checked={budgetApproved} label="Budget approved" />
            <ChecklistItem checked={notes.trim().length > 20} label="Notes explain scope" />
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 font-semibold text-sm">
            <Sparkles className="size-4 text-[#8b1f6a]" />
            Agent suggestions
          </div>
          <div className="mt-4 space-y-3 text-sm">
            <Suggestion icon={<Eye className="size-4" />} label="Preview deployment checklist" />
            <Suggestion icon={<AlertCircle className="size-4" />} label={`Flag ${priority.toLowerCase()} SLA`} />
            <Suggestion icon={<ChevronDown className="size-4" />} label={`Template: ${requestType}`} />
          </div>
        </div>
      </aside>
    </div>
  );
}

function Field({ children, className, label }: { children: React.ReactNode; className?: string; label: string }) {
  return (
    <div className={cn("block", className)}>
      <span className="mb-2 block font-medium text-muted-foreground text-xs uppercase tracking-[0.16em]">{label}</span>
      {children}
    </div>
  );
}

function SegmentedPicker<T extends string>({
  disabled,
  onChange,
  options,
  value,
}: {
  disabled: boolean;
  onChange: (value: T) => void;
  options: readonly T[];
  value: T;
}) {
  return (
    <div className="flex rounded-xl border border-border bg-background p-1">
      {options.map((option) => (
        <button
          className={cn(
            "flex-1 rounded-lg px-3 py-2 font-medium text-xs transition",
            value === option ? "bg-[#D15ABB] text-white shadow-sm" : "text-muted-foreground hover:bg-muted",
          )}
          disabled={disabled}
          key={option}
          onClick={() => onChange(option)}
          type="button"
        >
          {option}
        </button>
      ))}
    </div>
  );
}

function ChecklistItem({ checked, label }: { checked: boolean; label: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className={checked ? "text-foreground" : "text-muted-foreground"}>{label}</span>
      <span
        className={cn(
          "flex size-5 items-center justify-center rounded-md border border-border",
          checked && "border-[#D15ABB] bg-[#D15ABB] text-white",
        )}
      >
        {checked && <Check className="size-3.5" />}
      </span>
    </div>
  );
}

function Suggestion({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-background p-3">
      <span className="text-muted-foreground">{icon}</span>
      <span>{label}</span>
    </div>
  );
}
