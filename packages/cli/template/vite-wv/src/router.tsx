import {
  Link,
  Outlet,
  createHashHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";

import App from "./app";
import { QueryDemoPage } from "./routes/query-demo";

const RootLayout = () => (
  <div className="min-h-screen bg-background text-foreground">
    <header className="border-b border-border bg-card/80">
      <nav className="mx-auto flex w-full max-w-5xl items-center gap-4 px-6 py-3 sm:px-10">
        <Link
          className="[&.active]:text-primary text-sm font-medium text-muted-foreground"
          to="/"
        >
          Starter
        </Link>
        <Link
          className="[&.active]:text-primary text-sm font-medium text-muted-foreground"
          to="/query"
        >
          Query Demo
        </Link>
      </nav>
    </header>
    <Outlet />
  </div>
);

const rootRoute = createRootRoute({
  component: RootLayout,
});

const indexRoute = createRoute({
  component: App,
  getParentRoute: () => rootRoute,
  path: "/",
});

const queryDemoRoute = createRoute({
  component: QueryDemoPage,
  getParentRoute: () => rootRoute,
  path: "/query",
});

const routeTree = rootRoute.addChildren([indexRoute, queryDemoRoute]);

export const router = createRouter({
  history: createHashHistory(),
  routeTree,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
