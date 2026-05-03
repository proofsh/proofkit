"use client";

import { Archive, Download, FileText, FolderOpen, Search, Share2, Star, Tag, Upload } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const documents = [
  {
    id: "sow",
    title: "Statement of work",
    account: "Acme Services",
    type: "Contract",
    updated: "Today",
    size: "1.8 MB",
    status: "Ready",
    tags: ["Contract", "Q2"],
    summary: "Defines the implementation scope, milestones, and acceptance criteria for the Acme portal rollout.",
  },
  {
    id: "checklist",
    title: "Implementation checklist",
    account: "Northstar Labs",
    type: "Operations",
    updated: "Yesterday",
    size: "420 KB",
    status: "Review",
    tags: ["Ops", "Launch"],
    summary: "Tracks launch tasks, owners, target dates, and go-live dependencies for the research intake workflow.",
  },
  {
    id: "invoice",
    title: "Invoice packet",
    account: "Harbor Studio",
    type: "Finance",
    updated: "Apr 29",
    size: "960 KB",
    status: "Ready",
    tags: ["Finance", "Q2"],
    summary: "Combines signed terms, invoice detail, and payment notes for the Harbor Studio onboarding package.",
  },
  {
    id: "brand",
    title: "Brand assets",
    account: "Brightline Co.",
    type: "Creative",
    updated: "Apr 27",
    size: "8.2 MB",
    status: "Draft",
    tags: ["Creative", "Launch"],
    summary: "Logo files, color tokens, and launch graphics linked from the customer record.",
  },
] as const;

const tags = ["All", "Contract", "Launch", "Finance", "Q2"] as const;

type DocumentId = (typeof documents)[number]["id"];
type DocumentTag = (typeof tags)[number];

interface DocumentCenterProps {
  className?: string;
  interactive?: boolean;
}

