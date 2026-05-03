"use client";

import {
  ArrowRight,
  Bolt,
  CheckCircle2,
  Command,
  FileSearch,
  History,
  Plus,
  Search,
  Sparkles,
  Zap,
} from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const commands = [
  {
    id: "new-project",
    label: "Create project from template",
    group: "Actions",
    hint: "Start with intake defaults",
    shortcut: "P",
  },
  {
    id: "find-record",
    label: "Find related FileMaker record",
    group: "Search",
    hint: "Jump to account, invoice, or task",
    shortcut: "F",
  },
  {
    id: "assign-owner",
    label: "Assign owner to selected tasks",
    group: "Workflow",
    hint: "Bulk update open tasks",
    shortcut: "A",
  },
  {
    id: "export-report",
    label: "Export current report",
    group: "Reports",
    hint: "Download the active view",
    shortcut: "E",
  },
] as const;

const records = [
  { name: "Acme Services", type: "Account", meta: "3 open projects" },
  { name: "Northstar intake board", type: "Project", meta: "Due May 8" },
  { name: "Invoice #1048", type: "Finance", meta: "$8,400 pending" },
  { name: "Harbor approval flow", type: "Workflow", meta: "Needs info" },
] as const;

const quickActions = ["New task", "Open calendar", "Run sync", "View reports"] as const;

type CommandId = (typeof commands)[number]["id"];

interface CommandCenterProps {
  className?: string;
  interactive?: boolean;
}

