import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import React from "react";
import ReactDOM from "react-dom/client";

import "./index.css";
import { createAppRouter } from "./router";

const queryClient = new QueryClient();
const routerPromise = createAppRouter(queryClient);

const BootstrapPending = () => (
	<main className="flex min-h-screen items-center justify-center">
		<div className="h-16 w-16 animate-spin rounded-full border-6 border-muted border-t-primary" />
	</main>
);

const AppRouter = () => {
	const router = React.use(routerPromise);

	return <RouterProvider router={router} />;
};

const rootElement = document.querySelector("#root");
if (!rootElement) {
	throw new Error("Root element with id 'root' not found");
}

ReactDOM.createRoot(rootElement).render(
	<React.StrictMode>
		<QueryClientProvider client={queryClient}>
			<React.Suspense fallback={<BootstrapPending />}>
				<AppRouter />
			</React.Suspense>
		</QueryClientProvider>
	</React.StrictMode>,
);
