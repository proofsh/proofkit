import type { PackageManager } from "~/utils/packageManager.js";

export type AppType = "browser" | "webviewer";
export type UIType = "shadcn" | "mantine";
export type DataSourceType = "filemaker" | "none";
export type OverwriteMode = "overwrite" | "clear";
export type FileMakerMode = "hosted-otto" | "local-fm-http";

export interface CliFlags {
  noGit: boolean;
  noInstall: boolean;
  force: boolean;
  default: boolean;
  importAlias: string;
  debug?: boolean;
  server?: string;
  adminApiKey?: string;
  fileName?: string;
  layoutName?: string;
  schemaName?: string;
  dataApiKey?: string;
  auth?: "none";
  dataSource?: DataSourceType;
  ui?: UIType;
  CI: boolean;
  nonInteractive?: boolean;
  appType?: AppType;
}

export interface FileMakerEnvNames {
  database: string;
  server: string;
  apiKey: string;
}

export interface HostedFileMakerInputs {
  mode: "hosted-otto";
  dataSourceName: string;
  envNames: FileMakerEnvNames;
  server: string;
  fileName: string;
  dataApiKey: string;
  layoutName?: string;
  schemaName?: string;
  adminApiKey?: string;
  fmsVersion?: string;
  ottoVersion?: string | null;
}

export interface LocalFmHttpInputs {
  mode: "local-fm-http";
  dataSourceName: string;
  envNames: FileMakerEnvNames;
  fmHttpBaseUrl: string;
  fileName: string;
  layoutName?: string;
  schemaName?: string;
}

export type FileMakerInputs = HostedFileMakerInputs | LocalFmHttpInputs;

export interface InitRequest {
  projectName: string;
  scopedAppName: string;
  appDir: string;
  appType: AppType;
  ui: UIType;
  dataSource: DataSourceType;
  packageManager: PackageManager;
  noInstall: boolean;
  noGit: boolean;
  force: boolean;
  cwd: string;
  importAlias: string;
  nonInteractive: boolean;
  debug: boolean;
  skipFileMakerSetup: boolean;
  fileMaker?: FileMakerInputs;
  hasExplicitFileMakerInputs: boolean;
}

export interface ProofKitSettings {
  ui: UIType;
  appType: AppType;
  envFile?: string;
  dataSources: Array<{
    type: "fm";
    name: string;
    envNames: {
      database: string;
      server: string;
      apiKey: string;
    };
  }>;
  replacedMainPage: boolean;
  registryTemplates: string[];
}

export interface InitPlan {
  request: InitRequest;
  targetDir: string;
  templateDir: string;
  overwriteMode?: OverwriteMode;
  packageManagerCommand: string;
  packageJson: {
    name: string;
    packageManager?: string;
    proofkitMetadata: {
      initVersion: string;
      scaffoldPackage: "@proofkit/new";
    };
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
  };
  settings: ProofKitSettings;
  envFile: {
    path: string;
    content: string;
  };
  writes: Array<{
    path: string;
    content: string;
  }>;
  commands: Array<{ type: "install" } | { type: "codegen" } | { type: "git-init" }>;
  tasks: {
    bootstrapFileMaker: boolean;
    runInstall: boolean;
    runInitialCodegen: boolean;
    initializeGit: boolean;
  };
  nextSteps: string[];
}

export interface InitResult {
  request: InitRequest;
  plan: InitPlan;
}
