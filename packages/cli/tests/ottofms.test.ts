import axios from "axios";
import open from "open";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getOttoFMSToken } from "~/cli/ottofms.js";

vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
    delete: vi.fn(),
  },
  AxiosError: class AxiosError extends Error {},
}));

vi.mock("open", () => ({
  default: vi.fn(),
}));

vi.mock("~/cli/prompts.js", () => ({
  log: {
    info: vi.fn(),
  },
  spinner: () => ({
    start: vi.fn(),
    stop: vi.fn(),
  }),
}));

describe("OttoFMS browser login", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(open).mockResolvedValue({} as Awaited<ReturnType<typeof open>>);
    vi.mocked(axios.get).mockRejectedValue(new Error("pending"));
    vi.mocked(axios.delete).mockResolvedValue({ data: {} });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("rejects when login polling times out", async () => {
    const tokenPromise = getOttoFMSToken({
      url: new URL("https://example.com"),
    }).catch((error: unknown) => error);

    await vi.advanceTimersByTimeAsync(180_000);

    await expect(tokenPromise).resolves.toMatchObject({
      message: "Login timed out",
    });
    expect(vi.getTimerCount()).toBe(0);
  });
});
