import React from "react";
import { Header } from "@/components/AppShell/internal/Header";
import { headerHeight } from "./config";

export default function MainAppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="min-h-dvh"
      style={{ ["--header-height" as any]: `${headerHeight}px` }}
    >
      <header style={{ height: "var(--header-height)" }}>
        <Header />
      </header>
      <main className="mx-auto min-h-[calc(100dvh-var(--header-height,56px))] max-w-screen-2xl px-6">
        {children}
      </main>
    </div>
  );
}
