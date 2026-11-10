"use client";

import { useEffect } from "react";
import { reportClientError } from "@/components/SiteAnalytics";
import { windowErrorValue } from "@/lib/clientErrors";

// Errors no boundary sees: a handler, a timer, a rejected promise.
export function ClientErrorListener() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      const value = windowErrorValue(event);
      if (value !== null) reportClientError("window", value);
    };
    const onRejection = (event: PromiseRejectionEvent) => reportClientError("unhandledrejection", event.reason);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
