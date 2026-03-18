'use client';

import {
  CheckIcon,
  CopyIcon,
  ExternalLinkIcon,
  GithubIcon,
  TerminalIcon,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

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
            src="https://raw.githubusercontent.com/proofgeist/proofkit/dde6366c529104658dfba67a8fc2910a8644fc64/docs/src/assets/proofkit.png"
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
              <a href="https://proofkit.dev" rel="noreferrer" target="_blank">
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
              href="https://proofgeist.com"
              rel="noopener proofkit-app"
              target="_blank"
            >
              Proof+Geist
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
              href="https://github.com/proofgeist/proofkit"
              rel="noopener"
              target="_blank"
            >
              <GithubIcon size={20} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
