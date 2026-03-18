import { execSync } from "node:child_process";
import path from "node:path";
import fs from "fs-extra";
import { type Project, SyntaxKind } from "ts-morph";

import { findT3EnvFile } from "~/installers/envVars.js";
import { state } from "~/state.js";
import { formatAndSaveSourceFiles, getNewProject } from "./ts-morph.js";

interface EnvSchema {
  name: string;
  zodValue: string;
  /** This value will be added to the .env file, unless `addToRuntimeEnv` is set to `false`. */
  defaultValue?: string;
  type: "server" | "client";
  addToRuntimeEnv?: boolean;
}

export async function addToEnv({
  projectDir = state.projectDir,
  envs,
  envFileDescription,
  ...args
}: {
  projectDir?: string;
  project?: Project;
  envs: EnvSchema[];
  envFileDescription?: string;
}) {
  const envSchemaFile = findT3EnvFile();

  const project = args.project ?? getNewProject(projectDir);
  const schemaFile = project.addSourceFileAtPath(envSchemaFile);

  if (!schemaFile) {
    throw new Error("Schema file not found");
  }

  // Find the createEnv call expression
  const createEnvCall = schemaFile
    .getDescendantsOfKind(SyntaxKind.CallExpression)
    .find((callExpr) => callExpr.getExpression().getText() === "createEnv");

  if (!createEnvCall) {
    throw new Error(
      "Could not find createEnv call in schema file. Make sure you have a valid env.ts file with createEnv setup.",
    );
  }

  // Get the server object property
  const opts = createEnvCall.getArguments()[0];
  if (!opts) {
    throw new Error("createEnv call is missing options argument");
  }

  const serverProperty = opts
    .getDescendantsOfKind(SyntaxKind.PropertyAssignment)
    .find((prop) => prop.getName() === "server")
    ?.getFirstDescendantByKind(SyntaxKind.ObjectLiteralExpression);

  const clientProperty = opts
    .getDescendantsOfKind(SyntaxKind.PropertyAssignment)
    .find((prop) => prop.getName() === "client")
    ?.getFirstDescendantByKind(SyntaxKind.ObjectLiteralExpression);

  const runtimeEnvProperty = opts
    .getDescendantsOfKind(SyntaxKind.PropertyAssignment)
    .find((prop) => prop.getName() === "experimental__runtimeEnv")
    ?.getFirstDescendantByKind(SyntaxKind.ObjectLiteralExpression);

  const serverEnvs = envs.filter((env) => env.type === "server");
  const clientEnvs = envs.filter((env) => env.type === "client");

  for (const env of serverEnvs) {
    serverProperty?.addPropertyAssignment({
      name: env.name,
      initializer: env.zodValue,
    });
  }

  for (const env of clientEnvs) {
    clientProperty?.addPropertyAssignment({
      name: env.name,
      initializer: env.zodValue,
    });

    runtimeEnvProperty?.addPropertyAssignment({
      name: env.name,
      initializer: `process.env.${env.name}`,
    });
  }

  const envsString = envs
    .filter((env) => env.addToRuntimeEnv ?? true)
    .map((env) => `${env.name}=${env.defaultValue ?? ""}`)
    .join("\n");

  const dotEnvFile = path.join(projectDir, ".env");

  // Only handle .env file if it already exists
  if (fs.existsSync(dotEnvFile)) {
    const currentFile = fs.readFileSync(dotEnvFile, "utf-8");

    // Ensure .env is in .gitignore using command line
    const gitIgnoreFile = path.join(projectDir, ".gitignore");
    try {
      let gitIgnoreContent = "";
      if (fs.existsSync(gitIgnoreFile)) {
        gitIgnoreContent = fs.readFileSync(gitIgnoreFile, "utf-8");
      }

      if (!gitIgnoreContent.includes(".env")) {
        execSync(`echo ".env" >> "${gitIgnoreFile}"`, { cwd: projectDir });
      }
    } catch (_error) {
      // Silently ignore gitignore errors
    }

    const newContent = `${currentFile}
${envFileDescription ? `# ${envFileDescription}\n${envsString}` : envsString}
    `;

    fs.writeFileSync(dotEnvFile, newContent);
  }

  if (!args.project) {
    await formatAndSaveSourceFiles(project);
  }

  return schemaFile;
}
