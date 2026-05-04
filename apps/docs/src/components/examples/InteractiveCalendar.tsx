"use client";

import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  GripVertical,
  MapPin,
  Plus,
  UserRound,
} from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const months = [
  { id: "2026-04", label: "April 2026", shortLabel: "Apr", days: 30, startsOn: 3 },
  { id: "2026-05", label: "May 2026", shortLabel: "May", days: 31, startsOn: 5 },
  { id: "2026-06", label: "June 2026", shortLabel: "Jun", days: 30, startsOn: 1 },
] as const;

const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const calendarDatePattern = /^\d{4}-\d{2}-\d{2}$/;

const eventTypes = [
  { id: "all", label: "All", color: "bg-slate-400", badge: "secondary" },
  { id: "consult", label: "Consults", color: "bg-[#D15ABB]", badge: "info" },
  { id: "follow-up", label: "Follow-up", color: "bg-amber-500", badge: "warning" },
  { id: "delivery", label: "Delivery", color: "bg-emerald-500", badge: "success" },
] as const;

type EventTypeId = (typeof eventTypes)[number]["id"];
type EventKind = Exclude<EventTypeId, "all">;

interface CalendarEvent {
  account: string;
  date: string;
  id: string;
  location: string;
  notes: string;
  owner: string;
  time: string;
  title: string;
  type: EventKind;
}

const initialEvents: CalendarEvent[] = [
  {
    id: "design-review",
    date: "2026-05-04",
    title: "Design review",
    account: "Harbor Studio",
    owner: "Nia Brooks",
    time: "9:30 AM",
    location: "Zoom",
    notes: "Review the first pass at the Web Viewer workflow and capture launch blockers.",
    type: "consult",
  },
  {
    id: "northstar-kickoff",
    date: "2026-05-07",
    title: "Northstar kickoff",
    account: "Northstar Labs",
    owner: "Miles Reed",
    time: "11:00 AM",
    location: "Conference B",
    notes: "Confirm intake fields, permissions, and handoff steps with the project sponsor.",
    type: "consult",
  },
  {
    id: "acme-follow-up",
    date: "2026-05-07",
    title: "Acme follow-up",
    account: "Acme Services",
    owner: "Lena Ortiz",
    time: "2:00 PM",
    location: "Phone",
    notes: "Check whether the team is ready to replace the legacy contact layout.",
    type: "follow-up",
  },
  {
    id: "kestrel-check-in",
    date: "2026-05-12",
    title: "Patient portal check-in",
    account: "Kestrel Health",
    owner: "Owen Lee",
    time: "10:15 AM",
    location: "Zoom",
    notes: "Walk through follow-up reminders and patient status filters.",
    type: "follow-up",
  },
  {
    id: "brightline-training",
    date: "2026-05-18",
    title: "Team training",
    account: "Brightline Co.",
    owner: "Ari Patel",
    time: "1:00 PM",
    location: "On-site",
    notes: "Train the support team on queue triage, assignment, and escalation views.",
    type: "delivery",
  },
  {
    id: "juniper-launch",
    date: "2026-05-21",
    title: "Production launch",
    account: "Juniper Works",
    owner: "Sofia Ray",
    time: "3:30 PM",
    location: "Operations floor",
    notes: "Deploy the production tracker and verify the shift handoff dashboard.",
    type: "delivery",
  },
  {
    id: "harbor-retro",
    date: "2026-06-02",
    title: "Approval flow retro",
    account: "Harbor Studio",
    owner: "Nia Brooks",
    time: "9:00 AM",
    location: "Zoom",
    notes: "Review the approval workflow after launch and collect next iteration ideas.",
    type: "follow-up",
  },
];

interface InteractiveCalendarProps {
  className?: string;
  interactive?: boolean;
}

