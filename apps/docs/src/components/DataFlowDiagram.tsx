"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";

// ── Brand palette ────────────────────────────────────────────────────────────
const PK = {
  bg: "#080608",
  brand: "#c93aa0",
  brandDeep: "#8b1f6a",
  brandSoft: "#e879c0",
  brandGlow: "rgba(201, 58, 160, 0.55)",
  ink: "#f5e9f1",
  inkMuted: "rgba(245,233,241,0.85)",
  inkDim: "rgba(245,233,241,0.45)",
  border: "rgba(245,233,241,0.22)",
  borderActive: "rgba(232,121,192,0.65)",
};

// ── Easing ───────────────────────────────────────────────────────────────────
const Easing = {
  easeOutQuad: (t: number) => t * (2 - t),
  easeInOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1),
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

// ── Timeline context ─────────────────────────────────────────────────────────
interface TimelineValue {
  time: number;
  duration: number;
}
const TimelineContext = createContext<TimelineValue>({ time: 0, duration: 20 });
const useTime = () => useContext(TimelineContext).time;

// ── Geometry types ───────────────────────────────────────────────────────────
interface Point {
  x: number;
  y: number;
}

interface NodeDef {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  sub?: string;
  shape: "pill" | "hex" | "cyl" | "rect";
}

interface LayoutConfig {
  orientation: string;
  stageW: number;
  stageH: number;
  NODES: Record<string, NodeDef>;
  FM_CONTAINER: { x: number; y: number; w: number; h: number };
  PATHS: Record<string, Point[]>;
  notches: {
    enter: { x: number; y: number; side: string };
    exit: { x: number; y: number; side: string };
  };
  arrows: Record<string, { end: Point; dir: string }>;
  cycleIndicatorTop: number;
}

// ── Geometry helpers ─────────────────────────────────────────────────────────
const nodeCenter = (n: NodeDef): Point => ({
  x: n.x + n.w / 2,
  y: n.y + n.h / 2,
});
const nodeRight = (n: NodeDef): Point => ({
  x: n.x + n.w,
  y: n.y + n.h / 2,
});
const nodeLeft = (n: NodeDef): Point => ({ x: n.x, y: n.y + n.h / 2 });
const nodeTop = (n: NodeDef): Point => ({ x: n.x + n.w / 2, y: n.y });
const nodeBottom = (n: NodeDef): Point => ({
  x: n.x + n.w / 2,
  y: n.y + n.h,
});

function roundedPath(points: Point[], r = 14): string {
  if (points.length < 2) {
    return "";
  }
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];
    const dx1 = Math.sign(curr.x - prev.x);
    const dy1 = Math.sign(curr.y - prev.y);
    const dx2 = Math.sign(next.x - curr.x);
    const dy2 = Math.sign(next.y - curr.y);
    const len1 = Math.hypot(curr.x - prev.x, curr.y - prev.y);
    const len2 = Math.hypot(next.x - curr.x, next.y - curr.y);
    const rr = Math.min(r, len1 / 2, len2 / 2);
    d += ` L ${curr.x - dx1 * rr} ${curr.y - dy1 * rr}`;
    d += ` Q ${curr.x} ${curr.y} ${curr.x + dx2 * rr} ${curr.y + dy2 * rr}`;
  }
  const last = points.at(-1);
  d += ` L ${last.x} ${last.y}`;
  return d;
}

function samplePolyline(points: Point[], t: number): { x: number; y: number; angle: number } {
  if (points.length === 0) {
    return { x: 0, y: 0, angle: 0 };
  }
  if (points.length === 1) {
    return { ...points[0], angle: 0 };
  }
  const segs: { a: Point; b: Point; len: number; start: number }[] = [];
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    segs.push({ a, b, len, start: total });
    total += len;
  }
  const target = clamp(t, 0, 1) * total;
  for (const s of segs) {
    if (target <= s.start + s.len) {
      const localT = s.len === 0 ? 0 : (target - s.start) / s.len;
      return {
        x: s.a.x + (s.b.x - s.a.x) * localT,
        y: s.a.y + (s.b.y - s.a.y) * localT,
        angle: Math.atan2(s.b.y - s.a.y, s.b.x - s.a.x),
      };
    }
  }
  const last = points.at(-1);
  return { x: last.x, y: last.y, angle: 0 };
}

// ── Cycle / branch logic ─────────────────────────────────────────────────────
const CYCLE_LENGTH = 5;
const BRANCH_ORDER = ["db", "print", "fs", "api"] as const;
type Branch = (typeof BRANCH_ORDER)[number];

