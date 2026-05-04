"use client";

import {
  ArrowDownUp,
  Check,
  CheckCircle2,
  ChevronDown,
  MoreHorizontal,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const records = [
  {
    account: "Acme Services",
    contact: "Mira Chen",
    email: "mira@acmeservices.example",
    owner: "Lena",
    stage: "Qualified",
    value: "$28,400",
    lastTouch: "Today",
    score: 94,
    selected: true,
  },
  {
    account: "Northstar Labs",
    contact: "Theo Grant",
    email: "theo@northstarlabs.example",
    owner: "Miles",
    stage: "Proposal",
    value: "$41,200",
    lastTouch: "Yesterday",
    score: 88,
    selected: true,
  },
  {
    account: "Brightline Co.",
    contact: "Ari Patel",
    email: "ari@brightline.example",
    owner: "Ari",
    stage: "Qualified",
    value: "$18,900",
    lastTouch: "2 days ago",
    score: 81,
    selected: false,
  },
  {
    account: "Harbor Studio",
    contact: "Nia Brooks",
    email: "nia@harborstudio.example",
    owner: "Lena",
    stage: "Review",
    value: "$12,600",
    lastTouch: "4 days ago",
    score: 72,
    selected: false,
  },
  {
    account: "Kestrel Health",
    contact: "Owen Lee",
    email: "owen@kestrelhealth.example",
    owner: "Miles",
    stage: "Qualified",
    value: "$33,700",
    lastTouch: "5 days ago",
    score: 86,
    selected: true,
  },
  {
    account: "Juniper Works",
    contact: "Sofia Ray",
    email: "sofia@juniperworks.example",
    owner: "Lena",
    stage: "Discovery",
    value: "$9,800",
    lastTouch: "1 week ago",
    score: 65,
    selected: false,
  },
];

const columns = [
  { id: "account", label: "Account", minWidth: "1.3fr" },
  { id: "contact", label: "Contact", minWidth: "1fr" },
  { id: "email", label: "Email", minWidth: "1.35fr" },
  { id: "owner", label: "Owner", minWidth: "0.7fr" },
  { id: "stage", label: "Stage", minWidth: "0.85fr" },
  { id: "value", label: "Value", minWidth: "0.75fr", sortable: true },
  { id: "lastTouch", label: "Touch", minWidth: "0.75fr" },
  { id: "score", label: "Score", minWidth: "0.55fr" },
] as const;

type ColumnId = (typeof columns)[number]["id"];
type RecordItem = (typeof records)[number];

const defaultVisibleColumns: ColumnId[] = ["account", "contact", "email", "owner", "stage", "value", "score"];

interface DataGridWithFilteringProps {
  className?: string;
  interactive?: boolean;
}

export function DataGridWithFiltering({ className, interactive = false }: DataGridWithFilteringProps) {
  const [columnMenuOpen, setColumnMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [visibleColumnIds, setVisibleColumnIds] = useState<ColumnId[]>(defaultVisibleColumns);

  const visibleColumns = columns.filter((column) => visibleColumnIds.includes(column.id));
  const gridTemplateColumns = `44px ${visibleColumns.map((column) => column.minWidth).join(" ")} 44px`;
  const normalizedQuery = query.trim().toLowerCase();
  const filteredRecords = useMemo(() => {
    if (!normalizedQuery) {
      return records;
    }

    return records.filter((record) =>
      Object.values(record).some((value) => String(value).toLowerCase().includes(normalizedQuery)),
    );
  }, [normalizedQuery]);

  const toggleColumn = (columnId: ColumnId) => {
    setVisibleColumnIds((current) => {
      if (current.includes(columnId)) {
        return current.length === 1 ? current : current.filter((id) => id !== columnId);
      }

      return columns
        .filter((column) => current.includes(column.id) || column.id === columnId)
        .map((column) => column.id);
    });
  };

  return (
    <div className={cn("min-h-[620px] bg-background", className)}>
      <section className="p-6">
        <div className="flex items-start justify-between gap-6">
          <div>
            <Badge appearance="outline" className="border-[#D15ABB]/20 bg-[#D15ABB]/10 text-[#8b1f6a]" size="sm">
              Data grid
            </Badge>
            <h3 className="mt-3 font-bold text-3xl tracking-tight">Contacts</h3>
            <p className="mt-1 text-muted-foreground text-sm">Search, filter, and choose the fields you want to see.</p>
          </div>
          <ColumnMenu
            interactive={interactive}
            isOpen={columnMenuOpen}
            onOpenChange={setColumnMenuOpen}
            onToggleColumn={toggleColumn}
            visibleColumnIds={visibleColumnIds}
          />
        </div>

        <div className="mt-6 rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between gap-4 border-border border-b p-4">
            <div className="relative min-w-[420px]">
              <Search className="absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
              {interactive ? (
                <>
                  <input
                    className="h-10 w-full rounded-full border border-border bg-background pr-10 pl-11 text-sm outline-none transition placeholder:text-muted-foreground focus:border-[#D15ABB]/60 focus:ring-2 focus:ring-[#D15ABB]/15"
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search name, company, email, owner, or stage..."
                    value={query}
                  />
                  {query && (
                    <button
                      aria-label="Clear search"
                      className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                      onClick={() => setQuery("")}
                      type="button"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </>
              ) : (
                <div className="flex h-10 items-center rounded-full border border-border bg-background pr-10 pl-11 text-muted-foreground text-sm">
                  Search name, company, email, owner, or stage...
                </div>
              )}
            </div>
            <Badge appearance="light" size="sm" variant="secondary">
              {filteredRecords.length} of {records.length} contacts
            </Badge>
          </div>

          <div
            className="grid border-border border-b bg-muted/35 px-4 py-3 font-medium text-[0.68rem] text-muted-foreground uppercase tracking-[0.16em]"
            style={{ gridTemplateColumns }}
          >
            <span />
            {visibleColumns.map((column) => (
              <span className="flex items-center gap-1.5" key={column.id}>
                {column.label}
                {"sortable" in column && column.sortable && <ArrowDownUp className="size-3" />}
              </span>
            ))}
            <span />
          </div>

          {filteredRecords.map((record) => (
            <div
              className="grid items-center border-border border-b px-4 py-3 text-sm last:border-b-0"
              key={record.account}
              style={{ gridTemplateColumns }}
            >
              <span
                className={cn(
                  "flex size-5 items-center justify-center rounded-md border border-border",
                  record.selected && "border-[#D15ABB] bg-[#D15ABB] text-white",
                )}
              >
                {record.selected && <CheckCircle2 className="size-3.5" />}
              </span>
              {visibleColumns.map((column) => (
                <Cell columnId={column.id} key={column.id} record={record} />
              ))}
              <span className="flex justify-end text-muted-foreground">
                <MoreHorizontal className="size-4" />
              </span>
            </div>
          ))}

          {filteredRecords.length === 0 && (
            <div className="flex h-48 items-center justify-center text-muted-foreground text-sm">
              No contacts match "{query}".
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

interface ColumnMenuProps {
  interactive: boolean;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onToggleColumn: (columnId: ColumnId) => void;
  visibleColumnIds: ColumnId[];
}

function ColumnMenu({ interactive, isOpen, onOpenChange, onToggleColumn, visibleColumnIds }: ColumnMenuProps) {
  if (!interactive) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 font-medium text-sm shadow-sm">
        <SlidersHorizontal className="size-4" />
        Columns
        <ChevronDown className="size-3.5" />
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        aria-expanded={isOpen}
        className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 font-medium text-sm shadow-sm transition hover:bg-muted"
        onClick={() => onOpenChange(!isOpen)}
        type="button"
      >
        <SlidersHorizontal className="size-4" />
        Columns
        <ChevronDown className="size-3.5" />
      </button>

      {isOpen && (
        <div className="absolute top-12 right-0 z-20 w-64 rounded-2xl border border-border bg-popover p-2 text-popover-foreground shadow-xl">
          <div className="px-3 py-2">
            <div className="font-semibold text-sm">Visible columns</div>
            <p className="text-muted-foreground text-xs">Choose which fields appear in the table.</p>
          </div>
          <div className="mt-1 space-y-1">
            {columns.map((column) => {
              const isVisible = visibleColumnIds.includes(column.id);

              return (
                <button
                  className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition hover:bg-muted"
                  key={column.id}
                  onClick={() => onToggleColumn(column.id)}
                  type="button"
                >
                  <span>{column.label}</span>
                  <span
                    className={cn(
                      "flex size-5 items-center justify-center rounded-md border border-border",
                      isVisible && "border-[#D15ABB] bg-[#D15ABB] text-white",
                    )}
                  >
                    {isVisible && <Check className="size-3.5" />}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Cell({ columnId, record }: { columnId: ColumnId; record: RecordItem }) {
  if (columnId === "account") {
    return (
      <span>
        <span className="block font-semibold">{record.account}</span>
        <span className="text-muted-foreground text-xs">{record.stage}</span>
      </span>
    );
  }

  if (columnId === "score") {
    return (
      <span>
        <Badge appearance={record.score > 80 ? "light" : "outline"} size="sm" variant="success">
          {record.score}
        </Badge>
      </span>
    );
  }

  if (columnId === "value") {
    return <span className="font-medium">{record.value}</span>;
  }

  if (columnId === "email" || columnId === "lastTouch") {
    return <span className="truncate text-muted-foreground">{record[columnId]}</span>;
  }

  return <span className="truncate">{record[columnId]}</span>;
}
