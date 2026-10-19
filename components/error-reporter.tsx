"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/report-error";

/** Reports errors no error boundary catches: event handlers, timers, promises. */
export function ErrorReporter() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => reportClientError(event.error ?? event.message, "window");
    const onRejection = (event: PromiseRejectionEvent) => reportClientError(event.reason, "promise");
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