function branchAt(t: number): Branch {
  const cycleIdx = Math.floor(t / CYCLE_LENGTH) % BRANCH_ORDER.length;
  return BRANCH_ORDER[cycleIdx];
}
function cycleLocalTime(t: number): number {
  return t % CYCLE_LENGTH;
}

// ── Layout builders ──────────────────────────────────────────────────────────
function buildHorizontalLayout(): LayoutConfig {
  const NODES: Record<string, NodeDef> = {
    user: { x: 200, y: 323, w: 130, h: 64, label: "User", shape: "pill" },
    webviewer: {
      x: 470,
      y: 215,
      w: 280,
      h: 280,
      label: "WebViewer",
      sub: "(React App)",
      shape: "rect",
    },
    scripts: {
      x: 850,
      y: 313,
      w: 240,
      h: 84,
      label: "FileMaker",
      sub: "Scripts",
      shape: "hex",
    },
    fmDb: {
      x: 1280,
      y: 130,
      w: 220,
      h: 84,
      label: "FM Database",
      shape: "cyl",
    },
    printing: {
      x: 1280,
      y: 280,
      w: 220,
      h: 84,
      label: "Printing, etc.",
      shape: "rect",
    },
    fileSystem: {
      x: 1280,
      y: 430,
      w: 220,
      h: 84,
      label: "File System",
      shape: "rect",
    },
    externalApi: {
      x: 1280,
      y: 580,
      w: 220,
      h: 84,
      label: "External APIs",
      shape: "rect",
    },
  };
  const FM_CONTAINER = { x: 440, y: 147, w: 340, h: 378 };

  const wvL = nodeLeft(NODES.webviewer);
  const wvR = nodeRight(NODES.webviewer);
  const scL = nodeLeft(NODES.scripts);
  const scR = nodeRight(NODES.scripts);
  const busX = scR.x + 60;

  const PATHS: Record<string, Point[]> = {
    userToWv: [nodeRight(NODES.user), wvL],
    wvToScripts: [wvR, scL],
    scriptsToDb: [scR, { x: busX, y: scR.y }, { x: busX, y: nodeCenter(NODES.fmDb).y }, nodeLeft(NODES.fmDb)],
    scriptsToPrint: [
      scR,
      { x: busX, y: scR.y },
      { x: busX, y: nodeCenter(NODES.printing).y },
      nodeLeft(NODES.printing),
    ],
    scriptsToFs: [
      scR,
      { x: busX, y: scR.y },
      { x: busX, y: nodeCenter(NODES.fileSystem).y },
      nodeLeft(NODES.fileSystem),
    ],
    scriptsToApi: [
      scR,
      { x: busX, y: scR.y },
      { x: busX, y: nodeCenter(NODES.externalApi).y },
      nodeLeft(NODES.externalApi),
    ],
  };

  const notchY = nodeCenter(NODES.webviewer).y;
  return {
    orientation: "horizontal",
    stageW: 1920,
    stageH: 720,
    NODES,
    FM_CONTAINER,
    PATHS,
    notches: {
      enter: { x: FM_CONTAINER.x, y: notchY, side: "left" },
      exit: { x: FM_CONTAINER.x + FM_CONTAINER.w, y: notchY, side: "right" },
    },
    arrows: {
      webviewer: { end: nodeLeft(NODES.webviewer), dir: "right" },
      scripts: { end: nodeLeft(NODES.scripts), dir: "right" },
      fmDb: { end: nodeLeft(NODES.fmDb), dir: "right" },
      printing: { end: nodeLeft(NODES.printing), dir: "right" },
      fileSystem: { end: nodeLeft(NODES.fileSystem), dir: "right" },
      externalApi: { end: nodeLeft(NODES.externalApi), dir: "right" },
    },
    cycleIndicatorTop: 24,
  };
}

