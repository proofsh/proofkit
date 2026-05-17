import { randomUUID } from "node:crypto";

export interface FmMcpSessionKey {
  cwd: string;
  baseUrl: string;
  connectedFileName: string;
  clientName: string;
}

const fmMcpSessionIds = new Map<string, string>();

const randomSessionId = () => {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return randomUUID();
};

export const getFmMcpSessionId = (key: FmMcpSessionKey, explicitSessionId?: string) => {
  if (explicitSessionId) {
    return explicitSessionId;
  }
  const serializedKey = JSON.stringify(key);
  const existing = fmMcpSessionIds.get(serializedKey);
  if (existing) {
    return existing;
  }
  const sessionId = randomSessionId();
  fmMcpSessionIds.set(serializedKey, sessionId);
  return sessionId;
};
