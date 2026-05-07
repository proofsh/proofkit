declare module "react" {
  export function createElement(type: unknown, props?: Record<string, unknown> | null, ...children: unknown[]): unknown;
}

declare module "next/script" {
  export default function Script(props: Record<string, unknown>): unknown;
}
