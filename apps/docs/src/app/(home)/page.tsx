import { Card, Cards } from "fumadocs-ui/components/card";
import {
  Bot,
  Brain,
  Code,
  Database,
  Globe,
  RectangleEllipsis,
  ShieldCheck,
  Terminal,
  WandSparkles,
  WebhookIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import ProofKitLogo from "@/../public/proofkit.png";
import InitCommand from "@/components/InitCommand";
import { InteractiveGridPattern } from "@/components/magicui/interactive-grid-pattern";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export default function HomePage() {
  return (
    <main className="mt-24 mb-42 flex text-center">
      <div className="mx-auto flex w-full max-w-screen-lg flex-col items-center justify-center">
        <div className="relative flex h-[500px] w-full flex-col items-center justify-center overflow-hidden rounded-lg bg-background">
          <InteractiveGridPattern
            className={cn("absolute inset-0 [mask-image:radial-gradient(400px_circle_at_center,white,transparent)]")}
            height={40}
            squares={[80, 80]}
            squaresClassName="hover:fill-brand/50"
            style={{ zIndex: 0 }}
            width={40}
          />
          <Image alt="ProofKit Logo" className="pointer-events-none z-10" src={ProofKitLogo} width={400} />
        </div>

        <div className="mt-8 w-full space-y-8 text-center">
          <h1 className="font-bold text-4xl">A collection of tools for FileMaker-aware TypeScript applications</h1>
          <p className="font-medium text-gray-500 text-xl">
            For new and experienced developers alike, the ProofKit toolset is the best way to build web apps connected
            to FileMaker data, or rich, interactive interfaces in a FileMaker webviewer.
          </p>

          <Cards className="px-4 text-left">
            <Card href="/docs/cli" icon={<Terminal />} title="ProofKit CLI">
              A command line tool to start a new project, or easily apply templates and common patterns with{" "}
              <span className="underline">no JavaScript experience</span> required.
            </Card>
            <Card href="/docs/typegen" icon={<Code />} title={"Typegen"}>
              Automatically generate runtime validators and TypeScript files from your own FileMaker layouts or table
              occurrences.
            </Card>
            <Card href="/docs/fmdapi" icon={<WebhookIcon />} title="Filemaker Data API">
              A type-safe API for your FileMaker layouts. Easily connect without worrying about token management.
            </Card>
            <Card
              href="/docs/fmodata"
              icon={<Database />}
              title={
                <span className="flex items-center gap-2">
                  FileMaker OData API{" "}
                  <Badge appearance="light" variant="success">
                    New
                  </Badge>
                </span>
              }
            >
              A strongly-typed OData API client with full TypeScript inference, runtime validation, and a fluent query
              builder.
            </Card>
            <Card href="/docs/webviewer" icon={<Globe />} title="FileMaker Webviewer">
              Use async functions in WebViewer code to execute and get the result of a FileMaker script.
            </Card>
            <Card
              href="/docs/better-auth"
              icon={<RectangleEllipsis />}
              title={
                <span className="flex items-center gap-2">
                  Better-Auth Adapter{" "}
                  <Badge appearance="light" variant="info">
                    Beta
                  </Badge>
                </span>
              }
            >
              Own your authentication with FileMaker and the extensible Better-Auth framework.
            </Card>
          </Cards>

          <Separator className="my-12" />

          <div className="mx-auto max-w-5xl px-4">
            <div className="flex flex-col text-left">
              <h2 className="mb-4 font-bold text-3xl">Quick Start</h2>
              <p className="mb-0 text-gray-600 text-lg">
                Use the ProofKit CLI to launch a full-featured Next.js app in minutes—no prior experience required.
              </p>
            </div>

            <div className="flex flex-col text-left md:flex-row">
              <div className="min-w-96">
                <InitCommand />
              </div>

              <div className="mt-6 flex flex-col rounded-lg bg-background/50 p-4 text-left md:mt-0 md:p-6">
                <p>
                  Check out the{" "}
                  <Link
                    className="text-primary underline transition hover:opacity-80"
                    href="/docs/cli/guides/getting-started"
                  >
                    full getting started guide
                  </Link>{" "}
                  for more detailed explanations and prerequisites.
                </p>
              </div>
            </div>
          </div>

          <Separator className="my-12" />

          <div className="mx-auto max-w-5xl px-4">
            <div className="flex flex-col text-left">
              <h2 className="mb-4 flex items-center gap-3 font-bold text-3xl">
                <WandSparkles className="size-8 text-brand" />
                Built for AI Agents
              </h2>
              <p className="mb-0 text-gray-600 text-lg">
                Every ProofKit package ships with agent skills — built from decades of combined FileMaker integration
                experience at Proof+Geist — that give AI coding tools like Claude Code and Cursor the context they need
                to write correct, production-ready FileMaker code from day one.
              </p>
            </div>

            <div className="mt-6 grid gap-4 text-left md:grid-cols-3">
              <div className="flex flex-col gap-2 rounded-lg border p-4">
                <div className="flex items-center gap-2 font-semibold">
                  <Brain className="size-5 text-brand" />
                  Expert knowledge built in
                </div>
                <p className="text-gray-500 text-sm">
                  Agent skills cover API patterns, edge cases, and common mistakes so your AI agent avoids the pitfalls
                  that trip up even experienced developers.
                </p>
              </div>
              <div className="flex flex-col gap-2 rounded-lg border p-4">
                <div className="flex items-center gap-2 font-semibold">
                  <ShieldCheck className="size-5 text-brand" />
                  Type-safe by default
                </div>
                <p className="text-gray-500 text-sm">
                  Schemas generated from your FileMaker field names plus runtime validators catch bugs early — whether
                  code is written by you or your AI agent.
                </p>
              </div>
              <div className="flex flex-col gap-2 rounded-lg border p-4">
                <div className="flex items-center gap-2 font-semibold">
                  <Bot className="size-5 text-brand" />
                  Works with any agent
                </div>
                <p className="text-gray-500 text-sm">
                  Skills are bundled with each package — just install and your AI coding tool picks them up
                  automatically. Compatible with Claude Code, Cursor, Windsurf, and more.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