export function DocumentCenter({ className, interactive = false }: DocumentCenterProps) {
  const [activeTag, setActiveTag] = useState<DocumentTag>("All");
  const [query, setQuery] = useState("");
  const [selectedDocumentId, setSelectedDocumentId] = useState<DocumentId>("sow");
  const [starredIds, setStarredIds] = useState<DocumentId[]>(["sow", "checklist"]);
  const [archivedIds, setArchivedIds] = useState<DocumentId[]>([]);

  const filteredDocuments = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return documents.filter((document) => {
      const matchesTag = activeTag === "All" || document.tags.includes(activeTag);
      const matchesQuery =
        !normalizedQuery ||
        [document.title, document.account, document.type, document.status].some((value) =>
          value.toLowerCase().includes(normalizedQuery),
        );

      return matchesTag && matchesQuery && !archivedIds.includes(document.id);
    });
  }, [activeTag, archivedIds, query]);

  const selectedDocument =
    documents.find((document) => document.id === selectedDocumentId && !archivedIds.includes(document.id)) ??
    filteredDocuments[0] ??
    documents[0];

  const selectDocument = (documentId: DocumentId) => {
    if (interactive) {
      setSelectedDocumentId(documentId);
    }
  };

  const toggleStarred = () => {
    if (!interactive) {
      return;
    }

    setStarredIds((current) =>
      current.includes(selectedDocument.id)
        ? current.filter((documentId) => documentId !== selectedDocument.id)
        : [...current, selectedDocument.id],
    );
  };

  const archiveSelected = () => {
    if (!interactive) {
      return;
    }

    setArchivedIds((current) => [...current, selectedDocument.id]);
    const nextDocument = filteredDocuments.find((document) => document.id !== selectedDocument.id);

    if (nextDocument) {
      setSelectedDocumentId(nextDocument.id);
    }
  };

  return (
    <div className={cn("grid min-h-[620px] grid-cols-[1fr_330px] bg-background", className)}>
      <section className="p-6">
        <div className="flex items-start justify-between gap-6">
          <div>
            <Badge appearance="outline" className="border-[#D15ABB]/20 bg-[#D15ABB]/10 text-[#8b1f6a]" size="sm">
              Documents
            </Badge>
            <h3 className="mt-3 font-bold text-3xl tracking-tight">Document Center</h3>
            <p className="mt-1 text-muted-foreground text-sm">Browse files, tags, metadata, and linked records.</p>
          </div>
          <button
            className={cn(buttonVariants({ variant: "primary" }), "h-10 rounded-full px-5")}
            disabled={!interactive}
            type="button"
          >
            <Upload className="size-4" />
            Upload file
          </button>
        </div>

        <div className="mt-6 rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between gap-4 border-border border-b p-4">
            <div className="relative min-w-[320px]">
              <Search className="absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                className="h-10 w-full rounded-full border border-border bg-background pr-4 pl-11 text-sm outline-none transition placeholder:text-muted-foreground focus:border-[#D15ABB]/60 focus:ring-2 focus:ring-[#D15ABB]/15"
                disabled={!interactive}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search files, accounts, or status..."
                value={query}
              />
            </div>
            <div className="flex gap-2">
              {tags.map((tag) => (
                <button
                  className={cn(
                    "rounded-full px-3 py-2 font-medium text-xs transition",
                    activeTag === tag
                      ? "bg-[#D15ABB] text-white"
                      : "border border-border bg-background text-muted-foreground hover:bg-muted",
                  )}
                  disabled={!interactive}
                  key={tag}
                  onClick={() => setActiveTag(tag)}
                  type="button"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 p-4">
            {filteredDocuments.map((document) => (
              <button
                className={cn(
                  "rounded-2xl border border-border bg-background p-4 text-left shadow-sm transition",
                  interactive && "hover:border-[#D15ABB]/35",
                  selectedDocument.id === document.id && "border-[#D15ABB]/45 shadow-md",
                )}
                disabled={!interactive}
                key={document.id}
                onClick={() => selectDocument(document.id)}
                type="button"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#D15ABB]/10 text-[#8b1f6a]">
                      <FileText className="size-5" />
                    </div>
                    <div>
                      <div className="font-semibold text-sm">{document.title}</div>
                      <div className="mt-1 text-muted-foreground text-xs">{document.account}</div>
                    </div>
                  </div>
                  {starredIds.includes(document.id) && <Star className="size-4 fill-[#D15ABB] text-[#D15ABB]" />}
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <Badge appearance={document.status === "Ready" ? "light" : "outline"} size="sm" variant="secondary">
                    {document.status}
                  </Badge>
                  <span className="text-muted-foreground text-xs">{document.size}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      <aside className="border-border border-l bg-muted/35 p-5">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <FolderOpen className="size-5 text-[#8b1f6a]" />
              <div>
                <h4 className="font-semibold">{selectedDocument.title}</h4>
                <p className="text-muted-foreground text-xs">{selectedDocument.updated}</p>
              </div>
            </div>
            <button
              aria-label="Star selected document"
              className={cn(buttonVariants({ variant: "outline", size: "icon" }), "size-9 rounded-full")}
              disabled={!interactive}
              onClick={toggleStarred}
              type="button"
            >
              <Star
                className={cn("size-4", starredIds.includes(selectedDocument.id) && "fill-[#D15ABB] text-[#D15ABB]")}
              />
            </button>
          </div>

          <div className="mt-5 rounded-2xl border border-border bg-background p-4">
            <div className="flex h-36 items-center justify-center rounded-xl bg-muted/55">
              <FileText className="size-10 text-muted-foreground" />
            </div>
            <p className="mt-4 text-muted-foreground text-sm leading-6">{selectedDocument.summary}</p>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {selectedDocument.tags.map((tag) => (
              <Badge appearance="outline" key={tag} size="sm" variant="secondary">
                <Tag className="size-3" />
                {tag}
              </Badge>
            ))}
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2">
            <button
              className={cn(buttonVariants({ variant: "outline" }), "rounded-full")}
              disabled={!interactive}
              type="button"
            >
              <Download className="size-4" />
            </button>
            <button
              className={cn(buttonVariants({ variant: "outline" }), "rounded-full")}
              disabled={!interactive}
              type="button"
            >
              <Share2 className="size-4" />
            </button>
            <button
              className={cn(buttonVariants({ variant: "outline" }), "rounded-full")}
              disabled={!interactive}
              onClick={archiveSelected}
              type="button"
            >
              <Archive className="size-4" />
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="font-semibold text-sm">Attachment metadata</div>
          <div className="mt-4 space-y-3 text-sm">
            <MetadataRow label="Type" value={selectedDocument.type} />
            <MetadataRow label="Account" value={selectedDocument.account} />
            <MetadataRow label="Status" value={selectedDocument.status} />
            <MetadataRow label="Size" value={selectedDocument.size} />
          </div>
        </div>
      </aside>
    </div>
  );
}

function MetadataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