function buildVerticalLayout(): LayoutConfig {
  const NODES: Record<string, NodeDef> = {
    user: { x: 335, y: 110, w: 130, h: 64, label: "User", shape: "pill" },
    webviewer: {
      x: 280,
      y: 290,
      w: 240,
      h: 240,
      label: "WebViewer",
      sub: "(React App)",
      shape: "rect",
    },
    scripts: {
      x: 280,
      y: 700,
      w: 240,
      h: 84,
      label: "FileMaker",
      sub: "Scripts",
      shape: "hex",
    },
    fmDb: {
      x: 30,
      y: 900,
      w: 175,
      h: 84,
      label: "FM Database",
      shape: "cyl",
    },
    printing: {
      x: 215,
      y: 900,
      w: 175,
      h: 84,
      label: "Printing, etc.",
      shape: "rect",
    },
    fileSystem: {
      x: 400,
      y: 900,
      w: 175,
      h: 84,
      label: "File System",
      shape: "rect",
    },
    externalApi: {
      x: 585,
      y: 900,
      w: 185,
      h: 84,
      label: "External APIs",
      shape: "rect",
    },
  };
  const FM_CONTAINER = { x: 250, y: 260, w: 300, h: 310 };

  const wvT = nodeTop(NODES.webviewer);
  const wvB = nodeBottom(NODES.webviewer);
  const scT = nodeTop(NODES.scripts);
  const scB = nodeBottom(NODES.scripts);
  const busY = scB.y + 50;

  const PATHS: Record<string, Point[]> = {
    userToWv: [nodeBottom(NODES.user), wvT],
    wvToScripts: [wvB, scT],
    scriptsToDb: [scB, { x: scB.x, y: busY }, { x: nodeCenter(NODES.fmDb).x, y: busY }, nodeTop(NODES.fmDb)],
    scriptsToPrint: [scB, { x: scB.x, y: busY }, { x: nodeCenter(NODES.printing).x, y: busY }, nodeTop(NODES.printing)],
    scriptsToFs: [
      scB,
      { x: scB.x, y: busY },
      { x: nodeCenter(NODES.fileSystem).x, y: busY },
      nodeTop(NODES.fileSystem),
    ],
    scriptsToApi: [
      scB,
      { x: scB.x, y: busY },
      { x: nodeCenter(NODES.externalApi).x, y: busY },
      nodeTop(NODES.externalApi),
    ],
  };

  const notchX = nodeCenter(NODES.webviewer).x;
  return {
    orientation: "vertical",
    stageW: 800,
    stageH: 1100,
    NODES,
    FM_CONTAINER,
    PATHS,
    notches: {
      enter: { x: notchX, y: FM_CONTAINER.y - 38, side: "top" },
      exit: { x: notchX, y: FM_CONTAINER.y + FM_CONTAINER.h, side: "bottom" },
    },
    arrows: {
      webviewer: { end: nodeTop(NODES.webviewer), dir: "down" },
      scripts: { end: nodeTop(NODES.scripts), dir: "down" },
      fmDb: { end: nodeTop(NODES.fmDb), dir: "down" },
      printing: { end: nodeTop(NODES.printing), dir: "down" },
      fileSystem: { end: nodeTop(NODES.fileSystem), dir: "down" },
      externalApi: { end: nodeTop(NODES.externalApi), dir: "down" },
    },
    cycleIndicatorTop: 24,
  };
}

function makeLayout(orientation: string): LayoutConfig {
  return orientation === "vertical" ? buildVerticalLayout() : buildHorizontalLayout();
}

// ── Sub-components ───────────────────────────────────────────────────────────

function Aurora() {
  const t = useTime();
  const driftX = 50 + 6 * Math.sin(t * 0.25);
  const driftY = -10 + 4 * Math.cos(t * 0.18);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: `${driftX}%`,
          top: `${driftY}%`,
          width: 1400,
          height: 900,
          transform: "translate(-50%, -50%)",
          background: `radial-gradient(ellipse, ${PK.brand}55 0%, ${PK.brandDeep}28 25%, transparent 55%)`,
          filter: "blur(50px)",
          opacity: 0.85,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: "70%",
          top: "95%",
          width: 1100,
          height: 700,
          transform: "translate(-50%, -50%)",
          background: `radial-gradient(ellipse, ${PK.brand}30 0%, transparent 60%)`,
          filter: "blur(60px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `linear-gradient(rgba(245,233,241,0.025) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(245,233,241,0.025) 1px, transparent 1px)`,
          backgroundSize: "48px 48px",
          maskImage: "radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0.6) 0%, transparent 70%)",
          WebkitMaskImage: "radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0.6) 0%, transparent 70%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse at 50% 55%, transparent 30%, rgba(0,0,0,0.75) 95%)",
        }}
      />
    </div>
  );
}

