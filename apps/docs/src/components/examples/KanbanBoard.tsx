"use client";

import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import { ArrowLeft, ArrowRight, CalendarDays, GripVertical, Plus, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const columns = [
  { id: "backlog", label: "Backlog", accent: "bg-slate-400" },
  { id: "active", label: "Active", accent: "bg-[#D15ABB]" },
  { id: "review", label: "Review", accent: "bg-amber-500" },
  { id: "closed", label: "Closed", accent: "bg-emerald-500" },
] as const;

type ColumnId = (typeof columns)[number]["id"];

const initialCards = [
  {
    id: "acme",
    title: "Acme Services portal",
    account: "Acme Services",
    owner: "Lena",
    due: "May 6",
    value: 28_400,
    stage: "backlog" as ColumnId,
    tags: ["Web Viewer", "Contacts"],
  },
  {
    id: "northstar",
    title: "Northstar intake board",
    account: "Northstar Labs",
    owner: "Miles",
    due: "May 8",
    value: 41_200,
    stage: "active" as ColumnId,
    tags: ["Workflow", "Priority"],
  },
  {
    id: "brightline",
    title: "Brightline service queue",
    account: "Brightline Co.",
    owner: "Ari",
    due: "May 10",
    value: 18_900,
    stage: "active" as ColumnId,
    tags: ["Support", "SLA"],
  },
  {
    id: "harbor",
    title: "Harbor approval flow",
    account: "Harbor Studio",
    owner: "Nia",
    due: "May 12",
    value: 12_600,
    stage: "review" as ColumnId,
    tags: ["Approvals", "Design"],
  },
  {
    id: "kestrel",
    title: "Kestrel patient follow-up",
    account: "Kestrel Health",
    owner: "Owen",
    due: "May 14",
    value: 33_700,
    stage: "review" as ColumnId,
    tags: ["Health", "Tasks"],
  },
  {
    id: "juniper",
    title: "Juniper production tracker",
    account: "Juniper Works",
    owner: "Sofia",
    due: "Done",
    value: 9800,
    stage: "closed" as ColumnId,
    tags: ["Ops", "Dashboard"],
  },
];

type KanbanCardItem = (typeof initialCards)[number];

interface KanbanBoardProps {
  className?: string;
  interactive?: boolean;
}

export function KanbanBoard({ className, interactive = false }: KanbanBoardProps) {
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [cards, setCards] = useState(initialCards);
  const totalValue = useMemo(() => cards.reduce((sum, card) => sum + card.value, 0), [cards]);
  const activeCard = activeCardId ? cards.find((card) => card.id === activeCardId) : null;

  const moveCard = (cardId: string, direction: -1 | 1) => {
    setCards((currentCards) =>
      currentCards.map((card) => {
        if (card.id !== cardId) {
          return card;
        }

        const currentIndex = columns.findIndex((column) => column.id === card.stage);
        const nextColumn = columns[currentIndex + direction];

        return nextColumn ? { ...card, stage: nextColumn.id } : card;
      }),
    );
  };

  const moveCardToColumn = (cardId: string, columnId: ColumnId) => {
    setCards((currentCards) => currentCards.map((card) => (card.id === cardId ? { ...card, stage: columnId } : card)));
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveCardId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const targetColumnId = event.over?.id;

    if (isColumnId(targetColumnId)) {
      moveCardToColumn(String(event.active.id), targetColumnId);
    }

    setActiveCardId(null);
  };

  const board = (
    <>
      <div className="mt-6 grid grid-cols-4 gap-4">
        {columns.map((column) => {
          const columnCards = cards.filter((card) => card.stage === column.id);

          return (
            <KanbanColumn
              cards={columnCards}
              column={column}
              interactive={interactive}
              key={column.id}
              onMove={moveCard}
            />
          );
        })}
      </div>

      {interactive && (
        <DragOverlay>
          {activeCard ? (
            <div className="w-[220px] rotate-2 opacity-95">
              <KanbanCardSurface card={activeCard} />
            </div>
          ) : null}
        </DragOverlay>
      )}
    </>
  );

  return (
    <div className={cn("min-h-[620px] bg-background", className)}>
      <section className="p-6">
        <div className="flex items-start justify-between gap-6">
          <div>
            <Badge appearance="outline" className="border-[#D15ABB]/20 bg-[#D15ABB]/10 text-[#8b1f6a]" size="sm">
              Kanban
            </Badge>
            <h3 className="mt-3 font-bold text-3xl tracking-tight">Project pipeline</h3>
            <p className="mt-1 text-muted-foreground text-sm">
              Move work across stages and keep customer projects in view.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-border bg-card px-4 py-3 text-right shadow-sm">
              <div className="text-muted-foreground text-xs">Open value</div>
              <div className="font-bold text-lg">${Math.round(totalValue / 1000)}K</div>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-[#D15ABB] px-4 py-2 font-medium text-sm text-white shadow-sm">
              <Plus className="size-4" />
              New card
            </div>
          </div>
        </div>

        {interactive ? (
          <DndContext onDragEnd={handleDragEnd} onDragStart={handleDragStart}>
            {board}
          </DndContext>
        ) : (
          board
        )}
      </section>
    </div>
  );
}

interface KanbanColumnProps {
  cards: KanbanCardItem[];
  column: (typeof columns)[number];
  interactive: boolean;
  onMove: (cardId: string, direction: -1 | 1) => void;
}

function KanbanColumn({ cards, column, interactive, onMove }: KanbanColumnProps) {
  const { isOver, setNodeRef } = useDroppable({
    disabled: !interactive,
    id: column.id,
  });
  const columnValue = cards.reduce((sum, card) => sum + card.value, 0);

  return (
    <section
      className={cn(
        "rounded-2xl border border-border bg-muted/35 p-3 transition",
        isOver && "border-[#D15ABB]/60 bg-[#D15ABB]/10 ring-2 ring-[#D15ABB]/15",
      )}
      ref={setNodeRef}
    >
      <div className="mb-3 flex items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2">
          <span className={cn("size-2.5 rounded-full", column.accent)} />
          <h4 className="font-semibold text-sm">{column.label}</h4>
          <Badge appearance="light" size="sm" variant="secondary">
            {cards.length}
          </Badge>
        </div>
        <span className="font-medium text-muted-foreground text-xs">${Math.round(columnValue / 1000)}K</span>
      </div>

      <div className="space-y-3">
        {cards.map((card) => (
          <KanbanCard card={card} interactive={interactive} key={card.id} onMove={onMove} />
        ))}
        {cards.length === 0 && (
          <div className="flex h-32 items-center justify-center rounded-2xl border border-border border-dashed bg-background/55 text-muted-foreground text-sm">
            Drop cards here
          </div>
        )}
      </div>
    </section>
  );
}

interface KanbanCardProps {
  card: KanbanCardItem;
  interactive: boolean;
  onMove: (cardId: string, direction: -1 | 1) => void;
}

function KanbanCard({ card, interactive, onMove }: KanbanCardProps) {
  const columnIndex = columns.findIndex((column) => column.id === card.stage);
  const canMoveLeft = columnIndex > 0;
  const canMoveRight = columnIndex < columns.length - 1;
  const { attributes, isDragging, listeners, setActivatorNodeRef, setNodeRef, transform } = useDraggable({
    disabled: !interactive,
    id: card.id,
  });
  const dragStyle = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <article
      className={cn(
        "rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
        isDragging && "opacity-40",
      )}
      ref={setNodeRef}
      style={dragStyle}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h5 className="font-semibold text-sm leading-5">{card.title}</h5>
          <p className="mt-1 text-muted-foreground text-xs">{card.account}</p>
        </div>
        <div
          className={cn(
            "rounded-md text-muted-foreground",
            interactive && "cursor-grab touch-none outline-none transition hover:bg-muted hover:text-foreground",
          )}
          ref={setActivatorNodeRef}
          {...(interactive ? attributes : {})}
          {...(interactive ? listeners : {})}
        >
          <GripVertical className="size-4 shrink-0" />
        </div>
      </div>

      <KanbanCardDetails card={card} />

      <div className="mt-4 flex items-center justify-between gap-3 border-border border-t pt-3">
        <span className="font-bold text-sm">${card.value.toLocaleString()}</span>
        {interactive ? (
          <div className="flex items-center gap-1">
            <button
              aria-label={`Move ${card.title} left`}
              className="flex size-7 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-35"
              disabled={!canMoveLeft}
              onClick={() => onMove(card.id, -1)}
              type="button"
            >
              <ArrowLeft className="size-3.5" />
            </button>
            <button
              aria-label={`Move ${card.title} right`}
              className="flex size-7 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-35"
              disabled={!canMoveRight}
              onClick={() => onMove(card.id, 1)}
              type="button"
            >
              <ArrowRight className="size-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-muted-foreground">
            <span className="size-2 rounded-full bg-current opacity-40" />
            <span className="size-2 rounded-full bg-current opacity-70" />
          </div>
        )}
      </div>
    </article>
  );
}

function KanbanCardSurface({ card }: { card: KanbanCardItem }) {
  return (
    <article className="rounded-2xl border border-border bg-card p-4 shadow-xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h5 className="font-semibold text-sm leading-5">{card.title}</h5>
          <p className="mt-1 text-muted-foreground text-xs">{card.account}</p>
        </div>
        <GripVertical className="size-4 shrink-0 text-muted-foreground" />
      </div>
      <KanbanCardDetails card={card} />
      <div className="mt-4 border-border border-t pt-3 font-bold text-sm">${card.value.toLocaleString()}</div>
    </article>
  );
}

function KanbanCardDetails({ card }: { card: KanbanCardItem }) {
  return (
    <>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {card.tags.map((tag) => (
          <Badge appearance="light" key={tag} size="xs" variant="secondary">
            {tag}
          </Badge>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <UserRound className="size-3.5" />
          {card.owner}
        </div>
        <div className="flex items-center justify-end gap-1.5 text-muted-foreground">
          <CalendarDays className="size-3.5" />
          {card.due}
        </div>
      </div>
    </>
  );
}

function isColumnId(value: unknown): value is ColumnId {
  return typeof value === "string" && columns.some((column) => column.id === value);
}
