"use client";

import { inject, track } from "@vercel/analytics";
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

// global-error replaces the root layout, so <Analytics> never mounts there and
// window.va would not exist for track(). inject() is idempotent: it creates the
// queue, registers beforeSend and skips the script tag if one is already present.
export const ensureAnalytics = () => inject({ debug: false, beforeSend });

export function SiteAnalytics() {
  return <Analytics beforeSend={beforeSend} />;
}
