import { globalSettings } from "@proofkit/webviewer";
import type { LucideIcon } from "lucide-react";
import { Database, Layers, Sparkles } from "lucide-react";

type Step = {
  readonly icon: LucideIcon;
  readonly title: string;
  readonly body: string;
};

globalSettings.setWebViewerName("web");

const steps: readonly Step[] = [
  {
    icon: Database,
    title: "Connect FileMaker later",
    body: "This starter renders safely in a normal browser. When you are ready, wire in FM HTTP or hosted FileMaker setup with ProofKit commands.",
  },
  {
    icon: Layers,
    title: "Generate clients when ready",
    body: "Add layouts to proofkit-typegen.config.jsonc, then run your typegen script to create strongly typed layout clients.",
  },
  {
    icon: Sparkles,
    title: "Add shadcn components fast",
    body: "Tailwind v4 and shadcn are already initialized, so agents and developers can add components without extra setup.",
  },
] as const;

export default function App() {
  return (
    <main>
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-10 sm:px-10">
        <div className="mb-10 flex-1">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-sm text-muted-foreground shadow-sm">
            <span className="h-2 w-2 rounded-full bg-primary" />
            ProofKit WebViewer Starter
          </div>

          <div className="mt-8 grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
            <section className="rounded-3xl border border-border bg-card/80 p-8 shadow-sm">
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
                React + TypeScript + Vite
              </p>
              <h1 className="mt-4 max-w-xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
                Build browser-safe FileMaker WebViewer apps without scaffolding against a hosted server.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
                This starter stays intentionally small, but it is already ready for Tailwind v4, shadcn component
                installs, hash-based TanStack Router navigation, React Query, and later ProofKit typegen output.
              </p>

              <div className="mt-8 flex flex-wrap gap-3 text-sm">
                <code className="rounded-full border border-border bg-background px-3 py-1.5">pnpm dev</code>
                <code className="rounded-full border border-border bg-background px-3 py-1.5">pnpm typegen</code>
                <code className="rounded-full border border-border bg-background px-3 py-1.5">pnpm launch-fm</code>
              </div>
            </section>

            <aside className="rounded-3xl border border-border bg-gradient-to-br from-card via-card to-muted/50 p-8 shadow-sm">
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">Starter notes</p>
              <div className="mt-5 space-y-4 text-sm text-muted-foreground">
                <p>Update the default WebViewer name in <code>src/App.tsx</code> to match your FileMaker layout object.</p>
                <p>When the app runs inside FileMaker, you can start using <code>fmFetch</code> or generated clients right away.</p>
                <p>The local helper scripts prefer FM HTTP connected files before falling back to hosted server env vars.</p>
              </div>
            </aside>
          </div>

          <section className="mt-8 grid gap-4 md:grid-cols-3">
            {steps.map((step) => (
              <article key={step.title} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                <step.icon className="h-5 w-5 text-primary" />
                <h2 className="mt-4 text-lg font-semibold">{step.title}</h2>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{step.body}</p>
              </article>
            ))}
          </section>
        </div>
      </div>
    </main>
  );
}
