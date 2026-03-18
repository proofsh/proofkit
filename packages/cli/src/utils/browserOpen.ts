import open from "open";

export async function openBrowser(url: string): Promise<void> {
  try {
    await open(url);
  } catch {
    // Ignore open failures and let the user copy the URL manually.
  }
}

export const openExternal: (url: string) => Promise<void> = openBrowser;