function FileMakerContainer({
  active,
  container,
}: {
  active: boolean;
  container: { x: number; y: number; w: number; h: number };
}) {
  const TITLEBAR = 38;
  const C = container;
  return (
    <div
      style={{
        position: "absolute",
        left: C.x,
        top: C.y - TITLEBAR,
        width: C.w,
        height: C.h + TITLEBAR,
        borderRadius: 10,
        border: `1px solid ${active ? PK.borderActive : "rgba(245,233,241,0.16)"}`,
        background: "rgba(28, 20, 32, 0.78)",
        boxShadow: "0 30px 80px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)",
        overflow: "hidden",
        transition: "border-color 300ms",
        zIndex: 1,
        backdropFilter: "blur(6px)",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          height: TITLEBAR,
          display: "flex",
          alignItems: "center",
          padding: "0 14px",
          background: "linear-gradient(180deg, rgba(40,28,42,0.85) 0%, rgba(22,16,24,0.85) 100%)",
          borderBottom: "1px solid rgba(245,233,241,0.10)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              width: 13,
              height: 13,
              borderRadius: "50%",
              background: "#ff5f57",
              boxShadow: "inset 0 0 0 0.5px rgba(0,0,0,0.25)",
            }}
          />
          <span
            style={{
              width: 13,
              height: 13,
              borderRadius: "50%",
              background: "#febc2e",
              boxShadow: "inset 0 0 0 0.5px rgba(0,0,0,0.25)",
            }}
          />
          <span
            style={{
              width: 13,
              height: 13,
              borderRadius: "50%",
              background: "#28c840",
              boxShadow: "inset 0 0 0 0.5px rgba(0,0,0,0.25)",
            }}
          />
        </div>
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            textAlign: "center",
            fontFamily: "Inter, system-ui, sans-serif",
            fontSize: 14,
            fontWeight: 500,
            color: PK.inkMuted,
            letterSpacing: "-0.005em",
            pointerEvents: "none",
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <FmIcon />
            Inventory.fmp12
          </span>
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 14,
          right: 14,
          top: TITLEBAR + 10,
          height: 1,
          background: "linear-gradient(90deg, transparent, rgba(245,233,241,0.08), transparent)",
        }}
      />
    </div>
  );
}

function FmIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="14" style={{ display: "block" }} viewBox="0 0 16 16" width="14">
      <rect
        fill="rgba(201,58,160,0.18)"
        height="12"
        rx="1.5"
        stroke="currentColor"
        strokeOpacity="0.7"
        strokeWidth="1.2"
        width="9"
        x="2.5"
        y="2"
      />
      <path
        d="M5 6h4M5 8.5h4M5 11h2.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeOpacity="0.55"
        strokeWidth="1"
      />
    </svg>
  );
}

function NodeShape({ node, active, activePulse = 0 }: { node: NodeDef; active: boolean; activePulse?: number }) {
  const scale = 1 + 0.06 * activePulse;
  const glow = activePulse;

  const baseBorder = active ? PK.borderActive : PK.border;
  const baseBg = "rgba(58, 44, 66, 0.92)";
  const activeBg = `rgba(96, 36, 78, ${0.7 + 0.2 * glow})`;
  const bg = active ? activeBg : baseBg;

  const boxShadow = active
    ? `0 0 ${20 + 30 * glow}px ${PK.brandGlow}, inset 0 0 0 1px ${PK.borderActive}`
    : `inset 0 0 0 1px ${baseBorder}`;

  const shapeStyle = (() => {
    switch (node.shape) {
      case "pill":
        return { borderRadius: 9999 };
      case "hex":
        return {
          clipPath: "polygon(12% 0%, 88% 0%, 100% 50%, 88% 100%, 12% 100%, 0% 50%)",
          borderRadius: 0,
        };
      case "cyl":
        return { borderRadius: 12 };
      default:
        return { borderRadius: 8 };
    }
  })();

  const cylinderTop =
    node.shape === "cyl" ? (
      <div
        style={{
          position: "absolute",
          left: 8,
          right: 8,
          top: 4,
          height: 12,
          borderRadius: "50%",
          border: `1px solid ${active ? PK.borderActive : PK.border}`,
          background: "rgba(58,44,66,0.85)",
        }}
      />
    ) : null;

  return (
    <div
      style={{
        position: "absolute",
        left: node.x,
        top: node.y,
        width: node.w,
        height: node.h,
        transform: `scale(${scale})`,
        transformOrigin: "center",
        transition: "transform 80ms linear",
        zIndex: 3,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: bg,
          boxShadow,
          backdropFilter: "blur(2px)",
          ...shapeStyle,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          color: active ? PK.ink : PK.inkMuted,
          fontFamily: "Inter, system-ui, sans-serif",
          fontWeight: 500,
          fontSize: node.shape === "hex" ? 18 : 19,
          lineHeight: 1.15,
          letterSpacing: "-0.005em",
          textAlign: "center",
          padding: "0 12px",
          whiteSpace: "nowrap",
          transition: "color 200ms, background 200ms",
        }}
      >
        {cylinderTop}
        <div>{node.label}</div>
        {node.sub && <div style={{ opacity: 0.78, fontSize: 16, fontWeight: 400 }}>{node.sub}</div>}
      </div>
    </div>
  );
}

