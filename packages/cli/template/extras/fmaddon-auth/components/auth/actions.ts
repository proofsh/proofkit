"use server";

import { redirect } from "next/navigation";
import {
	getCurrentSession,
	invalidateSession,
} from "@/server/auth/utils/session";

export async function currentSessionAction() {
	return await getCurrentSession();
}

export async function logoutAction() {
	const { session } = await currentSessionAction();
	if (session) {
		await invalidateSession(session.id);
	}
	redirect("/");
}
