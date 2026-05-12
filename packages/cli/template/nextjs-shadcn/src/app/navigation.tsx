import { type ProofKitRoute } from "./proofkit-route";

export const primaryRoutes: ProofKitRoute[] = [
  {
    label: "Dashboard",
    type: "link",
    href: "/",
    exactMatch: true,
  },
];

export const secondaryRoutes: ProofKitRoute[] = [];
