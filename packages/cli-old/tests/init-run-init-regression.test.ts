import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createBareProjectMock,
  setImportAliasMock,
  promptForFileMakerDataSourceMock,
  runCodegenCommandMock,
  initializeGitMock,
  logNextStepsMock,
  readJSONSyncMock,
  writeJSONSyncMock,
  execaMock,
  mockState,
} = vi.hoisted(() => ({
  createBareProjectMock: vi.fn(),
  setImportAliasMock: vi.fn(),
  promptForFileMakerDataSourceMock: vi.fn(),
  runCodegenCommandMock: vi.fn(),
  initializeGitMock: vi.fn(),
  logNextStepsMock: vi.fn(),
  readJSONSyncMock: vi.fn(),
  writeJSONSyncMock: vi.fn(),
  execaMock: vi.fn(),
  mockState: {
    appType: undefined as "browser" | "webviewer" | undefined,
    ui: "shadcn" as "shadcn" | "mantine",
    projectDir: "/tmp/proofkit-regression",
  },
}));

vi.mock("@clack/prompts", () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  note: vi.fn(),
  cancel: vi.fn(),
  log: {
    error: vi.fn(),
    info: vi.fn(),
    message: vi.fn(),
    step: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
  },
  spinner: vi.fn(() => ({
    message: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  })),
  isCancel: vi.fn(() => false),
  select: vi.fn(),
  text: vi.fn(),
}));

vi.mock("@inquirer/prompts", () => ({
  checkbox: vi.fn(),
  confirm: vi.fn(),
  input: vi.fn(),
  password: vi.fn(),
  search: vi.fn(),
  select: vi.fn(),
}));

vi.mock("fs-extra", () => ({
  default: {
    readJSONSync: readJSONSyncMock,
    writeJSONSync: writeJSONSyncMock,
  },
}));

vi.mock("execa", () => ({
  execa: execaMock,
}));

vi.mock("~/helpers/createProject.js", () => ({
  createBareProject: createBareProjectMock,
}));

vi.mock("~/helpers/setImportAlias.js", () => ({
  setImportAlias: setImportAliasMock,
}));

vi.mock("~/cli/add/data-source/filemaker.js", () => ({
  promptForFileMakerDataSource: promptForFileMakerDataSourceMock,
}));

vi.mock("~/generators/fmdapi.js", () => ({
  runCodegenCommand: runCodegenCommandMock,
}));

vi.mock("~/helpers/git.js", () => ({
  initializeGit: initializeGitMock,
}));

vi.mock("~/helpers/logNextSteps.js", () => ({
  logNextSteps: logNextStepsMock,
}));

vi.mock("~/helpers/installDependencies.js", () => ({
  installDependencies: vi.fn(),
}));

vi.mock("~/generators/auth.js", () => ({
  addAuth: vi.fn(),
}));

vi.mock("~/installers/index.js", () => ({
  buildPkgInstallerMap: vi.fn(() => ({})),
}));

vi.mock("~/state.js", () => ({
  state: mockState,
  initProgramState: vi.fn(),
  isNonInteractiveMode: vi.fn(() => true),
}));

vi.mock("~/utils/getProofKitVersion.js", () => ({
  getVersion: vi.fn(() => "0.0.0-test"),
}));

vi.mock("~/utils/getUserPkgManager.js", () => ({
  getUserPkgManager: vi.fn(() => "pnpm"),
}));

vi.mock("~/utils/parseNameAndPath.js", () => ({
  parseNameAndPath: vi.fn((name: string) => [name, name]),
}));

vi.mock("~/utils/parseSettings.js", () => ({
  setSettings: vi.fn(),
}));

vi.mock("~/utils/validateAppName.js", () => ({
  validateAppName: vi.fn(() => undefined),
}));

vi.mock("~/cli/utils.js", () => ({
  abortIfCancel: vi.fn((value: unknown) => value),
}));

import { runInit } from "~/cli/init";

const browserFilemakerFlags = {
  noGit: true,
  noInstall: true,
  force: false,
  default: false,
  importAlias: "~/",
  server: undefined,
  adminApiKey: undefined,
  fileName: "",
  layoutName: "",
  schemaName: "",
  dataApiKey: "",
  fmServerURL: "",
  auth: "none" as const,
  dataSource: "filemaker" as const,
  ui: "shadcn" as const,
  CI: false,
  nonInteractive: true,
  tailwind: false,
  trpc: false,
  prisma: false,
  drizzle: false,
  appRouter: false,
};

describe("runInit browser post-init typegen regression", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockState.appType = undefined;
    mockState.ui = "shadcn";
    mockState.projectDir = "/tmp/proofkit-regression";

    createBareProjectMock.mockResolvedValue("/tmp/proofkit-regression/demo-browser");
    readJSONSyncMock.mockReturnValue({ name: "placeholder-app" });
    execaMock.mockResolvedValue({ stdout: "9.0.0" });
    promptForFileMakerDataSourceMock.mockResolvedValue(undefined);

    runCodegenCommandMock.mockRejectedValue(
      new Error(
        'Command failed with exit code 254: pnpm typegen\nERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL Command "typegen" not found',
      ),
    );
  });

  it("does not run initial codegen for browser scaffolds after filemaker setup", async () => {
    await expect(runInit("demo-browser", browserFilemakerFlags)).resolves.toBeUndefined();

    expect(promptForFileMakerDataSourceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        projectDir: "/tmp/proofkit-regression/demo-browser",
      }),
    );
    expect(runCodegenCommandMock).not.toHaveBeenCalled();
  });
});
