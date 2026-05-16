import type { Effect as Fx } from "effect";
import { Context } from "effect";
import type { CliError } from "~/core/errors.js";
import type { AppType, FileMakerEnvNames, FileMakerInputs, ProofKitSettings, UIType } from "~/core/types.js";
import type { PackageManager } from "~/utils/packageManager.js";

type Eff<A, E = never, R = never> = Fx.Effect<A, E, R>;

export interface CliContextValue {
  cwd: string;
  debug: boolean;
  nonInteractive: boolean;
  packageManager: PackageManager;
  resolvedProjectConfig?: {
    appType?: AppType;
    ui?: UIType;
    projectDir?: string;
  };
}

export const CliContext = Context.GenericTag<CliContextValue>("@proofkit/cli/CliContext");

export interface PromptService {
  readonly text: (options: {
    message: string;
    defaultValue?: string;
    validate?: (value: string) => string | undefined;
  }) => Promise<string>;
  readonly password: (options: {
    message: string;
    validate?: (value: string) => string | undefined;
  }) => Promise<string>;
  readonly select: <T extends string>(options: {
    message: string;
    options: Array<{ value: T; label: string; hint?: string; disabled?: boolean | string }>;
  }) => Promise<T>;
  readonly searchSelect: <T extends string>(options: {
    message: string;
    emptyMessage?: string;
    options: Array<{ value: T; label: string; hint?: string; keywords?: string[]; disabled?: boolean | string }>;
  }) => Promise<T>;
  readonly multiSearchSelect: <T extends string>(options: {
    message: string;
    options: Array<{ value: T; label: string; hint?: string; keywords?: string[]; disabled?: boolean | string }>;
    required?: boolean;
  }) => Promise<T[]>;
  readonly confirm: (options: { message: string; initialValue?: boolean }) => Promise<boolean>;
}

export const PromptService = Context.GenericTag<PromptService>("@proofkit/cli/PromptService");

export interface ConsoleService {
  readonly info: (message: string) => void;
  readonly warn: (message: string) => void;
  readonly error: (message: string) => void;
  readonly success: (message: string) => void;
  readonly note: (message: string, title?: string) => void;
}

export const ConsoleService = Context.GenericTag<ConsoleService>("@proofkit/cli/ConsoleService");

export interface FileSystemService {
  readonly exists: (path: string) => Eff<boolean, CliError>;
  readonly readdir: (path: string) => Eff<string[], CliError>;
  readonly emptyDir: (path: string) => Eff<void, CliError>;
  readonly copyDir: (from: string, to: string, options?: { overwrite?: boolean }) => Eff<void, CliError>;
  readonly rename: (from: string, to: string) => Eff<void, CliError>;
  readonly remove: (path: string) => Eff<void, CliError>;
  readonly readJson: <T>(path: string) => Eff<T, CliError>;
  readonly writeJson: (path: string, value: unknown) => Eff<void, CliError>;
  readonly writeFile: (path: string, content: string) => Eff<void, CliError>;
  readonly readFile: (path: string) => Eff<string, CliError>;
}

export const FileSystemService = Context.GenericTag<FileSystemService>("@proofkit/cli/FileSystemService");

export interface TemplateService {
  readonly getTemplateDir: (appType: AppType, ui: UIType) => string;
}

export const TemplateService = Context.GenericTag<TemplateService>("@proofkit/cli/TemplateService");

export interface PackageManagerService {
  readonly getVersion: (packageManager: PackageManager, cwd: string) => Eff<string | undefined, CliError>;
}

export const PackageManagerService = Context.GenericTag<PackageManagerService>("@proofkit/cli/PackageManagerService");

export interface ProcessService {
  readonly run: (
    command: string,
    args: string[],
    options: {
      cwd: string;
      stdout?: "pipe" | "inherit" | "ignore";
      stderr?: "pipe" | "inherit" | "ignore";
    },
  ) => Eff<{ stdout: string; stderr: string }, CliError>;
}

export const ProcessService = Context.GenericTag<ProcessService>("@proofkit/cli/ProcessService");