export function InteractiveCalendar({ className, interactive = false }: InteractiveCalendarProps) {
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const [activeMonthIndex, setActiveMonthIndex] = useState(1);
  const [activeType, setActiveType] = useState<EventTypeId>("all");
  const [calendarEvents, setCalendarEvents] = useState(initialEvents);
  const [savedEventId, setSavedEventId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState("2026-05-07");
  const [selectedEventId, setSelectedEventId] = useState<string | null>("northstar-kickoff");
  const activeMonth = months[activeMonthIndex];

  const visibleEvents = useMemo(
    () =>
      calendarEvents.filter(
        (event) => event.date.startsWith(activeMonth.id) && (activeType === "all" || event.type === activeType),
      ),
    [activeMonth.id, activeType, calendarEvents],
  );
  const selectedEvents = visibleEvents.filter((event) => event.date === selectedDate);
  const selectedEvent = selectedEventId ? calendarEvents.find((event) => event.id === selectedEventId) : null;
  const activeEvent = activeEventId ? calendarEvents.find((event) => event.id === activeEventId) : null;
  const calendarDays = buildCalendarDays(activeMonth);

  const changeMonth = (direction: -1 | 1) => {
    setActiveMonthIndex((currentIndex) => {
      const nextIndex = Math.min(Math.max(currentIndex + direction, 0), months.length - 1);
      const nextMonth = months[nextIndex];
      const firstEvent = calendarEvents.find(
        (event) => event.date.startsWith(nextMonth.id) && (activeType === "all" || event.type === activeType),
      );

      setSelectedDate(firstEvent?.date ?? `${nextMonth.id}-01`);
      setSelectedEventId(firstEvent?.id ?? null);
      return nextIndex;
    });
  };

  const changeEventType = (typeId: EventTypeId) => {
    setActiveType(typeId);

    const firstEvent = calendarEvents.find(
      (event) => event.date.startsWith(activeMonth.id) && (typeId === "all" || event.type === typeId),
    );
    if (firstEvent) {
      setSelectedDate(firstEvent.date);
      setSelectedEventId(firstEvent.id);
    }
  };

  const selectEvent = (event: CalendarEvent) => {
    setSavedEventId(null);
    setSelectedDate(event.date);
    setSelectedEventId(event.id);
  };

  const updateEvent = (eventId: string, changes: Partial<CalendarEvent>) => {
    setCalendarEvents((currentEvents) =>
      currentEvents.map((event) => (event.id === eventId ? { ...event, ...changes } : event)),
    );
    setSavedEventId(eventId);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveEventId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const eventId = String(event.active.id);
    const targetDate = event.over?.id;

    if (typeof targetDate === "string" && isCalendarDate(targetDate)) {
      updateEvent(eventId, { date: targetDate });
      setSelectedDate(targetDate);
      setSelectedEventId(eventId);
    }

    setActiveEventId(null);
  };

  const calendar = (
    <>
      <div className="grid grid-cols-7 p-4">
        {calendarDays.map((day, index) => {
          const date = day ? `${activeMonth.id}-${String(day).padStart(2, "0")}` : null;
          const dayEvents = date ? visibleEvents.filter((event) => event.date === date) : [];
          const isSelected = date === selectedDate;

          return (
            <CalendarDay
              activeEventId={activeEventId}
              date={date}
              day={day}
              events={dayEvents}
              index={index}
              interactive={interactive}
              isSelected={isSelected}
              key={date ?? `blank-${index}`}
              onSelect={() => date && setSelectedDate(date)}
              onSelectEvent={selectEvent}
            />
          );
        })}
      </div>

      {interactive && (
        <DragOverlay>
          {activeEvent ? (
            <div className="w-[180px] rotate-2 opacity-95">
              <EventPillSurface event={activeEvent} />
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
              Calendar
            </Badge>
            <h3 className="mt-3 font-bold text-3xl tracking-tight">Customer schedule</h3>
            <p className="mt-1 text-muted-foreground text-sm">
              Plan meetings, follow-ups, and delivery milestones from one FileMaker view.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-border bg-card px-4 py-3 text-right shadow-sm">
              <div className="text-muted-foreground text-xs">This month</div>
              <div className="font-bold text-lg">{visibleEvents.length} events</div>
            </div>
            <StaticOrButton
              className="rounded-full bg-[#D15ABB] px-4 py-2 font-medium text-sm text-white shadow-sm hover:bg-[#BD4EA8]"
              interactive={interactive}
            >
              <Plus className="size-4" />
              New event
            </StaticOrButton>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-[1fr_320px] gap-4">
          <div className="rounded-2xl border border-border bg-card shadow-sm">
            <div className="flex items-center justify-between gap-4 border-border border-b p-4">
              <div className="flex items-center gap-2">
                <StaticOrButton
                  ariaLabel="Previous month"
                  className={cn(buttonVariants({ variant: "outline", size: "icon" }), "size-9 rounded-full")}
                  disabled={activeMonthIndex === 0}
                  interactive={interactive}
                  onClick={() => changeMonth(-1)}
                >
                  <ChevronLeft className="size-4" />
                </StaticOrButton>
                <StaticOrButton
                  ariaLabel="Next month"
                  className={cn(buttonVariants({ variant: "outline", size: "icon" }), "size-9 rounded-full")}
                  disabled={activeMonthIndex === months.length - 1}
                  interactive={interactive}
                  onClick={() => changeMonth(1)}
                >
                  <ChevronRight className="size-4" />
                </StaticOrButton>
                <div className="ml-2">
                  <div className="font-bold text-xl">{activeMonth.label}</div>
                  <div className="text-muted-foreground text-xs">Click a day to focus the agenda.</div>
                </div>
              </div>
              <div className="flex rounded-full border border-border bg-muted/35 p-1">
                {eventTypes.map((type) => (
                  <StaticOrButton
                    ariaPressed={activeType === type.id}
                    className={cn(
                      "rounded-full px-3 py-1.5 font-medium text-xs transition",
                      activeType === type.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
                    )}
                    interactive={interactive}
                    key={type.id}
                    onClick={() => changeEventType(type.id)}
                  >
                    {type.label}
                  </StaticOrButton>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-7 border-border border-b bg-muted/35 px-4 py-3 font-medium text-[0.68rem] text-muted-foreground uppercase tracking-[0.16em]">
              {weekDays.map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>

            {interactive ? (
              <DndContext onDragEnd={handleDragEnd} onDragStart={handleDragStart}>
                {calendar}
              </DndContext>
            ) : (
              calendar
            )}
          </div>

          <aside className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <CalendarDays className="size-4 text-[#D15ABB]" />
              <div>
                <h4 className="font-semibold text-sm">Focused agenda</h4>
                <p className="text-muted-foreground text-xs">{formatDateLabel(selectedDate)}</p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {selectedEvent && interactive && (
                <EventDetailCard
                  event={selectedEvent}
                  isSaved={savedEventId === selectedEvent.id}
                  key={selectedEvent.id}
                  onSave={(changes) => updateEvent(selectedEvent.id, changes)}
                />
              )}
              {(selectedEvents.length > 0 ? selectedEvents : visibleEvents.slice(0, 4)).map((event) => (
                <AgendaItem
                  event={event}
                  interactive={interactive}
                  key={event.id}
                  onSelect={() => selectEvent(event)}
                />
              ))}
              {visibleEvents.length === 0 && (
                <div className="flex h-36 items-center justify-center rounded-2xl border border-border border-dashed bg-muted/35 text-center text-muted-foreground text-sm">
                  No events match this filter.
                </div>
              )}
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}

interface StaticOrButtonProps {
  ariaLabel?: string;
  ariaPressed?: boolean;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  interactive: boolean;
  onClick?: () => void;
}

function StaticOrButton({
  ariaLabel,
  ariaPressed,
  children,
  className,
  disabled,
  interactive,
  onClick,
}: StaticOrButtonProps) {
  if (!interactive) {
    return <div className={cn("inline-flex items-center justify-center gap-2", className)}>{children}</div>;
  }

  return (
    <button
      aria-label={ariaLabel}
      aria-pressed={ariaPressed}
      className={cn("inline-flex items-center justify-center gap-2", className)}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

interface CalendarDayProps {
  activeEventId: string | null;
  date: string | null;
  day: number | null;
  events: CalendarEvent[];
  index: number;
  interactive: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onSelectEvent: (event: CalendarEvent) => void;
}

function CalendarDay({
  activeEventId,
  date,
  day,
  events: dayEvents,
  index,
  interactive,
  isSelected,
  onSelect,
  onSelectEvent,
}: CalendarDayProps) {
  const { isOver, setNodeRef } = useDroppable({
    disabled: !(interactive && date),
    id: date ?? `blank-${index}`,
  });
  const className = cn(
    "min-h-[86px] border-border border-r border-b p-2 text-left transition",
    index < 7 && "border-t",
    index % 7 === 0 && "border-l",
    day ? "bg-background hover:bg-muted/45" : "bg-muted/20",
    isSelected && "relative z-10 border-[#D15ABB]/50 bg-[#D15ABB]/10 ring-2 ring-[#D15ABB]/20",
    isOver && "relative z-20 border-[#D15ABB]/60 bg-[#D15ABB]/15 ring-2 ring-[#D15ABB]/25",
  );
  const content = (
    <>
      {interactive && date ? (
        <button
          aria-label={`Select ${formatDateLabel(date)}`}
          className="rounded-md px-1 font-semibold text-sm transition hover:bg-muted"
          onClick={onSelect}
          type="button"
        >
          {day}
        </button>
      ) : (
        <div className={cn("font-semibold text-sm", !day && "text-transparent")}>{day ?? 0}</div>
      )}
      <div className="mt-2 space-y-1">
        {dayEvents.slice(0, 2).map((event) => (
          <EventPill
            event={event}
            interactive={interactive}
            isDragging={activeEventId === event.id}
            key={event.id}
            onSelect={() => onSelectEvent(event)}
          />
        ))}
        {dayEvents.length > 2 && <div className="text-muted-foreground text-xs">+{dayEvents.length - 2} more</div>}
      </div>
    </>
  );

  if (!(interactive && date)) {
    return <div className={className}>{content}</div>;
  }

  return (
    <div className={className} ref={setNodeRef}>
      {content}
    </div>
  );
}

function EventPill({
  event,
  interactive,
  isDragging,
  onSelect,
}: {
  event: CalendarEvent;
  interactive: boolean;
  isDragging: boolean;
  onSelect: () => void;
}) {
  const {
    attributes,
    isDragging: isActivelyDragging,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
  } = useDraggable({
    disabled: !interactive,
    id: event.id,
  });
  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;
  const type = eventTypeFor(event.type);
  const className = cn(
    "flex w-full items-center gap-1.5 truncate rounded-md px-1 py-0.5 text-left text-xs transition",
    interactive && "cursor-pointer hover:bg-muted",
    (isDragging || isActivelyDragging) && "opacity-35",
  );
  const content = (
    <>
      <span className={cn("size-1.5 shrink-0 rounded-full", type.color)} />
      <span className="truncate">{event.title}</span>
      {interactive && (
        <span
          className="ml-auto rounded-sm text-muted-foreground opacity-55 outline-none transition hover:bg-background hover:opacity-100"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-3" />
        </span>
      )}
    </>
  );

  if (!interactive) {
    return <div className={className}>{content}</div>;
  }

  return (
    <button
      className={className}
      onClick={(clickEvent) => {
        clickEvent.stopPropagation();
        onSelect();
      }}
      ref={setNodeRef}
      style={style}
      type="button"
    >
      {content}
    </button>
  );
}

function EventPillSurface({ event }: { event: CalendarEvent }) {
  const type = eventTypeFor(event.type);

  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 text-xs shadow-xl">
      <div className="flex items-center gap-2">
        <span className={cn("size-2 rounded-full", type.color)} />
        <span className="truncate font-semibold">{event.title}</span>
      </div>
      <div className="mt-1 truncate text-muted-foreground">{formatDateLabel(event.date)}</div>
    </div>
  );
}

function AgendaItem({
  event,
  interactive,
  onSelect,
}: {
  event: CalendarEvent;
  interactive: boolean;
  onSelect: () => void;
}) {
  const type = eventTypeFor(event.type);
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h5 className="font-semibold text-sm leading-5">{event.title}</h5>
          <p className="mt-1 text-muted-foreground text-xs">{event.account}</p>
        </div>
        <Badge appearance="light" size="xs" variant={type.badge}>
          {type.label}
        </Badge>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Clock className="size-3.5" />
          {event.time}
        </div>
        <div className="flex items-center justify-end gap-1.5 text-muted-foreground">
          <UserRound className="size-3.5" />
          {event.owner.split(" ")[0]}
        </div>
        <div className="col-span-2 flex items-center gap-1.5 text-muted-foreground">
          <MapPin className="size-3.5" />
          {event.location}
        </div>
      </div>
    </>
  );

  if (!interactive) {
    return <article className="rounded-2xl border border-border bg-muted/25 p-4">{content}</article>;
  }

  return (
    <button
      className="w-full rounded-2xl border border-border bg-muted/25 p-4 text-left transition hover:-translate-y-0.5 hover:bg-muted/45 hover:shadow-sm"
      onClick={onSelect}
      type="button"
    >
      {content}
    </button>
  );
}

function EventDetailCard({
  event,
  isSaved,
  onSave,
}: {
  event: CalendarEvent;
  isSaved: boolean;
  onSave: (changes: Partial<CalendarEvent>) => void;
}) {
  const [location, setLocation] = useState(event.location);
  const [notes, setNotes] = useState(event.notes);
  const [owner, setOwner] = useState(event.owner);
  const [time, setTime] = useState(event.time);
  const [title, setTitle] = useState(event.title);
  const type = eventTypeFor(event.type);

  return (
    <section className="rounded-2xl border border-[#D15ABB]/25 bg-background p-4 shadow-[#D15ABB]/10 shadow-lg ring-2 ring-[#D15ABB]/10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Badge appearance="light" size="xs" variant={type.badge}>
            {type.label}
          </Badge>
          <h5 className="mt-2 font-bold text-base leading-5">Event details</h5>
          <p className="mt-1 text-muted-foreground text-xs">
            {event.account} · {formatDateLabel(event.date)}
          </p>
        </div>
        <GripVertical className="size-4 text-muted-foreground" />
      </div>

      <div className="mt-4 space-y-3">
        <label className="block">
          <span className="font-medium text-[0.68rem] text-muted-foreground uppercase tracking-[0.16em]">Title</span>
          <input
            className="mt-1 h-9 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none transition focus:border-[#D15ABB]/60 focus:ring-2 focus:ring-[#D15ABB]/15"
            onChange={(inputEvent) => setTitle(inputEvent.target.value)}
            value={title}
          />
        </label>

        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="font-medium text-[0.68rem] text-muted-foreground uppercase tracking-[0.16em]">Time</span>
            <input
              className="mt-1 h-9 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none transition focus:border-[#D15ABB]/60 focus:ring-2 focus:ring-[#D15ABB]/15"
              onChange={(inputEvent) => setTime(inputEvent.target.value)}
              value={time}
            />
          </label>
          <label className="block">
            <span className="font-medium text-[0.68rem] text-muted-foreground uppercase tracking-[0.16em]">Owner</span>
            <input
              className="mt-1 h-9 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none transition focus:border-[#D15ABB]/60 focus:ring-2 focus:ring-[#D15ABB]/15"
              onChange={(inputEvent) => setOwner(inputEvent.target.value)}
              value={owner}
            />
          </label>
        </div>

        <label className="block">
          <span className="font-medium text-[0.68rem] text-muted-foreground uppercase tracking-[0.16em]">Location</span>
          <input
            className="mt-1 h-9 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none transition focus:border-[#D15ABB]/60 focus:ring-2 focus:ring-[#D15ABB]/15"
            onChange={(inputEvent) => setLocation(inputEvent.target.value)}
            value={location}
          />
        </label>

        <label className="block">
          <span className="font-medium text-[0.68rem] text-muted-foreground uppercase tracking-[0.16em]">Notes</span>
          <textarea
            className="mt-1 min-h-20 w-full resize-none rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none transition focus:border-[#D15ABB]/60 focus:ring-2 focus:ring-[#D15ABB]/15"
            onChange={(inputEvent) => setNotes(inputEvent.target.value)}
            value={notes}
          />
        </label>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-border border-t pt-3">
        <span className="text-muted-foreground text-xs">{isSaved ? "Saved changes" : "Drag to reschedule"}</span>
        <button
          className="inline-flex items-center gap-2 rounded-full bg-[#D15ABB] px-3 py-1.5 font-medium text-sm text-white shadow-sm transition hover:bg-[#BD4EA8]"
          onClick={() => onSave({ location, notes, owner, time, title })}
          type="button"
        >
          <Check className="size-3.5" />
          Save
        </button>
      </div>
    </section>
  );
}

function buildCalendarDays(month: (typeof months)[number]) {
  return [
    ...Array.from({ length: month.startsOn }, () => null),
    ...Array.from({ length: month.days }, (_, index) => index + 1),
  ];
}

function eventTypeFor(typeId: CalendarEvent["type"]) {
  return eventTypes.find((type) => type.id === typeId) ?? eventTypes[0];
}

function isCalendarDate(value: string) {
  return calendarDatePattern.test(value);
}

function formatDateLabel(date: string) {
  const [, month, day] = date.split("-");
  const monthLabel = months.find((item) => item.id.endsWith(month))?.shortLabel ?? "May";

  return `${monthLabel} ${Number(day)}`;
}
