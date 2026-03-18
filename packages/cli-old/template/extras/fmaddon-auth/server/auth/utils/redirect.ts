import { cookies } from "next/headers";

export async function getRedirectCookie() {
  const cookieStore = await cookies();
  const redirectTo = cookieStore.get("redirectTo")?.value;
  cookieStore.delete("redirectTo");
  return redirectTo ?? "/";
}
