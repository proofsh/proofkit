"use client";

import { Center, Loader } from "@mantine/core";
import Cookies from "js-cookie";
import { redirect } from "next/navigation";
import { useEffect } from "react";

/**
 * A client-side component that redirects to the given path, but saves the current path in the redirectTo cookie.
 */
export default function AuthRedirect({ path }: { path: string }) {
  useEffect(() => {
    if (typeof window !== "undefined") {
      Cookies.set("redirectTo", window.location.pathname, {
        expires: 1 / 24 / 60, // 1 hour
      });
      redirect(path);
    }
  }, []);

  return (
    <Center h="100vh">
      <Loader />
    </Center>
  );
}
