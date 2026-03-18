const defaultBaseUrl = process.env.FM_HTTP_BASE_URL ?? "http://127.0.0.1:1365";
const REQUEST_TIMEOUT_MS = 3000;

export interface FmHttpStatus {
  baseUrl: string;
  healthy: boolean;
  connectedFiles: string[];
}

async function fetchWithTimeout(url: string): Promise<Response | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, { signal: controller.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function readJson(url: string): Promise<unknown | null> {
  const response = await fetchWithTimeout(url);

  if (!response?.ok) {
    return null;
  }

  return await response.json().catch(() => null);
}

export async function getFmHttpStatus(baseUrl = defaultBaseUrl): Promise<FmHttpStatus> {
  const healthResponse = await fetchWithTimeout(`${baseUrl}/health`);

  if (!healthResponse?.ok) {
    return {
      baseUrl,
      healthy: false,
      connectedFiles: [],
    };
  }

  const connectedFiles = await readJson(`${baseUrl}/connectedFiles`);

  return {
    baseUrl,
    healthy: true,
    connectedFiles: Array.isArray(connectedFiles) ? connectedFiles : [],
  };
}

export async function detectConnectedFmFile(baseUrl = defaultBaseUrl): Promise<string | undefined> {
  const status = await getFmHttpStatus(baseUrl);
  return status.connectedFiles[0];
}
