import type { CSSProperties } from "react";

const nodeClass = "fill-[var(--surface)] stroke-[var(--border)]";
const textClass = "fill-current text-[13px] font-medium";
const labelClass = "fill-current text-[11px]";
const arrowClass = "fill-none stroke-[var(--line)] stroke-[1.6]";

function Node({
  x,
  y,
  width,
  height,
  label,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string | string[];
}) {
  const lines = Array.isArray(label) ? label : [label];
  const lineHeight = 16;
  const firstLineY = y + height / 2 - ((lines.length - 1) * lineHeight) / 2;

  return (
    <g>
      <rect className={nodeClass} height={height} rx="4" width={width} x={x} y={y} />
      <text className={textClass} dominantBaseline="middle" textAnchor="middle" x={x + width / 2} y={firstLineY}>
        {lines.map((line, index) => (
          <tspan dy={index === 0 ? 0 : lineHeight} key={line} x={x + width / 2}>
            {line}
          </tspan>
        ))}
      </text>
    </g>
  );
}

export function AgentWorkflowLoop() {
  return (
    <div
      className="my-4 overflow-auto rounded-xl border bg-fd-card p-4 text-fd-foreground"
      style={
        {
          "--line": "color-mix(in srgb, var(--color-fd-foreground) 50%, var(--color-fd-card))",
          "--surface": "color-mix(in srgb, var(--color-fd-foreground) 6%, var(--color-fd-card))",
          "--border": "color-mix(in srgb, var(--color-fd-foreground) 22%, var(--color-fd-card))",
        } as CSSProperties
      }
    >
      <svg
        aria-labelledby="agent-workflow-loop-title"
        className="mx-auto h-auto w-full max-w-[820px]"
        role="img"
        viewBox="0 0 820 360"
      >
        <title id="agent-workflow-loop-title">ProofKit agent workflow loop</title>
        <defs>
          <marker
            id="agent-workflow-arrow"
            markerHeight="7"
            markerWidth="7"
            orient="auto-start-reverse"
            refX="9"
            refY="5"
            viewBox="0 0 10 10"
          >
            <path className="fill-[var(--line)]" d="M 0 0 L 10 5 L 0 10 z" />
          </marker>
        </defs>

        <path className={arrowClass} d="M 132 94 H 178" markerEnd="url(#agent-workflow-arrow)" />
        <path className={arrowClass} d="M 324 94 H 372" markerEnd="url(#agent-workflow-arrow)" />
        <path className={arrowClass} d="M 498 94 H 552" markerEnd="url(#agent-workflow-arrow)" />
        <path className={arrowClass} d="M 636 120 V 206" markerEnd="url(#agent-workflow-arrow)" />
        <path className={arrowClass} d="M 570 232 H 506" markerEnd="url(#agent-workflow-arrow)" />
        <path className={arrowClass} d="M 435 206 C 435 164 435 138 435 120" markerEnd="url(#agent-workflow-arrow)" />
        <path className={arrowClass} d="M 636 258 V 306" markerEnd="url(#agent-workflow-arrow)" />
        <path
          className={`${arrowClass} stroke-dasharray-[4_4]`}
          d="M 636 344 C 636 356 80 356 80 120"
          markerEnd="url(#agent-workflow-arrow)"
        />

        <text className={labelClass} textAnchor="middle" x="454" y="170">
          iterate
        </text>
        <text className={labelClass} x="660" y="290">
          ready
        </text>
        <text className={labelClass} textAnchor="middle" x="358" y="352">
          future change
        </text>

        <Node height={52} label="Next change" width={112} x={20} y={68} />
        <Node height={52} label={["Read FileMaker", "schema"]} width={146} x={178} y={68} />
        <Node height={52} label="Write app code" width={126} x={372} y={68} />
        <g>
          <rect className={nodeClass} height="52" rx="4" width="168" x="552" y="68" />
          <text className={textClass} textAnchor="middle" x="636" y="90">
            <tspan x="636">Run typecheck</tspan>
            <tspan dy="16" x="636">
              and lint
            </tspan>
          </text>
        </g>
        <Node height={52} label="Preview in browser" width={146} x={570} y={206} />
        <Node height={52} label="Fix issues" width={126} x={372} y={206} />
        <Node height={42} label={["Deploy to", "FileMaker"]} width={116} x={578} y={306} />
      </svg>
    </div>
  );
}
