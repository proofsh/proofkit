import type React from "react";

interface RouteLink {
	label: string;
	type: "link";
	href: string;
	icon?: React.ReactNode;
	exactMatch?: boolean;
}

interface RouteFunction {
	label: string;
	type: "function";
	icon?: React.ReactNode;
	onClick: () => void;
	exactMatch?: boolean;
}

export type ProofKitRoute = RouteLink | RouteFunction;
