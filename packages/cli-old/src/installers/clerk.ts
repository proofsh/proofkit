import path from "node:path";
import chalk from "chalk";
import fs from "fs-extra";
import { type SourceFile, SyntaxKind } from "ts-morph";

import { PKG_ROOT } from "~/consts.js";
import { addPackageDependency } from "~/utils/addPackageDependency.js";
import { addToEnv } from "~/utils/addToEnvs.js";
import { formatAndSaveSourceFiles, getNewProject } from "~/utils/ts-morph.js";
import { addToHeaderSlot } from "./auth-shared.js";

export const clerkInstaller = async ({ projectDir }: { projectDir: string }) => {
  addPackageDependency({
    projectDir,
    dependencies: ["@clerk/nextjs", "@clerk/themes"],
    devMode: false,
  });

  // add clerk middleware
  // check if middleware already exists, if not add it
  const extrasDir = path.join(PKG_ROOT, "template/extras");

  const middlewareDest = path.join(projectDir, "src/middleware.ts");
  if (fs.existsSync(middlewareDest)) {
    // throw new Error("Middleware already exists");
    console.log(
      chalk.yellow(
        "Middleware already exists. To require auth for your app, be sure to follow the guide to setup Clerk middleware. https://clerk.com/docs/references/nextjs/clerk-middleware#clerk-middleware-next-js",
      ),
    );
  } else {
    const middlewareSrc = path.join(extrasDir, "src/middleware/clerk.ts");
    fs.copySync(middlewareSrc, middlewareDest);
  }

  // copy auth pages
  fs.copySync(path.join(extrasDir, "src/app/clerk-auth"), path.join(projectDir, "src/app/auth"));

  // copy auth components
  fs.copySync(path.join(extrasDir, "src/components/clerk-auth"), path.join(projectDir, "src/components/clerk-auth"));

  // add ClerkProvider to app layout
  const layoutFile = path.join(projectDir, "src/app/layout.tsx");
  const project = getNewProject(projectDir);
  addClerkProvider(project.addSourceFileAtPath(layoutFile));

  // inject signin/signout components to header slots
  addToHeaderSlot(
    project.addSourceFileAtPath(path.join(projectDir, "src/components/AppShell/slot-header-right.tsx")),
    "@/components/clerk-auth/user-menu",
  );
  addToHeaderSlot(
    project.addSourceFileAtPath(path.join(projectDir, "src/components/AppShell/slot-header-mobile-content.tsx")),
    "@/components/clerk-auth/user-menu-mobile",
  );

  addToSafeActionClient(project.addSourceFileAtPathIfExists(path.join(projectDir, "src/server/safe-action.ts")));

  // add envs to .env and .env.schema
  await addToEnv({
    projectDir,
    project,
    envs: [
      {
        name: "NEXT_PUBLIC_CLERK_SIGN_IN_URL",
        zodValue: "z.string()",
        defaultValue: "/auth/signin",
        type: "client",
      },
      {
        name: "NEXT_PUBLIC_CLERK_SIGN_UP_URL",
        zodValue: "z.string()",
        defaultValue: "/auth/signup",
        type: "client",
      },
      {
        name: "CLERK_SECRET_KEY",
        zodValue: `z.string().startsWith('sk_').min(1, {
        message:
          "No Clerk Secret Key found. Did you create your Clerk app and copy the environment variables to you .env file?",
      })`,
        type: "server",
      },
      {
        name: "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
        zodValue: `z.string().startsWith('pk_').min(1, {
        message:
          "No Clerk Public Key found. Did you create your Clerk app and copy the environment variables to you .env file?",
      })`,
        type: "client",
      },
    ],
    envFileDescription:
      "Hosted auth with Clerk. Set up a new app at https://dashboard.clerk.com/apps/new to get these values.",
  });

  await formatAndSaveSourceFiles(project);
};

export function addClerkProvider(sourceFile: SourceFile) {
  sourceFile.addImportDeclaration({
    namedImports: [{ name: "ClerkAuthProvider" }],
    moduleSpecifier: "@/components/clerk-auth/clerk-provider",
  });

  // Step 2: Wrap default exported function's return statement with ClerkProvider
  const exportDefault = sourceFile.getFunction((dec) => dec.isDefaultExport());

  // find the mantine provider in this export
  const mantineProvider = exportDefault
    ?.getBody()
    ?.getFirstDescendantByKind(SyntaxKind.ReturnStatement)
    ?.getDescendantsOfKind(SyntaxKind.JsxOpeningElement)
    .find((openingElement) => openingElement.getTagNameNode().getText() === "MantineProvider")
    ?.getParentIfKind(SyntaxKind.JsxElement);

  const childrenText = mantineProvider
    ?.getJsxChildren()
    .map((child) => child.getText())
    .filter(Boolean)
    .join("\n");

  mantineProvider?.getChildSyntaxList()?.replaceWithText(
    `<ClerkAuthProvider>
      ${childrenText}
    </ClerkAuthProvider>`,
  );
}

function addToSafeActionClient(sourceFile?: SourceFile) {
  if (!sourceFile) {
    console.log(chalk.yellow("Failed to inject into safe-action-client. Did you move the safe-action.ts file?"));
    return;
  }

  sourceFile.addImportDeclaration({
    namedImports: [{ name: "auth", alias: "getAuth" }],
    moduleSpecifier: "@clerk/nextjs/server",
  });

  // add to end of file
  sourceFile.addStatements((writer) =>
    writer.writeLine(`export const authedActionClient = actionClient.use(async ({ next, ctx }) => {
  const auth = getAuth();
  if (!auth.userId) {
    throw new Error("Unauthorized");
  }
  return next({ ctx: { ...ctx, auth } });
});

`),
  );
}
