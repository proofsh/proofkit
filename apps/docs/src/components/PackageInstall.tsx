"use client";
import { DynamicCodeBlock } from "fumadocs-ui/components/dynamic-codeblock";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";
import { cliVersion } from "@/lib/constants";

const MANAGERS = [
  { key: "npm", label: "npm", prefix: "npm install", globalPrefix: "npm install -g" },
  { key: "pnpm", label: "pnpm", prefix: "pnpm add", globalPrefix: "pnpm add -g" },
  { key: "yarn", label: "yarn", prefix: "yarn add", globalPrefix: "yarn global add" },
  { key: "bun", label: "bun", prefix: "bun add", globalPrefix: "bun add -g" },
];

const WHITESPACE_RE = /\s+/;

/**
 * Renders a tabbed package install command.
 * Appends @{cliVersion} to @proofkit/* packages when configured unless version is already specified.
 */
export function PackageInstall({ packages, global: isGlobal }: { packages: string; global?: boolean }) {
  const pkgs = packages
    .trim()
    .split(WHITESPACE_RE)
    .map((pkg) => {
      if (cliVersion && pkg.startsWith("@proofkit/") && !pkg.includes("@", 1)) {
        return `${pkg}@${cliVersion}`;
      }
      return pkg;
    })
    .join(" ");

  return (
    <Tabs groupId="package-manager" id="package-manager" items={MANAGERS.map((m) => m.label)} persist>
      {MANAGERS.map((manager) => (
        <Tab key={manager.key} value={manager.label}>
          <DynamicCodeBlock code={`${isGlobal ? manager.globalPrefix : manager.prefix} ${pkgs}`} lang="bash" />
        </Tab>
      ))}
    </Tabs>
  );
}

export default PackageInstall;