function PathStroke({
  points,
  fillProgress,
  baseColor = "rgba(245,233,241,0.18)",
  activeColor = "#e879c0",
  glow = false,
}: {
  points: Point[];
  fillProgress: number;
  baseColor?: string;
  activeColor?: string;
  glow?: boolean;
}) {
  const d = roundedPath(points, 14);
  const pathRef = useRef<SVGPathElement>(null);
  const [length, setLength] = useState(2000);

  useEffect(() => {
    if (pathRef.current) {
      setLength(pathRef.current.getTotalLength());
    }
  }, [d]);

  const dashOffset = length * (1 - clamp(fillProgress, 0, 1));

  return (
    <g>
      <path d={d} fill="none" stroke={baseColor} strokeWidth={1.5} />
      <path
        d={d}
        fill="none"
        ref={pathRef}
        stroke={activeColor}
        strokeDasharray={length}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
        strokeWidth={2}
        style={{
          filter: glow ? `drop-shadow(0 0 6px ${PK.brandGlow})` : "none",
        }}
      />
    </g>
  );
}

function PathArrow({ end, dir = "right", active = false }: { end: Point; dir: string; active?: boolean }) {
  const color = active ? PK.brandSoft : "rgba(245,233,241,0.28)";
  let pts: string;
  if (dir === "up") {
    pts = `${end.x - 5},${end.y} ${end.x},${end.y - 8} ${end.x + 5},${end.y}`;
  } else if (dir === "down") {
    pts = `${end.x - 5},${end.y} ${end.x},${end.y + 8} ${end.x + 5},${end.y}`;
  } else {
    const dx = dir === "right" ? 1 : -1;
    pts = `${end.x},${end.y - 5} ${end.x + dx * 8},${end.y} ${end.x},${end.y + 5}`;
  }
  return <polygon fill={color} points={pts} style={{ transition: "fill 200ms" }} />;
}

function WindowEdgeNotch({
  x,
  y,
  side = "right",
  active = false,
}: {
  x: number;
  y: number;
  side?: string;
  active?: boolean;
}) {
  const color = active ? PK.brandSoft : "rgba(245,233,241,0.22)";
  const glowColor = active ? PK.brandSoft : "transparent";
  const len = 14;
  let rectX: number;
  let rectY: number;
  let rw: number;
  let rh: number;
  if (side === "right") {
    rectX = x - 1;
    rectY = y - 5;
    rw = len;
    rh = 10;
  } else if (side === "left") {
    rectX = x - len + 1;
    rectY = y - 5;
    rw = len;
    rh = 10;
  } else if (side === "top") {
    rectX = x - 5;
    rectY = y - len + 1;
    rw = 10;
    rh = len;
  } else {
    rectX = x - 5;
    rectY = y - 1;
    rw = 10;
    rh = len;
  }
  return (
    <g style={{ transition: "opacity 200ms" }}>
      {active && <circle cx={x} cy={y} fill={glowColor} opacity={0.22} r={12} />}
      <rect fill="rgba(28, 20, 32, 0.95)" height={rh} width={rw} x={rectX} y={rectY} />
      <circle
        cx={x}
        cy={y}
        fill="rgba(28, 20, 32, 1)"
        r={4.5}
        stroke={color}
        strokeWidth="1.5"
        style={{ transition: "stroke 200ms" }}
      />
      {active && <circle cx={x} cy={y} fill={color} r={1.8} />}
    </g>
  );
}

function Comet({
  points,
  tProgress,
  color = "#e879c0",
  size = 14,
  trail = 0.18,
}: {
  points: Point[];
  tProgress: number;
  color?: string;
  size?: number;
  trail?: number;
}) {
  if (tProgress < 0 || tProgress > 1) {
    return null;
  }
  const head = samplePolyline(points, tProgress);
  const N = 14;
  const tailDots: { x: number; y: number; a: number; r: number }[] = [];
  for (let i = 1; i <= N; i++) {
    const tt = tProgress - (i / N) * trail;
    if (tt < 0) {
      break;
    }
    const p = samplePolyline(points, tt);
    const fade = 1 - i / N;
    tailDots.push({
      x: p.x,
      y: p.y,
      a: fade * 0.85,
      r: size * (0.4 + 0.6 * fade) * 0.5,
    });
  }

  return (
    <g>
      {[...tailDots].reverse().map((d, i) => (
        <circle cx={d.x} cy={d.y} fill={color} key={`tail-${i}`} opacity={d.a * 0.5} r={d.r} />
      ))}
      <circle cx={head.x} cy={head.y} fill={color} opacity={0.18} r={size * 1.8} />
      <circle cx={head.x} cy={head.y} fill={color} opacity={0.35} r={size * 1.1} />
      <circle cx={head.x} cy={head.y} fill="#ffffff" opacity={0.95} r={size * 0.55} />
    </g>
  );
}

