import { Center } from "@mantine/core";
import React from "react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Center h="100vh">{children}</Center>;
}
