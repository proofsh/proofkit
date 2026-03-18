"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { useCallback, useState } from "react";

interface AgentCommandProps {
  command?: string;
  label?: string;
}

export function AgentCommand({
  command = "npx @tanstack/intent@latest install",
  label = "Tell your agent to run",
}: AgentCommandProps) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(() => {
    navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [command]);

  return (
    <div className="group relative my-4 font-mono text-sm">
      <div className="overflow-hidden rounded-lg border border-[#e87a2a] bg-[#1a1a2e]">
        <div className="flex items-center justify-between border-[#e87a2a]/40 border-b px-4 py-2">
          <span className="text-[#e87a2a] text-xs">{label}</span>
          <button
            aria-label="Copy command"
            className="rounded-md p-1 text-[#7a7a9e] transition-colors hover:text-[#e0e0e0]"
            onClick={copy}
            type="button"
          >
            {copied ? <CheckIcon className="size-4 text-green-400" /> : <CopyIcon className="size-4" />}
          </button>
        </div>
        <div className="px-4 py-3">
          <span className="text-[#e87a2a]">❯ </span>
          <span className="text-[#e0e0e0]">{command}</span>
        </div>
      </div>
    </div>
  );
}

export default AgentCommand;