export interface GitService {
  readonly initialize: (projectDir: string) => Eff<void, CliError>;
}

export const GitService = Context.GenericTag<GitService>("@proofkit/cli/GitService");

export interface SettingsService {
  readonly writeSettings: (projectDir: string, settings: ProofKitSettings) => Eff<void, CliError>;
  readonly appendEnvVars: (projectDir: string, vars: Record<string, string>) => Eff<void, CliError>;
}

export const SettingsService = Context.GenericTag<SettingsService>("@proofkit/cli/SettingsService");

export interface FmMcpStatus {
  baseUrl: string;
  healthy: boolean;
  connectedFiles: string[];
}

export interface FileMakerServerVersions {
  fmsVersion: string;
  ottoVersion: string | null;
}

export interface OttoFileInfo {
  filename: string;
  status: string;
}

export interface OttoApiKeyInfo {
  key: string;
  user: string;
  database: string;
  label: string;
}

export interface FileMakerDataSourceEntry {
  type: "fm";
  name: string;
  envNames: FileMakerEnvNames;
}

export interface FileMakerBootstrapArtifacts {
  settings: ProofKitSettings;
  envVars: Record<string, string>;
  envSchemaEntries: Array<{
    name: string;
    zodSchema: string;
    defaultValue: string;
  }>;
  typegenConfig: {
    mode: FileMakerInputs["mode"];
    dataSourceName: string;
    envNames?: FileMakerEnvNames;
    fmMcpBaseUrl?: string;
    connectedFileName?: string;
    persistentTokenEnvName?: string;
    layoutName?: string;
    schemaName?: string;
    appType: AppType;
  };
}

export interface FileMakerService {
  readonly detectLocalFmMcp: (baseUrl?: string) => Eff<FmMcpStatus, CliError>;
  readonly authorizeLocalFmMcp: (input: {
    baseUrl: string;
    fileName: string;
    interactive: boolean;
    clientName: string;
    clientDescription: string;
  }) => Eff<{ persistentToken: string; persistentTokenEnvName: string }, CliError>;
  readonly installLocalWebViewerAddon: () => Eff<void, CliError>;
  readonly validateHostedServerUrl: (
    serverUrl: string,
    ottoPort?: number | null,
  ) => Eff<
    {
      normalizedUrl: string;
      versions: FileMakerServerVersions;
    },
    CliError
  >;
  readonly getOttoFMSToken: (options: { url: URL }) => Eff<{ token: string }, CliError>;
  readonly listFiles: (options: { url: URL; token: string }) => Eff<OttoFileInfo[], CliError>;
  readonly listAPIKeys: (options: { url: URL; token: string }) => Eff<OttoApiKeyInfo[], CliError>;
  readonly createDataAPIKeyWithCredentials: (options: {
    url: URL;
    filename: string;
    username: string;
    password: string;
  }) => Eff<{ apiKey: string }, CliError>;
  readonly deployDemoFile: (options: {
    url: URL;
    token: string;
    operation: "install" | "replace";
  }) => Eff<{ apiKey: string; filename: string }, CliError>;
  readonly listLayouts: (options: { dataApiKey: string; fmFile: string; server: string }) => Eff<string[], CliError>;
  readonly createFileMakerBootstrapArtifacts: (
    settings: ProofKitSettings,
    inputs: FileMakerInputs,
    appType: AppType,
  ) => Eff<FileMakerBootstrapArtifacts, CliError>;
  readonly bootstrap: (
    projectDir: string,
    settings: ProofKitSettings,
    inputs: FileMakerInputs,
    appType: AppType,
  ) => Eff<ProofKitSettings, CliError>;
}

export const FileMakerService = Context.GenericTag<FileMakerService>("@proofkit/cli/FileMakerService");

export interface CodegenService {
  readonly runInitial: (projectDir: string, packageManager: PackageManager) => Eff<void, CliError>;
}

export const CodegenService = Context.GenericTag<CodegenService>("@proofkit/cli/CodegenService");