function UserCursor({
  points,
  tProgress,
  clickPulse = 0,
}: {
  points: Point[];
  tProgress: number;
  clickPulse?: number;
}) {
  if (tProgress < 0 || tProgress > 1) {
    return null;
  }
  const head = samplePolyline(points, tProgress);
  const press = tProgress > 0.85 ? (tProgress - 0.85) / 0.15 : 0;
  const cursorScale = 1 - press * 0.15;

  const ripples: { r: number; opacity: number }[] = [];
  if (clickPulse > 0) {
    for (let i = 0; i < 2; i++) {
      const phase = clamp(clickPulse - i * 0.25, 0, 1);
      if (phase > 0) {
        ripples.push({ r: 4 + phase * 22, opacity: (1 - phase) * 0.55 });
      }
    }
  }

  return (
    <g>
      {ripples.map((rp, i) => (
        <circle
          cx={head.x}
          cy={head.y}
          fill="none"
          key={`ripple-${i}`}
          opacity={rp.opacity}
          r={rp.r}
          stroke="#ffffff"
          strokeWidth="1.5"
        />
      ))}
      <circle cx={head.x} cy={head.y} fill="#ffffff" opacity={0.45} r={3.5} />
      <g transform={`translate(${head.x} ${head.y}) scale(${cursorScale})`}>
        <path
          d="M0,0 L0,18 L4.5,13 L7.5,19 L10,18 L7,12 L13,12 Z"
          fill="rgba(0,0,0,0.55)"
          transform="translate(1.2 1.5)"
        />
        <path
          d="M0,0 L0,18 L4.5,13 L7.5,19 L10,18 L7,12 L13,12 Z"
          fill="#ffffff"
          stroke="#c93aa0"
          strokeLinejoin="round"
          strokeWidth="1.2"
        />
      </g>
    </g>
  );
}

