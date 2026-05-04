"use client";

import { CheckCircle2, Clock3, MessageSquareText, ShieldCheck, ThumbsDown, ThumbsUp, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const requests = [
  {
    id: "discount",
    title: "Enterprise discount",
    account: "Acme Services",
    requester: "Mira Chen",
    amount: "$8,400",
    status: "Pending",
    risk: "Medium",
    submitted: "18 min ago",
    detail: "Approve a 12% contract discount for the expanded services package.",
  },
  {
    id: "vendor",
    title: "New vendor onboarding",
    account: "Northstar Labs",
    requester: "Theo Grant",
    amount: "$2,100/mo",
    status: "Pending",
    risk: "Low",
    submitted: "1 hour ago",
    detail: "Authorize monthly platform vendor for the research operations team.",
  },
  {
    id: "writeoff",
    title: "Invoice write-off",
    account: "Harbor Studio",
    requester: "Nia Brooks",
    amount: "$1,260",
    status: "Needs info",
    risk: "High",
    submitted: "Yesterday",
    detail: "Review disputed onboarding invoice before finance closes the period.",
  },
] as const;

const history = [
  ["Submitted", "Mira Chen created the request"],
  ["Routed", "Policy matched revenue approval queue"],
  ["Commented", "Finance asked for margin confirmation"],
] as const;

type RequestId = (typeof requests)[number]["id"];
type Decision = "approved" | "rejected" | null;

interface ApprovalInboxProps {
  className?: string;
  interactive?: boolean;
}

export function ApprovalInbox({ className, interactive = false }: ApprovalInboxProps) {
  const [selectedRequestId, setSelectedRequestId] = useState<RequestId>("discount");
  const [comment, setComment] = useState("Margin stays above threshold after services adjustment.");
  const [decisionByRequest, setDecisionByRequest] = useState<Record<RequestId, Decision>>({
    discount: null,
    vendor: null,
    writeoff: null,
  });
  const [commentByRequest, setCommentByRequest] = useState<Record<RequestId, string>>({
    discount: comment,
    vendor: "Vendor terms match standard procurement limits.",
    writeoff: "Need finance attachment before final decision.",
  });

  const selectedRequest = useMemo(
    () => requests.find((request) => request.id === selectedRequestId) ?? requests[0],
    [selectedRequestId],
  );
  const selectedDecision = decisionByRequest[selectedRequest.id];
  const pendingCount = Object.values(decisionByRequest).filter((decision) => decision === null).length;

  const selectRequest = (requestId: RequestId) => {
    if (!interactive) {
      return;
    }

    setSelectedRequestId(requestId);
    setComment(commentByRequest[requestId]);
  };

  const saveComment = () => {
    if (!interactive) {
      return;
    }

    setCommentByRequest((current) => ({ ...current, [selectedRequest.id]: comment }));
  };

  const decide = (decision: Exclude<Decision, null>) => {
    if (!interactive) {
      return;
    }

    setDecisionByRequest((current) => ({ ...current, [selectedRequest.id]: decision }));
  };

  return (
    <div className={cn("grid min-h-[620px] grid-cols-[330px_1fr] bg-background", className)}>
      <aside className="border-border border-r bg-muted/35 p-5">
        <div className="flex items-center justify-between">
          <div>
            <Badge appearance="outline" className="border-[#D15ABB]/20 bg-[#D15ABB]/10 text-[#8b1f6a]" size="sm">
              Review queue
            </Badge>
            <h3 className="mt-3 font-bold text-2xl tracking-tight">Approval Inbox</h3>
          </div>
          <Badge appearance="light" size="md" variant="warning">
            {pendingCount} pending
          </Badge>
        </div>

        <div className="mt-6 space-y-3">
          {requests.map((request) => {
            const decision = decisionByRequest[request.id];

            return (
              <button
                className={cn(
                  "w-full rounded-2xl border border-border bg-background p-4 text-left shadow-sm transition",
                  interactive && "hover:border-[#D15ABB]/35 hover:bg-card",
                  selectedRequest.id === request.id && "border-[#D15ABB]/45 bg-card shadow-md",
                )}
                disabled={!interactive}
                key={request.id}
                onClick={() => selectRequest(request.id)}
                type="button"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-sm">{request.title}</div>
                    <div className="mt-1 text-muted-foreground text-xs">{request.account}</div>
                  </div>
                  <StatusBadge decision={decision} fallback={request.status} />
                </div>
                <div className="mt-4 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{request.submitted}</span>
                  <span className="font-medium">{request.amount}</span>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      <section className="p-6">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-[#D15ABB]/10 text-[#8b1f6a]">
                <ShieldCheck className="size-6" />
              </div>
              <div>
                <h3 className="font-bold text-3xl tracking-tight">{selectedRequest.title}</h3>
                <p className="text-muted-foreground text-sm">
                  {selectedRequest.account} - requested by {selectedRequest.requester}
                </p>
              </div>
            </div>
          </div>
          <StatusBadge decision={selectedDecision} fallback={selectedRequest.status} />
        </div>

        <div className="mt-6 grid grid-cols-3 gap-4">
          {[
            ["Amount", selectedRequest.amount],
            ["Risk", selectedRequest.risk],
            ["Submitted", selectedRequest.submitted],
          ].map(([label, value]) => (
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm" key={label}>
              <div className="text-muted-foreground text-sm">{label}</div>
              <div className="mt-3 font-bold text-2xl">{value}</div>
            </div>
          ))}
        </div>

        <div className="mt-5 grid grid-cols-[1fr_320px] gap-4">
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold">Request summary</h4>
                <Badge appearance={selectedRequest.risk === "High" ? "outline" : "light"} size="sm" variant="warning">
                  {selectedRequest.risk} risk
                </Badge>
              </div>
              <p className="mt-3 text-muted-foreground text-sm leading-6">{selectedRequest.detail}</p>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <PolicyCard label="Policy" value="Manager approval required" />
                <PolicyCard label="Source record" value="FileMaker request #1048" />
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-2 font-semibold">
                <MessageSquareText className="size-4 text-muted-foreground" />
                Reviewer comment
              </div>
              <textarea
                className="mt-4 min-h-28 w-full resize-none rounded-2xl border border-border bg-background p-4 text-sm outline-none transition focus:border-[#D15ABB]/60 focus:ring-2 focus:ring-[#D15ABB]/15"
                disabled={!interactive}
                onChange={(event) => setComment(event.target.value)}
                value={comment}
              />
              <div className="mt-3 flex items-center justify-between">
                <span className="text-muted-foreground text-xs">
                  {commentByRequest[selectedRequest.id] === comment ? "Comment saved" : "Unsaved comment"}
                </span>
                <button
                  className={cn(buttonVariants({ variant: "outline" }), "rounded-full px-4")}
                  disabled={!interactive || commentByRequest[selectedRequest.id] === comment}
                  onClick={saveComment}
                  type="button"
                >
                  Save comment
                </button>
              </div>
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="font-semibold">Decision</div>
              <p className="mt-2 text-muted-foreground text-sm leading-6">
                Approve or reject the request and write the decision back to FileMaker.
              </p>
              <div className="mt-5 grid gap-2">
                <button
                  className={cn(
                    buttonVariants({ variant: "primary" }),
                    "h-10 rounded-full",
                    selectedDecision === "approved" && "ring-2 ring-emerald-500/25",
                  )}
                  disabled={!interactive}
                  onClick={() => decide("approved")}
                  type="button"
                >
                  <ThumbsUp className="size-4" />
                  Approve
                </button>
                <button
                  className={cn(
                    buttonVariants({ variant: "outline" }),
                    "h-10 rounded-full",
                    selectedDecision === "rejected" &&
                      "border-destructive/40 text-destructive ring-2 ring-destructive/15",
                  )}
                  disabled={!interactive}
                  onClick={() => decide("rejected")}
                  type="button"
                >
                  <ThumbsDown className="size-4" />
                  Reject
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-2 font-semibold text-sm">
                <Clock3 className="size-4 text-muted-foreground" />
                Status history
              </div>
              <div className="mt-4 space-y-4">
                {history.map(([label, detail]) => (
                  <div className="flex gap-3" key={label}>
                    <span className="mt-1 size-2 rounded-full bg-[#D15ABB]" />
                    <div>
                      <div className="font-medium text-sm">{label}</div>
                      <div className="mt-1 text-muted-foreground text-xs">{detail}</div>
                    </div>
                  </div>
                ))}
                {selectedDecision && (
                  <div className="flex gap-3">
                    <span className="mt-1 size-2 rounded-full bg-emerald-500" />
                    <div>
                      <div className="font-medium text-sm">
                        {selectedDecision === "approved" ? "Approved" : "Rejected"}
                      </div>
                      <div className="mt-1 text-muted-foreground text-xs">Decision captured by reviewer</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}

function StatusBadge({ decision, fallback }: { decision: Decision; fallback: string }) {
  if (decision === "approved") {
    return (
      <Badge appearance="light" size="sm" variant="success">
        <CheckCircle2 className="size-3" />
        Approved
      </Badge>
    );
  }

  if (decision === "rejected") {
    return (
      <Badge appearance="outline" size="sm" variant="destructive">
        Rejected
      </Badge>
    );
  }

  return (
    <Badge appearance={fallback === "Needs info" ? "outline" : "light"} size="sm" variant="warning">
      {fallback}
    </Badge>
  );
}

function PolicyCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="flex items-center gap-2 text-muted-foreground text-xs">
        <UserRound className="size-3.5" />
        {label}
      </div>
      <div className="mt-2 font-medium text-sm">{value}</div>
    </div>
  );
}
