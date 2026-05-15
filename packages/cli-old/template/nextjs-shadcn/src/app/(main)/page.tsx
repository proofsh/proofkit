'use client';

import {
  CheckIcon,
  CopyIcon,
  ExternalLinkIcon,
  TerminalIcon,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

function GitHubMark({ size = 20 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      fill="currentColor"
      height={size}
      viewBox="0 0 24 24"
      width={size}
    >
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.09 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-2.14c-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.75 2.69 1.25 3.35.95.1-.74.4-1.25.72-1.54-2.55-.29-5.23-1.28-5.23-5.68 0-1.25.45-2.28 1.18-3.08-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.16 1.18A10.9 10.9 0 0 1 12 6.04c.98 0 1.95.13 2.87.39 2.19-1.49 3.15-1.18 3.15-1.18.63 1.58.24 2.75.12 3.04.74.8 1.18 1.83 1.18 3.08 0 4.42-2.69 5.38-5.25 5.67.41.36.78 1.06.78 2.13v3.18c0 .31.21.67.79.56A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  );
}

function InlineSnippet({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);

  const onCopy = () => {
    if (typeof window === 'undefined' || !navigator.clipboard?.writeText) {
      return;
    }
    navigator.clipboard.writeText(command).then(
      () => {
        setCopied(true);
        const timeoutInMilliseconds = 2000;
        setTimeout(() => setCopied(false), timeoutInMilliseconds);
      },
      () => {
        // do nothing
      }
    );
  };

  return (
    <div className="relative w-full overflow-hidden rounded-md border bg-muted text-left">
      <div className="flex items-center gap-2 px-3 py-2">
        <TerminalIcon className="text-muted-foreground" size={16} />
        <div className="flex-1 overflow-x-auto text-left">
          <code className="whitespace-nowrap font-mono text-sm md:text-base">
            {command}
          </code>
        </div>
        <Button
          aria-label={copied ? 'Copied' : 'Copy'}
          onClick={onCopy}
          size="icon"
          variant="ghost"
        >
          {copied ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
        </Button>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div className="flex min-h-[calc(100dvh-var(--header-height,56px))] flex-col">
      <div className="mx-auto mt-20 max-w-screen-md px-4">
        <div className="flex flex-col items-center gap-6 text-center">
          {/** biome-ignore lint/performance/noImgElement: just a template image */}
          <img
            alt="ProofKit"
            className="h-auto max-h-64 w-auto"
            height={256}
            src="https://raw.githubusercontent.com/proofsh/proofkit/dde6366c529104658dfba67a8fc2910a8644fc64/docs/src/assets/proofkit.png"
            width={256}
          />
          <h1 className="font-bold text-3xl text-foreground">Welcome!</h1>

          <p className="text-balance text-base text-muted-foreground">
            This is the base template home page. To add more pages, components,
            or other features, run the ProofKit CLI from within your project.
          </p>

          <InlineSnippet command="pnpm proofkit" />

          <p className="text-balance text-base text-muted-foreground">
            To change this page, open <code>src/app/(main)/page.tsx</code>
          </p>
          <div>
            <Button asChild variant="outline">
              <a href="https://proofkit.proof.sh" rel="noreferrer" target="_blank">
                ProofKit Docs <ExternalLinkIcon size={16} />
              </a>
            </Button>
          </div>
        </div>
      </div>
      <div className="mt-auto border-border border-t py-4">
        <div className="mx-auto flex max-w-screen-md items-center justify-between px-4">
          <div className="text-muted-foreground text-sm">
            Sponsored by{' '}
            <a
              className="text-foreground underline hover:text-primary"
              href="http://proof.sh"
              rel="noopener proofkit-app"
              target="_blank"
            >
              Proof
            </a>{' '}
            and{' '}
            <a
              className="text-foreground underline hover:text-primary"
              href="https://ottomatic.cloud"
              rel="noopener proofkit-app"
              target="_blank"
            >
              Ottomatic
            </a>
          </div>
          <div>
            <a
              className="text-muted-foreground hover:text-foreground"
              href="https://github.com/proofsh/proofkit"
              rel="noopener"
              target="_blank"
            >
              <GitHubMark size={20} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