export function CommandCenter({ className, interactive = false }: CommandCenterProps) {
  const [query, setQuery] = useState("");
  const [selectedCommandId, setSelectedCommandId] = useState<CommandId>("new-project");
  const [lastAction, setLastAction] = useState("Ready for command");
  const [pinnedActions, setPinnedActions] = useState<string[]>(["New task", "Run sync"]);

  const filteredCommands = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return commands;
    }

    return commands.filter((commandItem) =>
      [commandItem.label, commandItem.group, commandItem.hint].some((value) =>
        value.toLowerCase().includes(normalizedQuery),
      ),
    );
  }, [query]);
  const filteredRecords = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return records;
    }

    return records.filter((record) =>
      [record.name, record.type, record.meta].some((value) => value.toLowerCase().includes(normalizedQuery)),
    );
  }, [query]);
  const selectedCommand = commands.find((commandItem) => commandItem.id === selectedCommandId) ?? commands[0];

  const runCommand = () => {
    if (!interactive) {
      return;
    }

    setLastAction(`Ran: ${selectedCommand.label}`);
  };

  const togglePinnedAction = (action: string) => {
    if (!interactive) {
      return;
    }

    setPinnedActions((current) =>
      current.includes(action) ? current.filter((currentAction) => currentAction !== action) : [...current, action],
    );
    setLastAction(`${pinnedActions.includes(action) ? "Unpinned" : "Pinned"} ${action}`);
  };

  return (
    <div className={cn("grid min-h-[620px] grid-cols-[1fr_310px] bg-background", className)}>
      <section className="p-6">
        <div className="flex items-start justify-between gap-6">
          <div>
            <Badge appearance="outline" className="border-[#D15ABB]/20 bg-[#D15ABB]/10 text-[#8b1f6a]" size="sm">
              Power user
            </Badge>
            <h3 className="mt-3 font-bold text-3xl tracking-tight">Command Center</h3>
            <p className="mt-1 text-muted-foreground text-sm">Search records, trigger actions, and pin shortcuts.</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 font-medium text-muted-foreground text-sm shadow-sm">
            <Command className="size-4" />
            Cmd K
          </div>
        </div>

        <div className="mt-6 rounded-[1.75rem] border border-border bg-card p-4 shadow-sm">
          <div className="relative">
            <Search className="absolute top-1/2 left-5 size-5 -translate-y-1/2 text-muted-foreground" />
            <input
              className="h-14 w-full rounded-2xl border border-border bg-background pr-4 pl-14 text-base outline-none transition placeholder:text-muted-foreground focus:border-[#D15ABB]/60 focus:ring-2 focus:ring-[#D15ABB]/15"
              disabled={!interactive}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search records or type a command..."
              value={query}
            />
          </div>

          <div className="mt-4 grid grid-cols-[1.1fr_0.9fr] gap-4">
            <div className="rounded-2xl border border-border bg-background p-3">
              <div className="mb-2 flex items-center gap-2 px-2 font-medium text-muted-foreground text-xs uppercase tracking-[0.16em]">
                <Bolt className="size-3.5" />
                Commands
              </div>
              <div className="space-y-2">
                {filteredCommands.map((commandItem) => (
                  <button
                    className={cn(
                      "flex w-full items-center justify-between rounded-xl p-3 text-left transition",
                      interactive && "hover:bg-muted",
                      selectedCommand.id === commandItem.id && "bg-[#D15ABB]/10",
                    )}
                    disabled={!interactive}
                    key={commandItem.id}
                    onClick={() => setSelectedCommandId(commandItem.id)}
                    type="button"
                  >
                    <span>
                      <span className="block font-semibold text-sm">{commandItem.label}</span>
                      <span className="mt-1 block text-muted-foreground text-xs">{commandItem.hint}</span>
                    </span>
                    <kbd className="rounded-md border border-border bg-card px-2 py-1 text-muted-foreground text-xs">
                      {commandItem.shortcut}
                    </kbd>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-background p-3">
              <div className="mb-2 flex items-center gap-2 px-2 font-medium text-muted-foreground text-xs uppercase tracking-[0.16em]">
                <FileSearch className="size-3.5" />
                Records
              </div>
              <div className="space-y-2">
                {filteredRecords.map((record) => (
                  <button
                    className="flex w-full items-center justify-between rounded-xl p-3 text-left transition hover:bg-muted disabled:hover:bg-transparent"
                    disabled={!interactive}
                    key={record.name}
                    onClick={() => setLastAction(`Opened ${record.name}`)}
                    type="button"
                  >
                    <span>
                      <span className="block font-semibold text-sm">{record.name}</span>
                      <span className="mt-1 block text-muted-foreground text-xs">{record.meta}</span>
                    </span>
                    <Badge appearance="outline" size="sm" variant="secondary">
                      {record.type}
                    </Badge>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-4 gap-3">
          {quickActions.map((action) => (
            <button
              className={cn(
                "rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition",
                interactive && "hover:-translate-y-0.5 hover:border-[#D15ABB]/35",
                pinnedActions.includes(action) && "border-[#D15ABB]/35 bg-[#D15ABB]/5",
              )}
              disabled={!interactive}
              key={action}
              onClick={() => togglePinnedAction(action)}
              type="button"
            >
              <div className="flex size-9 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <Plus className="size-4" />
              </div>
              <div className="mt-3 font-semibold text-sm">{action}</div>
              <div className="mt-1 text-muted-foreground text-xs">
                {pinnedActions.includes(action) ? "Pinned" : "Click to pin"}
              </div>
            </button>
          ))}
        </div>
      </section>

      <aside className="border-border border-l bg-muted/35 p-5">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 font-semibold text-sm">
            <Sparkles className="size-4 text-[#8b1f6a]" />
            Selected command
          </div>
          <div className="mt-5 rounded-2xl border border-border bg-background p-4">
            <Badge appearance="light" size="sm" variant="secondary">
              {selectedCommand.group}
            </Badge>
            <h4 className="mt-3 font-bold text-xl">{selectedCommand.label}</h4>
            <p className="mt-2 text-muted-foreground text-sm leading-6">{selectedCommand.hint}</p>
            <button
              className={cn(buttonVariants({ variant: "primary" }), "mt-5 h-10 w-full rounded-full")}
              disabled={!interactive}
              onClick={runCommand}
              type="button"
            >
              Run command
              <ArrowRight className="size-4" />
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 font-semibold text-sm">
            <History className="size-4 text-muted-foreground" />
            Session activity
          </div>
          <div className="mt-4 space-y-3 text-sm">
            <ActivityItem icon={<CheckCircle2 className="size-4" />} label={lastAction} />
            <ActivityItem icon={<Zap className="size-4" />} label={`${pinnedActions.length} quick actions pinned`} />
            <ActivityItem icon={<Search className="size-4" />} label={`${filteredRecords.length} matching records`} />
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="font-semibold text-sm">Pinned shortcuts</div>
          <div className="mt-4 flex flex-wrap gap-2">
            {pinnedActions.map((action) => (
              <Badge appearance="outline" key={action} size="sm" variant="secondary">
                {action}
              </Badge>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}

function ActivityItem({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-background p-3">
      <span className="text-[#8b1f6a]">{icon}</span>
      <span>{label}</span>
    </div>
  );
}
