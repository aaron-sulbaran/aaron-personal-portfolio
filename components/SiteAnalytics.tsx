"use client";

import { track } from "@vercel/analytics";
import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";
import { allowAnalyticsEvent } from "@/lib/analytics";
import { createClientErrorReporter } from "@/lib/clientErrors";

function beforeSend(event: BeforeSendEvent): BeforeSendEvent | null {
  return allowAnalyticsEvent(event.url) ? event : null;
}

// The one place the vendor package is imported, so the error reports go
// through the same beforeSend as the page views.
export const reportClientError = createClientErrorReporter({
  send: (name, properties) => track(name, properties),
  pathname: () => window.location.pathname,
});

export function SiteAnalytics() {
  return <Analytics beforeSend={beforeSend} />;
}
