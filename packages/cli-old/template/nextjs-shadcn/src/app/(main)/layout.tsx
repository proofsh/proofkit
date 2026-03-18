import AppShell from "@/components/AppShell/internal/AppShell";
import React from "react";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
