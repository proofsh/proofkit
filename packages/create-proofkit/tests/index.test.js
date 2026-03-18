import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import packageJson from "../package.json";

const { execaMock } = vi.hoisted(() => ({
  execaMock: vi.fn(),
}));

vi.mock("execa", () => ({
  execa: execaMock,
}));
const originalArgv = [...process.argv];
const expectedCliTag = packageJson.version.includes("-") ? "beta" : "latest";

let processExitSpy;
let consoleErrorSpy;

const importWrapperEntry = async () => {
  vi.resetModules();
  await import("../src/index.js");
  await Promise.resolve();
};

describe("create-proofkit wrapper", () => {
  beforeEach(() => {
    execaMock.mockReset();
    execaMock.mockResolvedValue({});

    processExitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined);
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.argv = [...originalArgv];
    vi.unstubAllEnvs();

    vi.restoreAllMocks();
  });

  it.each([
    ["npm", "npm/10.0.0 node/v22.0.0 darwin x64", "npx"],
    ["pnpm", "pnpm/9.0.0 node/v22.0.0 darwin x64", "pnpx"],
    ["yarn", "yarn/1.22.22 npm/? node/v22.0.0 darwin x64", "yarn"],
    ["bun", "bun/1.1.0 node/v22.0.0 darwin x64", "bunx"],
  ])("dispatches %s user agents to the expected command", async (_label, userAgent, expectedCommand) => {
    vi.stubEnv("npm_config_user_agent", userAgent);
    process.argv = ["node", "create-proofkit", "my-app"];

    await importWrapperEntry();

    expect(execaMock).toHaveBeenCalledWith(
      expectedCommand,
      [`@proofkit/cli@${expectedCliTag}`, "init", "my-app"],
      expect.objectContaining({
        stdio: "inherit",
        env: expect.objectContaining({
          FORCE_COLOR: "1",
        }),
      }),
    );
    expect(processExitSpy).not.toHaveBeenCalled();
  });

  it("forwards arbitrary init args unchanged", async () => {
    const forwardedArgs = ["my-app", "--template", "next", "--install=false", "--yes"];
    vi.stubEnv("npm_config_user_agent", "npm/10.0.0 node/v22.0.0 darwin x64");
    process.argv = ["node", "create-proofkit", ...forwardedArgs];

    await importWrapperEntry();

    expect(execaMock).toHaveBeenCalledWith(
      "npx",
      [`@proofkit/cli@${expectedCliTag}`, "init", ...forwardedArgs],
      expect.any(Object),
    );
    expect(processExitSpy).not.toHaveBeenCalled();
  });

  it("falls back to pnpm when no user agent is present", async () => {
    vi.stubEnv("npm_config_user_agent", "");
    process.argv = ["node", "create-proofkit", "fallback-app"];

    await importWrapperEntry();

    expect(execaMock).toHaveBeenCalledWith(
      "pnpx",
      [`@proofkit/cli@${expectedCliTag}`, "init", "fallback-app"],
      expect.any(Object),
    );
    expect(processExitSpy).not.toHaveBeenCalled();
  });

  it("prints an error and exits when the wrapper command fails", async () => {
    execaMock.mockRejectedValueOnce(new Error("boom"));
    vi.stubEnv("npm_config_user_agent", "npm/10.0.0 node/v22.0.0 darwin x64");
    process.argv = ["node", "create-proofkit", "broken-app"];

    await importWrapperEntry();

    await vi.waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith("Failed to create project");
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });
});
