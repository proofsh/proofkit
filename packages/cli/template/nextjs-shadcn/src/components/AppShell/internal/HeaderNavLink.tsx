"use client";

import { usePathname } from "next/navigation";

import type { ProofKitRoute } from "@/app/proofkit-route";
import classes from "./Header.module.css";

export default function HeaderNavLink(route: ProofKitRoute) {
	const pathname = usePathname();

	if (route.type === "function") {
		return (
			<button className={classes.link} onClick={route.onClick} type="button">
				{route.label}
			</button>
		);
	}

	const isActive = route.exactMatch
		? pathname === route.href
		: pathname.startsWith(route.href);

	if (route.type === "link") {
		return (
			<a
				href={route.href}
				className={classes.link}
				data-active={isActive || undefined}
			>
				{route.label}
			</a>
		);
	}
}
