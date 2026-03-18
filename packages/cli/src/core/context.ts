import { Context } from "effect";
import type { AppType, FileMakerEnvNames, FileMakerInputs, ProofKitSettings, UIType } from "~/core/types.js";
import type { PackageManager } from "~/utils/packageManager.js";

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
  readonly exists: (path: string) => Promise<boolean>;
  readonly readdir: (path: string) => Promise<string[]>;
  readonly emptyDir: (path: string) => Promise<void>;
  readonly copyDir: (from: string, to: string, options?: { overwrite?: boolean }) => Promise<void>;
  readonly rename: (from: string, to: string) => Promise<void>;
  readonly remove: (path: string) => Promise<void>;
  readonly readJson: <T>(path: string) => Promise<T>;
  readonly writeJson: (path: string, value: unknown) => Promise<void>;
  readonly writeFile: (path: string, content: string) => Promise<void>;
  readonly readFile: (path: string) => Promise<string>;
}

export const FileSystemService = Context.GenericTag<FileSystemService>("@proofkit/cli/FileSystemService");

export interface TemplateService {
  readonly getTemplateDir: (appType: AppType, ui: UIType) => string;
}

export const TemplateService = Context.GenericTag<TemplateService>("@proofkit/cli/TemplateService");

export interface PackageManagerService {
  readonly getVersion: (packageManager: PackageManager, cwd: string) => Promise<string | undefined>;
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
  ) => Promise<{ stdout: string; stderr: string }>;
}

export const ProcessService = Context.GenericTag<ProcessService>("@proofkit/cli/ProcessService");

export interface GitService {
  readonly initialize: (projectDir: string) => Promise<void>;
}

export const GitService = Context.GenericTag<GitService>("@proofkit/cli/GitService");

export interface SettingsService {
  readonly writeSettings: (projectDir: string, settings: ProofKitSettings) => Promise<void>;
  readonly appendEnvVars: (projectDir: string, vars: Record<string, string>) => Promise<void>;
  readonly ensureTypegenConfig: (
    projectDir: string,
    options: { appType: AppType; fileMaker?: FileMakerInputs },
  ) => Promise<void>;
}

export const SettingsService = Context.GenericTag<SettingsService>("@proofkit/cli/SettingsService");

export interface FmHttpStatus {
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
    fmHttpBaseUrl?: string;
    connectedFileName?: string;
    layoutName?: string;
    schemaName?: string;
    appType: AppType;
  };
}

export interface FileMakerService {
  readonly detectLocalFmHttp: (baseUrl?: string) => Promise<FmHttpStatus>;
  readonly validateHostedServerUrl: (
    serverUrl: string,
    ottoPort?: number | null,
  ) => Promise<{
    normalizedUrl: string;
    versions: FileMakerServerVersions;
  }>;
  readonly getOttoFMSToken: (options: { url: URL }) => Promise<{ token: string }>;
  readonly listFiles: (options: { url: URL; token: string }) => Promise<OttoFileInfo[]>;
  readonly listAPIKeys: (options: { url: URL; token: string }) => Promise<OttoApiKeyInfo[]>;
  readonly createDataAPIKeyWithCredentials: (options: {
    url: URL;
    filename: string;
    username: string;
    password: string;
  }) => Promise<{ apiKey: string }>;
  readonly deployDemoFile: (options: {
    url: URL;
    token: string;
    operation: "install" | "replace";
  }) => Promise<{ apiKey: string; filename: string }>;
  readonly listLayouts: (options: { dataApiKey: string; fmFile: string; server: string }) => Promise<string[]>;
  readonly createFileMakerBootstrapArtifacts: (
    settings: ProofKitSettings,
    inputs: FileMakerInputs,
    appType: AppType,
  ) => Promise<FileMakerBootstrapArtifacts>;
  readonly bootstrap: (
    projectDir: string,
    settings: ProofKitSettings,
    inputs: FileMakerInputs,
    appType: AppType,
  ) => Promise<ProofKitSettings>;
}

export const FileMakerService = Context.GenericTag<FileMakerService>("@proofkit/cli/FileMakerService");

export interface CodegenService {
  readonly runInitial: (projectDir: string, packageManager: PackageManager) => Promise<void>;
}

export const CodegenService = Context.GenericTag<CodegenService>("@proofkit/cli/CodegenService");
