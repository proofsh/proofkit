import { fmFetch } from "@proofkit/webviewer";
import type { QueryClient } from "@tanstack/react-query";
import {
	createHashHistory,
	createRootRouteWithContext,
	createRoute,
	createRouter,
	Link,
	Outlet,
} from "@tanstack/react-router";
import { z } from "zod/v4";

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

// INITIAL PROPS PATTERN //
// If you want to use the inital props pattern, set the variable below with the name of your script that gets your app's initial props
const initialPropsSchema = z.object({
	initialRoute: z.string().optional(),
});
const getInitialPropsScriptName = ""
////////////////////////////

type RouterContext = {
	queryClient: QueryClient;
	initialProps?: z.infer<typeof initialPropsSchema>;
};

const rootRoute = createRootRouteWithContext<RouterContext>()({
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

export const createAppRouter = async (queryClient: QueryClient) => {
  let initialProps: z.infer<typeof initialPropsSchema> | undefined;

  if (getInitialPropsScriptName) {
    console.log("[router:init] fetching initial props");
    const result = await fmFetch(getInitialPropsScriptName, {});
    const parsedInitialProps = initialPropsSchema.safeParse(result);
    if (!parsedInitialProps.success) {
      console.error("[router:init] invalid initial props", {
        error: parsedInitialProps.error,
        result,
      });
      throw parsedInitialProps.error;
    }
    initialProps = parsedInitialProps.data;
  }

  const initialRoute = initialProps?.initialRoute;
  if (initialRoute && !window.location.hash) {
  console.log("[router:init] initial route", {
    currentHash: window.location.hash,
    initialRoute,
    willSetHash: Boolean(initialRoute && !window.location.hash),
  });
    window.location.hash = initialRoute;
  }

  return createRouter({
    context: { queryClient, initialProps },
    history: createHashHistory(),
    routeTree,
  });
};

declare module "@tanstack/react-router" {
	interface Register {
		router: Awaited<ReturnType<typeof createAppRouter>>;
	}
}
