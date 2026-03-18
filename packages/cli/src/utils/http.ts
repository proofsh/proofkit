import https from "node:https";
import axios from "axios";

const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
});

export async function getJson<T>(url: string, options?: { headers?: Record<string, string>; timeout?: number }) {
  const response = await axios.get<T>(url, {
    headers: options?.headers,
    httpsAgent,
    timeout: options?.timeout ?? 10_000,
    validateStatus: null,
  });
  return response;
}

export async function postJson<T>(
  url: string,
  data: unknown,
  options?: { headers?: Record<string, string>; timeout?: number },
) {
  const response = await axios.post<T>(url, data, {
    headers: options?.headers,
    httpsAgent,
    timeout: options?.timeout ?? 10_000,
    validateStatus: null,
  });
  return response;
}

export async function deleteJson(url: string, options?: { headers?: Record<string, string>; timeout?: number }) {
  const response = await axios.delete(url, {
    headers: options?.headers,
    httpsAgent,
    timeout: options?.timeout ?? 10_000,
    validateStatus: null,
  });
  return response;
}

export async function requestJson<T>(
  url: string | URL,
  options?: {
    method?: "GET" | "POST" | "DELETE";
    headers?: Record<string, string>;
    body?: Record<string, unknown>;
    timeoutMs?: number;
  },
) {
  const response = await axios.request<T>({
    url: url.toString(),
    method: options?.method ?? "GET",
    data: options?.body,
    headers: options?.headers,
    httpsAgent,
    timeout: options?.timeoutMs ?? 10_000,
    validateStatus: null,
  });
  return response.data;
}

export async function requestText(
  url: string | URL,
  options?: {
    method?: "GET" | "POST" | "DELETE";
    headers?: Record<string, string>;
    timeoutMs?: number;
  },
) {
  const response = await axios.request<string>({
    url: url.toString(),
    method: options?.method ?? "GET",
    headers: options?.headers,
    httpsAgent,
    timeout: options?.timeoutMs ?? 10_000,
    responseType: "text",
    validateStatus: null,
  });
  return {
    status: response.status,
    data: response.data,
  };
}
