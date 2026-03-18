import {
  AppShell,
  AppShellFooter,
  AppShellHeader,
  AppShellMain,
  AppShellNavbar,
} from "@mantine/core";
import React from "react";

/** Layout configuration Edit these values to change the layout */
export const showHeader = false;
export const showFooter = false;
export const showLeftNavbar = false;

export const headerHeight = 60;
export const footerHeight = 60;
export const leftNavbarWidth = 200;

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell
      header={showHeader ? { height: headerHeight } : undefined}
      footer={showFooter ? { height: footerHeight } : undefined}
      navbar={
        showLeftNavbar
          ? { width: leftNavbarWidth, breakpoint: "sm" }
          : undefined
      }
      padding="md"
    >
      {showHeader && <AppShellHeader>Header</AppShellHeader>}
      {showLeftNavbar && <AppShellNavbar>Left Navbar</AppShellNavbar>}
      <AppShellMain>{children}</AppShellMain>
      {showFooter && <AppShellFooter>Footer</AppShellFooter>}
    </AppShell>
  );
}
