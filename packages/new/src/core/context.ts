import { Context } from "effect";
import type { AppType, FileMakerInputs, ProofKitSettings, UIType } from "~/core/types.js";
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

export const CliContext = Context.GenericTag<CliContextValue>("@proofkit/new/CliContext");

export interface PromptService {
  readonly text: (options: {
    message: string;
    defaultValue?: string;
    validate?: (value: string) => string | undefined;
  }) => Promise<string>;
  readonly select: <T extends string>(options: {
    message: string;
    options: Array<{ value: T; label: string; hint?: string }>;
  }) => Promise<T>;
  readonly confirm: (options: { message: string; initialValue?: boolean }) => Promise<boolean>;
}

export const PromptService = Context.GenericTag<PromptService>("@proofkit/new/PromptService");

export interface ConsoleService {
  readonly info: (message: string) => void;
  readonly warn: (message: string) => void;
  readonly error: (message: string) => void;
  readonly success: (message: string) => void;
  readonly note: (message: string, title?: string) => void;
}

export const ConsoleService = Context.GenericTag<ConsoleService>("@proofkit/new/ConsoleService");

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

export const FileSystemService = Context.GenericTag<FileSystemService>("@proofkit/new/FileSystemService");

export interface TemplateService {
  readonly getTemplateDir: (appType: AppType, ui: UIType) => string;
}

export const TemplateService = Context.GenericTag<TemplateService>("@proofkit/new/TemplateService");

export interface PackageManagerService {
  readonly getVersion: (packageManager: PackageManager, cwd: string) => Promise<string | undefined>;
}

export const PackageManagerService = Context.GenericTag<PackageManagerService>("@proofkit/new/PackageManagerService");

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

export const ProcessService = Context.GenericTag<ProcessService>("@proofkit/new/ProcessService");

export interface GitService {
  readonly initialize: (projectDir: string) => Promise<void>;
}

export const GitService = Context.GenericTag<GitService>("@proofkit/new/GitService");

export interface SettingsService {
  readonly writeSettings: (projectDir: string, settings: ProofKitSettings) => Promise<void>;
  readonly appendEnvVars: (projectDir: string, vars: Record<string, string>) => Promise<void>;
  readonly ensureTypegenConfig: (
    projectDir: string,
    options: { appType: AppType; fileMaker?: FileMakerInputs },
  ) => Promise<void>;
}

export const SettingsService = Context.GenericTag<SettingsService>("@proofkit/new/SettingsService");

export interface FileMakerService {
  readonly bootstrap: (
    projectDir: string,
    settings: ProofKitSettings,
    inputs: FileMakerInputs,
  ) => Promise<ProofKitSettings>;
}

export const FileMakerService = Context.GenericTag<FileMakerService>("@proofkit/new/FileMakerService");

export interface CodegenService {
  readonly runInitial: (projectDir: string, packageManager: PackageManager) => Promise<void>;
}

export const CodegenService = Context.GenericTag<CodegenService>("@proofkit/new/CodegenService");
