/**
 * HANDOFF: Entry point. Admin (/admin) is lazy-loaded so public visitors never download it; keep it that way.
 * The public bundle still includes the tRPC/react-query client that no public page uses (NEXT-TASKS T9).
 */
import { trpc } from "@/lib/trpc";
import { COOKIE_NAME, UNAUTHED_ERR_MSG } from "@shared/const";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot, hydrateRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { startLogin } from "./const";
import type { PageData } from "../../shared/content";
import "./index.css";

declare global {
  interface Window {
    __SS_DATA__?: PageData;
  }
}

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");
const privateRoute = /^\/admin(?:\/|$)/.test(window.location.pathname);

if (privateRoute) {
  // Dashboard data is private and is intentionally never rendered into server HTML.
  // Mount it separately so no sensitive API payload can be included in the public shell.
  void import("./admin/AdminApp").then(({ AdminApp }) => {
    createRoot(root).render(<AdminApp />);
  });
} else {
  const queryClient = new QueryClient();

  const redirectToLoginIfUnauthorized = (error: unknown) => {
    if (!(error instanceof TRPCClientError)) return;
    if (error.message === UNAUTHED_ERR_MSG) startLogin();
  };

  queryClient.getQueryCache().subscribe(event => {
    if (event.type === "updated" && event.action.type === "error") {
      redirectToLoginIfUnauthorized(event.query.state.error);
    }
  });
  queryClient.getMutationCache().subscribe(event => {
    if (event.type === "updated" && event.action.type === "error") {
      redirectToLoginIfUnauthorized(event.mutation.state.error);
    }
  });

  const trpcClient = trpc.createClient({
    links: [
      httpBatchLink({
        url: "/api/trpc",
        transformer: superjson,
        headers() {
          // Cross-site Preview can block cookies. The runtime mirrors its own
          // session into sessionStorage for the existing bearer-token fallback.
          try {
            const raw = sessionStorage.getItem("app-session-token");
            const prefix = `${COOKIE_NAME}=`;
            const pair = raw
              ?.split(";")
              .find(value => value.trim().startsWith(prefix));
            const token = pair?.trim().slice(prefix.length);
            return token ? { Authorization: `Bearer ${token}` } : {};
          } catch {
            return {};
          }
        },
        fetch(input, init) {
          return globalThis.fetch(input, {
            ...(init ?? {}),
            credentials: "include",
          });
        },
      }),
    ],
  });

  hydrateRoot(
    root,
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <App data={window.__SS_DATA__ ?? {}} />
      </QueryClientProvider>
    </trpc.Provider>
  );
}
