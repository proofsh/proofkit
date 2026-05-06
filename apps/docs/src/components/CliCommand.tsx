"use client";
import { DynamicCodeBlock } from "fumadocs-ui/components/dynamic-codeblock";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";
import { cliVersion } from "@/lib/constants";

const MANAGERS = [
  {
    key: "npm",
    label: "npm",
    prefix: "npm run",
    execPrefix: "npx",
  },
  {
    key: "pnpm",
    label: "pnpm",
    prefix: "pnpm",
    execPrefix: "pnpm dlx",
  },
  {
    key: "yarn",
    label: "yarn",
    prefix: "yarn",
    execPrefix: "yarn dlx",
  },
  {
    key: "bun",
    label: "bun",
    prefix: "bun",
    execPrefix: "bunx",
  },
];

export function CliCommand({
  command,
  exec,
  script,
  execPackage,
  packageName = "@proofkit/cli",
}: {
  command: string;
  exec?: boolean;
  script?: boolean;
  /** @deprecated Use packageName instead */
  execPackage?: string;
  packageName?: string;
}) {
  const hasVersionSpecifier = (pkg: string) => {
    if (pkg.startsWith("@")) {
      const slash = pkg.indexOf("/");
      return slash !== -1 && pkg.indexOf("@", slash + 1) !== -1;
    }
    return pkg.includes("@");
  };
  const shouldAppendVersion = packageName.startsWith("@proofkit/") && !hasVersionSpecifier(packageName);
  const pkg = execPackage ?? (shouldAppendVersion && cliVersion ? `${packageName}@${cliVersion}` : packageName);
  const getCommand = (manager: (typeof MANAGERS)[number]) => {
    if (exec) {
      return `${manager.execPrefix} ${pkg} ${command}`;
    }

    if (script) {
      if (manager.key === "npm") {
        return `${manager.prefix} ${command}`;
      }

      if (manager.key === "bun") {
        return `${manager.prefix} run ${command}`;
      }

      return `${manager.prefix} ${command}`;
    }

    return `${manager.prefix} ${command}`;
  };

  return (
    <Tabs groupId="package-manager" id="package-manager" items={MANAGERS.map((m) => m.label)} persist>
      {MANAGERS.map((manager) => (
        <Tab key={manager.key} value={manager.label}>
          <DynamicCodeBlock code={getCommand(manager)} lang="bash" />
        </Tab>
      ))}
    </Tabs>
  );
}

export default CliCommand;
