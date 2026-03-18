import path from "node:path";
import chalk from "chalk";
import fs from "fs-extra";
import ora from "ora";
import { type SourceFile, SyntaxKind } from "ts-morph";

import { PKG_ROOT } from "~/consts.js";
import { getExistingSchemas } from "~/generators/fmdapi.js";
import { _runExecCommand, generateRandomSecret } from "~/helpers/installDependencies.js";
import { addPackageDependency } from "~/utils/addPackageDependency.js";
import { addToEnv } from "~/utils/addToEnvs.js";
import { formatAndSaveSourceFiles, getNewProject } from "~/utils/ts-morph.js";
import { addToHeaderSlot } from "./auth-shared.js";
import { dependencyVersionMap } from "./dependencyVersionMap.js";

export const nextAuthInstaller = async ({ projectDir }: { projectDir: string }) => {
  addPackageDependency({
    projectDir,
    dependencies: ["next-auth", "next-auth-adapter-filemaker"],
    devMode: false,
  });

  const extrasDir = path.join(PKG_ROOT, "template/extras");

  const routeHandlerFile = "src/app/api/auth/[...nextauth]/route.ts";
  const srcToUse = routeHandlerFile;

  const apiHandlerSrc = path.join(extrasDir, srcToUse);
  const apiHandlerDest = path.join(projectDir, srcToUse);
  fs.copySync(apiHandlerSrc, apiHandlerDest);

  const authConfigSrc = path.join(extrasDir, "src/server", "next-auth", "base.ts");
  const authConfigDest = path.join(projectDir, "src/server/auth.ts");
  fs.copySync(authConfigSrc, authConfigDest);

  const passwordSrc = path.join(extrasDir, "src/server", "next-auth", "password.ts");
  const passwordDest = path.join(projectDir, "src/server/password.ts");
  fs.copySync(passwordSrc, passwordDest);

  // copy users.ts to data directory
  fs.copySync(path.join(extrasDir, "src/server/data/users.ts"), path.join(projectDir, "src/server/data/users.ts"));

  // copy auth pages
  fs.copySync(path.join(extrasDir, "src/app/next-auth"), path.join(projectDir, "src/app/auth"));

  // copy auth components
  fs.copySync(path.join(extrasDir, "src/components/next-auth"), path.join(projectDir, "src/components/next-auth"));

  const project = getNewProject(projectDir);

  // modify root layout to wrap with session provider
  addNextAuthProviderToRootLayout(project.addSourceFileAtPath(path.join(projectDir, "src/app/layout.tsx")));

  // inject signin/signout components to header slots
  addToHeaderSlot(
    project.addSourceFileAtPath(path.join(projectDir, "src/components/AppShell/slot-header-right.tsx")),
    "@/components/next-auth/user-menu",
  );
  addToHeaderSlot(
    project.addSourceFileAtPath(path.join(projectDir, "src/components/AppShell/slot-header-mobile-content.tsx")),
    "@/components/next-auth/user-menu-mobile",
  );

  // add a protected safe-action-client
  addToSafeActionClient(project.addSourceFileAtPathIfExists(path.join(projectDir, "src/server/safe-action.ts")));

  // // TODO do this part in-house, maybe with execa directly
  // await runExecCommand({
  //   command: ["auth", "secret"],
  //   projectDir,
  // });

  // add middleware
  fs.copySync(path.join(extrasDir, "src/middleware/next-auth.ts"), path.join(projectDir, "src/middleware.ts"));

  // add envs to .env and .env.schema
  await addToEnv({
    projectDir,
    project,
    envs: [
      {
        name: "AUTH_SECRET",
        zodValue: "z.string().min(1)",
        defaultValue: generateRandomSecret(),
        type: "server",
      },
    ],
  });

  await checkForNextAuthLayouts(projectDir);

  await formatAndSaveSourceFiles(project);
};

function addNextAuthProviderToRootLayout(rootLayoutSource: SourceFile) {
  // Add imports
  rootLayoutSource.addImportDeclaration({
    namedImports: [{ name: "NextAuthProvider" }],
    moduleSpecifier: "@/components/next-auth/next-auth-provider",
  });
  rootLayoutSource.addImportDeclaration({
    namedImports: [{ name: "auth" }],
    moduleSpecifier: "@/server/auth",
  });

  const exportDefault = rootLayoutSource.getFunction((dec) => dec.isDefaultExport());

  // make the function async
  exportDefault?.setIsAsync(true);

  // get the session server-side
  exportDefault?.getFirstDescendantByKind(SyntaxKind.Block)?.insertStatements(0, "const session = await auth();");

  // get the body element from the return statement
  const bodyElement = exportDefault
    ?.getBody()
    ?.getFirstDescendantByKind(SyntaxKind.ReturnStatement)
    ?.getDescendantsOfKind(SyntaxKind.JsxOpeningElement)
    .find((openingElement) => openingElement.getTagNameNode().getText() === "body")
    ?.getParentIfKind(SyntaxKind.JsxElement);

  // wrap the body element with the next auth provider
  bodyElement?.replaceWithText(
    `<NextAuthProvider session={session}>
      ${bodyElement.getText()}
    </NextAuthProvider>`,
  );

  rootLayoutSource.formatText();
  rootLayoutSource.saveSync();
}

function addToSafeActionClient(sourceFile?: SourceFile) {
  if (!sourceFile) {
    console.log(chalk.yellow("Failed to inject into safe-action-client. Did you move the safe-action.ts file?"));
    return;
  }

  sourceFile.addImportDeclaration({
    namedImports: [{ name: "auth" }],
    moduleSpecifier: "@/server/auth",
  });

  // add to end of file
  sourceFile.addStatements((writer) =>
    writer.writeLine(`export const authedActionClient = actionClient.use(
  async ({ next, ctx }) => {
    const session = await auth();
    if (!session) {
      throw new Error("Unauthorized");
    }
    return next({ ctx: { ...ctx, session } });
  }
);
`),
  );
}

async function checkForNextAuthLayouts(projectDir: string) {
  const existingLayouts = getExistingSchemas({
    projectDir,
    dataSourceName: "filemaker",
  });
  const nextAuthLayouts = ["nextauth_user", "nextauth_account", "nextauth_session", "nextauth_verificationToken"];

  const allNextAuthLayoutsExist = nextAuthLayouts.every((layout) =>
    existingLayouts.some((l) => l.schemaName === layout),
  );

  if (allNextAuthLayoutsExist) {
    return;
  }

  const spinner = await _runExecCommand({
    command: [`next-auth-adapter-filemaker@${dependencyVersionMap["next-auth-adapter-filemaker"]}`, "install-addon"],
    projectDir,
  });

  // If the spinner was used to show the progress, use succeed method on it
  // If not, use the succeed on a new spinner
  (spinner ?? ora()).succeed(chalk.green("Successfully installed next-auth addon for FileMaker"));

  console.log("");
  console.log(chalk.bgYellow(" ACTION REQUIRED: "));
  console.log(
    `${chalk.yellowBright("You must now install the NextAuth addon in your FileMaker file.")}
Learn more: https://proofkit.dev/auth/next-auth\n`,
  );
}
