import { Card, Center } from "@mantine/core";
import { redirect } from "next/navigation";
import type React from "react";
import { auth } from "@/server/auth";

export default async function Layout({
	children,
}: {
	children: React.ReactNode;
}) {
	const session = await auth();
	if (session) {
		return redirect("/");
	}
	return (
		<Center h="100vh">
			<Card withBorder radius="md" shadow="sm" w={"20rem"}>
				{children}
			</Card>
		</Center>
	);
}
