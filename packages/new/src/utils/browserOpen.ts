import open from "open";

export async function openBrowser(url: string) {
  try {
    await open(url);
  } catch {
    // Ignore open failures and let the user copy the URL manually.
  }
}

export const openExternal = openBrowser;
