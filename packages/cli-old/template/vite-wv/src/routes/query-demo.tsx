import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

const getConnectionHint = async (): Promise<string> => {
  await new Promise((resolve) => setTimeout(resolve, 180));
  return "Use fmFetch or generated clients once your FileMaker file is ready.";
};

export function QueryDemoPage() {
  const hintQuery = useQuery({
    queryKey: ["starter-connection-hint"],
    queryFn: getConnectionHint,
  });

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10 sm:px-10">
      <section className="rounded-3xl border border-border bg-card p-8 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">React Query ready</p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">TanStack Query is preconfigured</h1>
        <p className="mt-4 text-muted-foreground">
          This route is rendered by TanStack Router using hash history, which is recommended for FileMaker WebViewer
          apps.
        </p>

        <div className="mt-6 rounded-xl border border-border bg-background p-4 text-sm">
          {hintQuery.isLoading ? "Loading starter data..." : hintQuery.data}
        </div>

        <div className="mt-6">
          <Link className="inline-flex rounded-full border border-border bg-card px-4 py-2 text-sm font-medium" to="/">
            Back to starter
          </Link>
        </div>
      </section>
    </main>
  );
}
