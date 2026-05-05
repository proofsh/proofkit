import { DynamicCodeBlock } from "fumadocs-ui/components/dynamic-codeblock";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";
import { cliVersion } from "@/lib/constants";

const versionSuffix = cliVersion ? `@${cliVersion}` : "";

const MANAGERS = [
  { key: "pnpm", label: "pnpm", command: `pnpm create proofkit${versionSuffix}` },
  { key: "npm", label: "npm", command: `npx create-proofkit${versionSuffix}` },
  { key: "yarn", label: "yarn", command: `yarn create proofkit${versionSuffix}` },
];

export function InitCommand() {
  return (
    <Tabs groupId="package-manager" id="package-manager" items={MANAGERS.map((m) => m.label)} persist>
      {MANAGERS.map((manager) => (
        <Tab key={manager.key} value={manager.label}>
          <DynamicCodeBlock code={manager.command} lang="bash" />
        </Tab>
      ))}
    </Tabs>
  );
}

export default InitCommand;
