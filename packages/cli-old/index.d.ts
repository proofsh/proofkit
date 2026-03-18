export interface RouteLink {
  label: string;
  type: "link";
  href: string;
  icon?: React.ReactNode;
  /** If true, the route will only be considered active if the path is exactly this value. */
  exactMatch?: boolean;
}

export interface RouteFunction {
  label: string;
  type: "function";
  icon?: React.ReactNode;
  onClick: () => void;
  /** If true, the route will only be considered active if the path is exactly this value. */
  exactMatch?: boolean;
}

export type ProofKitRoute = RouteLink | RouteFunction;
