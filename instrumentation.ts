import type { Instrumentation } from "next";

// Server errors (rendering, server actions, route handlers, proxy), as one
// JSON line in the runtime logs: on Vercel, Observability > Logs, filter on
// "server-error". The digest matches the code shown on the error page.
export const onRequestError: Instrumentation.onRequestError = (error, request, context) => {
  const err = error instanceof Error ? error : null;
  console.error(
    JSON.stringify({
      type: "server-error",
      message: err?.message ?? String(error),
      digest: typeof error === "object" && error !== null && "digest" in error ? String(error.digest) : undefined,
      stack: err?.stack?.slice(0, 2000),
      method: request.method,
      path: request.path,
      routePath: context.routePath,
      routeType: context.routeType,
    }),
  );
};