function CycleIndicator({ branch, top = 24 }: { branch: Branch; localT?: number; top?: number }) {
  const labels: Record<Branch, string> = {
    db: "Read from FileMaker",
    print: "Trigger native scripts",
    fs: "Read & write files",
    api: "Call external APIs",
  };
  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top,
        transform: "translateX(-50%)",
        display: "flex",
        alignItems: "center",
        gap: 18,
        zIndex: 5,
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <div
        style={{
          padding: "8px 18px",
          borderRadius: 9999,
          background: "rgba(60, 18, 48, 0.55)",
          border: `1px solid ${PK.borderActive}`,
          color: PK.ink,
          fontSize: 18,
          fontWeight: 500,
          letterSpacing: "-0.005em",
          boxShadow: `0 0 24px ${PK.brandGlow}`,
          minWidth: 360,
          textAlign: "center",
          transition: "all 300ms",
        }}
      >
        {labels[branch]}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {BRANCH_ORDER.map((b) => (
          <div
            key={b}
            style={{
              width: 28,
              height: 4,
              borderRadius: 2,
              background: b === branch ? PK.brandSoft : "rgba(245,233,241,0.18)",
              transition: "background 200ms",
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ── Arrival pulse helper ─────────────────────────────────────────────────────
function arrivalPulseAt(currentT: number, arrivalT: number, decay = 0.9): number {
  const dt = currentT - arrivalT;
  if (dt < 0) {
    return 0;
  }
  if (dt > decay) {
    return 0;
  }
  if (dt < 0.15) {
    return Easing.easeOutQuad(dt / 0.15);
  }
  return 1 - Easing.easeInOutCubic((dt - 0.15) / (decay - 0.15));
}

// ── Main FlowDiagram ─────────────────────────────────────────────────────────
function FlowDiagram({ layout }: { layout: LayoutConfig }) {
  const { NODES, FM_CONTAINER, PATHS, notches, arrows, cycleIndicatorTop, stageW, stageH } = layout;

  const t = useTime();
  const branch = branchAt(t);
  const localT = cycleLocalTime(t);

  const branchPathMap: Record<Branch, Point[]> = {
    db: PATHS.scriptsToDb,
    print: PATHS.scriptsToPrint,
    fs: PATHS.scriptsToFs,
    api: PATHS.scriptsToApi,
  };
  const branchPath = branchPathMap[branch];

  const T_USER_WV: [number, number] = [0.1, 1.0];
  const T_WV_SCRIPT: [number, number] = [1.0, 1.95];
  const T_SCRIPT_BR: [number, number] = [1.95, 3.2];

  const inWindow = ([s, e]: [number, number]) => localT >= s && localT <= e;
  const progressIn = ([s, e]: [number, number]) => clamp((localT - s) / (e - s), 0, 1);

  const fadeAfter = (endT: number, fadeDur = 0.6) => {
    if (localT < endT) {
      return progressIn([endT - 0.6, endT]);
    }
    const since = localT - endT;
    if (since < 1.4) {
      return 1;
    }
    const fade = clamp((since - 1.4) / fadeDur, 0, 1);
    return 1 - fade;
  };

  const computeFill = (w: [number, number]) => {
    if (inWindow(w)) {
      return progressIn(w);
    }
    if (localT > w[1]) {
      return fadeAfter(w[1]);
    }
    return 0;
  };
  const trunkUserWv_fill = computeFill(T_USER_WV);
  const trunkWvScript_fill = computeFill(T_WV_SCRIPT);
  const branchFill = computeFill(T_SCRIPT_BR);

  const sinceClick = localT - T_USER_WV[1];
  const clickPulse = sinceClick >= 0 && sinceClick < 0.7 ? sinceClick / 0.7 : 0;

  const packetUserWv = inWindow(T_USER_WV) ? progressIn(T_USER_WV) : -1;
  const packetWvScript = inWindow(T_WV_SCRIPT) ? progressIn(T_WV_SCRIPT) : -1;
  const packetBranch = inWindow(T_SCRIPT_BR) ? progressIn(T_SCRIPT_BR) : -1;

  const isActive = (key: string): boolean => {
    switch (key) {
      case "user":
        return localT < T_USER_WV[0] + 0.2;
      case "webviewer":
        return arrivalPulseAt(localT, T_USER_WV[1]) > 0.05;
      case "scripts":
        return arrivalPulseAt(localT, T_WV_SCRIPT[1]) > 0.05 || (localT > T_WV_SCRIPT[1] && localT < T_SCRIPT_BR[1]);
      case "fmDb":
        return branch === "db" && arrivalPulseAt(localT, T_SCRIPT_BR[1]) > 0.05;
      case "printing":
        return branch === "print" && arrivalPulseAt(localT, T_SCRIPT_BR[1]) > 0.05;
      case "fileSystem":
        return branch === "fs" && arrivalPulseAt(localT, T_SCRIPT_BR[1]) > 0.05;
      case "externalApi":
        return branch === "api" && arrivalPulseAt(localT, T_SCRIPT_BR[1]) > 0.05;
      default:
        return false;
    }
  };

  const pulseAt = (key: string): number => {
    switch (key) {
      case "webviewer":
        return arrivalPulseAt(localT, T_USER_WV[1]);
      case "scripts":
        return arrivalPulseAt(localT, T_WV_SCRIPT[1]);
      case "fmDb":
        return branch === "db" ? arrivalPulseAt(localT, T_SCRIPT_BR[1]) : 0;
      case "printing":
        return branch === "print" ? arrivalPulseAt(localT, T_SCRIPT_BR[1]) : 0;
      case "fileSystem":
        return branch === "fs" ? arrivalPulseAt(localT, T_SCRIPT_BR[1]) : 0;
      case "externalApi":
        return branch === "api" ? arrivalPulseAt(localT, T_SCRIPT_BR[1]) : 0;
      default:
        return 0;
    }
  };

  const inactive = "rgba(245,233,241,0.10)";
  const branchColor = PK.brandSoft;

  const allBranches = [
    { key: "db", path: PATHS.scriptsToDb },
    { key: "print", path: PATHS.scriptsToPrint },
    { key: "fs", path: PATHS.scriptsToFs },
    { key: "api", path: PATHS.scriptsToApi },
  ];

  return (
    <>
      <Aurora />
      <FileMakerContainer active={true} container={FM_CONTAINER} />

      <svg
        aria-hidden="true"
        height={stageH}
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 2,
          pointerEvents: "none",
        }}
        viewBox={`0 0 ${stageW} ${stageH}`}
        width={stageW}
      >
        <PathStroke activeColor={branchColor} fillProgress={trunkUserWv_fill} glow points={PATHS.userToWv} />
        <PathStroke activeColor={branchColor} fillProgress={trunkWvScript_fill} glow points={PATHS.wvToScripts} />

        {allBranches.map((b) => (
          <PathStroke
            activeColor={branchColor}
            baseColor={inactive}
            fillProgress={branch === b.key ? branchFill : 0}
            glow={branch === b.key}
            key={b.key}
            points={b.path}
          />
        ))}

        <PathArrow active={trunkUserWv_fill > 0.6} dir={arrows.webviewer.dir} end={arrows.webviewer.end} />
        <PathArrow active={trunkWvScript_fill > 0.6} dir={arrows.scripts.dir} end={arrows.scripts.end} />
        <PathArrow active={branch === "db" && branchFill > 0.6} dir={arrows.fmDb.dir} end={arrows.fmDb.end} />
        <PathArrow
          active={branch === "print" && branchFill > 0.6}
          dir={arrows.printing.dir}
          end={arrows.printing.end}
        />
        <PathArrow
          active={branch === "fs" && branchFill > 0.6}
          dir={arrows.fileSystem.dir}
          end={arrows.fileSystem.end}
        />
        <PathArrow
          active={branch === "api" && branchFill > 0.6}
          dir={arrows.externalApi.dir}
          end={arrows.externalApi.end}
        />

        {(packetUserWv >= 0 || clickPulse > 0) && (
          <UserCursor
            clickPulse={clickPulse}
            points={PATHS.userToWv}
            tProgress={packetUserWv >= 0 ? packetUserWv : 1}
          />
        )}
        {packetWvScript >= 0 && <Comet points={PATHS.wvToScripts} tProgress={packetWvScript} />}
        {packetBranch >= 0 && <Comet points={branchPath} tProgress={packetBranch} />}

        <WindowEdgeNotch
          active={trunkUserWv_fill > 0.4}
          side={notches.enter.side}
          x={notches.enter.x}
          y={notches.enter.y}
        />
        <WindowEdgeNotch
          active={trunkWvScript_fill > 0.05 || (!!branch && branchFill > 0)}
          side={notches.exit.side}
          x={notches.exit.x}
          y={notches.exit.y}
        />
      </svg>

      {Object.entries(NODES).map(([key, n]) => (
        <NodeShape active={isActive(key)} activePulse={pulseAt(key)} key={key} node={n} />
      ))}

      <CycleIndicator branch={branch} localT={localT} top={cycleIndicatorTop} />
    </>
  );
}

// ── Responsive layout hook ───────────────────────────────────────────────────
function useResponsiveLayout(): LayoutConfig {
  const detect = () => {
    if (typeof window === "undefined") {
      return "horizontal";
    }
    return window.innerHeight > window.innerWidth * 1.05 ? "vertical" : "horizontal";
  };
  const [orientation, setOrientation] = useState(detect);
  useEffect(() => {
    const onResize = () => setOrientation(detect());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return useMemo(() => makeLayout(orientation), [orientation]);
}

// ── Exported embed stage ─────────────────────────────────────────────────────
export default function DataFlowDiagram() {
  const layout = useResponsiveLayout();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [time, setTime] = useState(0);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const DURATION = 20;
  const { stageW: W, stageH: H } = layout;

  useEffect(() => {
    if (!wrapRef.current) {
      return;
    }
    const el = wrapRef.current;
    const measure = () => {
      const s = Math.min(el.clientWidth / W, el.clientHeight / H);
      setScale(Math.max(0.05, s));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [W, H]);

  useEffect(() => {
    const step = (ts: number) => {
      if (lastTsRef.current == null) {
        lastTsRef.current = ts;
      }
      const dt = (ts - lastTsRef.current) / 1000;
      lastTsRef.current = ts;
      setTime((t) => (t + dt) % DURATION);
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  const ctxValue = useMemo<TimelineValue>(() => ({ time, duration: DURATION }), [time]);

  return (
    <div
      ref={wrapRef}
      style={{
        position: "absolute",
        inset: 0,
        background: PK.bg,
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: W,
          height: H,
          position: "relative",
          transform: `scale(${scale})`,
          transformOrigin: "center",
          flexShrink: 0,
          background: PK.bg,
          overflow: "hidden",
        }}
      >
        <TimelineContext.Provider value={ctxValue}>
          <FlowDiagram layout={layout} />
        </TimelineContext.Provider>
      </div>
    </div>
  );
}
