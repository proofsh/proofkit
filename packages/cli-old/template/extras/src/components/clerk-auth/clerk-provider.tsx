"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { useComputedColorScheme } from "@mantine/core";

export function ClerkAuthProvider({ children }: { children: React.ReactNode }) {
  const computedColorScheme = useComputedColorScheme();
  return (
    <ClerkProvider
      appearance={{
        baseTheme: computedColorScheme === "dark" ? dark : undefined,
      }}
    >
      {children}
    </ClerkProvider>
  );
}
