import { type ProofKitRoute } from "@proofkit/cli";

export const primaryRoutes: ProofKitRoute[] = [
  {
    label: "Dashboard",
    type: "link",
    href: "/",
    exactMatch: true,
  },
];

export const secondaryRoutes: ProofKitRoute[] = [];
