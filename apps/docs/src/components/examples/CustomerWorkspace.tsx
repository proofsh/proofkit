"use client";

import { Building2, Clock3, FileText, Mail, MessageSquareText, Phone, Plus, Star, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const accounts = [
  {
    id: "acme",
    name: "Acme Services",
    contact: "Mira Chen",
    status: "Active",
    value: "$28.4K",
    lastTouch: "Today",
    health: 92,
  },
  {
    id: "northstar",
    name: "Northstar Labs",
    contact: "Theo Grant",
    status: "Renewal",
    value: "$41.2K",
    lastTouch: "Yesterday",
    health: 84,
  },
  {
    id: "harbor",
    name: "Harbor Studio",
    contact: "Nia Brooks",
    status: "At risk",
    value: "$12.6K",
    lastTouch: "4 days ago",
    health: 61,
  },
] as const;

const tabs = ["Timeline", "Notes", "Files"] as const;

const timeline = [
  { icon: Phone, title: "Discovery call completed", meta: "Mira Chen - 9:30 AM" },
  { icon: Mail, title: "Proposal packet sent", meta: "Lena Ortiz - Yesterday" },
  { icon: MessageSquareText, title: "Implementation questions answered", meta: "Support desk - Apr 29" },
];

const files = ["Statement of work.pdf", "Implementation checklist.docx", "CRM export.csv"];

type AccountId = (typeof accounts)[number]["id"];
type WorkspaceTab = (typeof tabs)[number];

interface CustomerWorkspaceProps {
  className?: string;
  interactive?: boolean;
}

export function CustomerWorkspace({ className, interactive = false }: CustomerWorkspaceProps) {
  const [selectedAccountId, setSelectedAccountId] = useState<AccountId>("acme");
  const [selectedTab, setSelectedTab] = useState<WorkspaceTab>("Timeline");
  const [note, setNote] = useState("Prep renewal deck and confirm integration timeline before Friday.");
  const [savedNote, setSavedNote] = useState(note);
  const [isStarred, setIsStarred] = useState(true);

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === selectedAccountId) ?? accounts[0],
    [selectedAccountId],
  );

  const selectAccount = (accountId: AccountId) => {
    if (interactive) {
      setSelectedAccountId(accountId);
    }
  };

  const selectTab = (tab: WorkspaceTab) => {
    if (interactive) {
      setSelectedTab(tab);
    }
  };

  return (
    <div className={cn("grid min-h-[620px] grid-cols-[290px_1fr] bg-background", className)}>
      <aside className="border-border border-r bg-muted/35 p-5">
        <div className="flex items-center justify-between">
          <div>
            <Badge appearance="outline" className="border-[#D15ABB]/20 bg-[#D15ABB]/10 text-[#8b1f6a]" size="sm">
              Accounts
            </Badge>
            <h3 className="mt-3 font-bold text-2xl tracking-tight">Customer Workspace</h3>
          </div>
          <div className="flex size-10 items-center justify-center rounded-xl bg-[#D15ABB] text-white">
            <Building2 className="size-5" />
          </div>
        </div>

        <div className="mt-6 space-y-3">
          {accounts.map((account) => (
            <button
              className={cn(
                "w-full rounded-2xl border border-border bg-background p-4 text-left shadow-sm transition",
                interactive && "hover:border-[#D15ABB]/35 hover:bg-card",
                selectedAccount.id === account.id && "border-[#D15ABB]/45 bg-card shadow-md",
              )}
              disabled={!interactive}
              key={account.id}
              onClick={() => selectAccount(account.id)}
              type="button"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold text-sm">{account.name}</div>
                  <div className="mt-1 text-muted-foreground text-xs">{account.contact}</div>
                </div>
                <Badge appearance={account.status === "At risk" ? "outline" : "light"} size="sm" variant="secondary">
                  {account.status}
                </Badge>
              </div>
              <div className="mt-4 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{account.lastTouch}</span>
                <span className="font-medium">{account.value}</span>
              </div>
            </button>
          ))}
        </div>
      </aside>

      <section className="p-6">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-[#D15ABB]/10 text-[#8b1f6a]">
                <UserRound className="size-6" />
              </div>
              <div>
                <h3 className="font-bold text-3xl tracking-tight">{selectedAccount.name}</h3>
                <p className="text-muted-foreground text-sm">Primary contact: {selectedAccount.contact}</p>
              </div>
            </div>
          </div>
          <button
            className={cn(
              buttonVariants({ variant: "outline" }),
              "h-10 rounded-full px-4",
              isStarred && "border-[#D15ABB]/30 bg-[#D15ABB]/10 text-[#8b1f6a]",
            )}
            disabled={!interactive}
            onClick={() => setIsStarred((current) => !current)}
            type="button"
          >
            <Star className={cn("size-4", isStarred && "fill-current")} />
            Key account
          </button>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-4">
          {[
            ["Health score", `${selectedAccount.health}%`],
            ["Open value", selectedAccount.value],
            ["Last touch", selectedAccount.lastTouch],
          ].map(([label, value]) => (
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm" key={label}>
              <div className="text-muted-foreground text-sm">{label}</div>
              <div className="mt-3 font-bold text-2xl">{value}</div>
            </div>
          ))}
        </div>

        <div className="mt-5 grid grid-cols-[1fr_310px] gap-4">
          <div className="rounded-2xl border border-border bg-card shadow-sm">
            <div className="flex gap-2 border-border border-b p-3">
              {tabs.map((tab) => (
                <button
                  className={cn(
                    "rounded-full px-4 py-2 font-medium text-sm transition",
                    selectedTab === tab ? "bg-[#D15ABB] text-white" : "text-muted-foreground hover:bg-muted",
                  )}
                  disabled={!interactive}
                  key={tab}
                  onClick={() => selectTab(tab)}
                  type="button"
                >
                  {tab}
                </button>
              ))}
            </div>
            <div className="min-h-[310px] p-5">
              {selectedTab === "Timeline" && (
                <div className="space-y-4">
                  {timeline.map((item) => (
                    <div className="flex gap-4 rounded-2xl border border-border bg-background p-4" key={item.title}>
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        <item.icon className="size-4" />
                      </div>
                      <div>
                        <div className="font-medium text-sm">{item.title}</div>
                        <div className="mt-1 text-muted-foreground text-xs">{item.meta}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {selectedTab === "Notes" && (
                <div>
                  <textarea
                    className="min-h-40 w-full resize-none rounded-2xl border border-border bg-background p-4 text-sm outline-none transition focus:border-[#D15ABB]/60 focus:ring-2 focus:ring-[#D15ABB]/15"
                    disabled={!interactive}
                    onChange={(event) => setNote(event.target.value)}
                    value={note}
                  />
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-muted-foreground text-xs">
                      {savedNote === note ? "Saved to FileMaker" : "Unsaved edits"}
                    </span>
                    <button
                      className={cn(buttonVariants({ variant: "primary" }), "rounded-full px-4")}
                      disabled={!interactive || savedNote === note}
                      onClick={() => setSavedNote(note)}
                      type="button"
                    >
                      Save note
                    </button>
                  </div>
                </div>
              )}

              {selectedTab === "Files" && (
                <div className="space-y-3">
                  {files.map((file) => (
                    <div
                      className="flex items-center justify-between rounded-2xl border border-border bg-background p-4"
                      key={file}
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="size-4 text-muted-foreground" />
                        <span className="font-medium text-sm">{file}</span>
                      </div>
                      <Badge appearance="outline" size="sm" variant="secondary">
                        Linked
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-2 font-semibold text-sm">
                <Clock3 className="size-4 text-muted-foreground" />
                Next step
              </div>
              <p className="mt-3 text-muted-foreground text-sm leading-6">
                Schedule executive walkthrough and confirm deployment owner.
              </p>
              <button
                className={cn(buttonVariants({ variant: "outline" }), "mt-4 w-full rounded-full")}
                disabled={!interactive}
                type="button"
              >
                <Plus className="size-4" />
                Add follow-up
              </button>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="font-semibold text-sm">Related records</div>
              <div className="mt-4 space-y-3 text-sm">
                {["3 open projects", "12 contacts", "7 support tickets"].map((item) => (
                  <div className="flex items-center justify-between" key={item}>
                    <span className="text-muted-foreground">{item}</span>
                    <span className="size-2 rounded-full bg-[#D15ABB]" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
