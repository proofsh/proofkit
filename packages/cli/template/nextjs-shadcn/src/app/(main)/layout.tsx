import type React from "react";
import AppShell from "@/components/AppShell/internal/AppShell";

export default function Layout({ children }: { children: React.ReactNode }) {
	return <AppShell>{children}</AppShell>;
}
