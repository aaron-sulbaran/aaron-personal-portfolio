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
//
// A first-render crash reports before <Analytics> has run its effects, so window.va does not exist
// yet and track() would drop the event after the reporter spent its budget. The queue is made the
// way the vendor's initQueue makes it, with the filter first, and <Analytics> drains it on mount.
// inject() is not called here: it would add the script with default settings, and <Analytics>
// would then skip its own, which carries the framework settings and sends page views itself.
export const reportClientError = createClientErrorReporter({
  send: (name, properties) => {
    if (!window.va) {
      window.va = function va(...params: unknown[]) {
        if (!window.vaq) window.vaq = [];
        window.vaq.push(params as [string, unknown?]);
      };
      window.va("beforeSend", beforeSend);
    }
    track(name, properties);
  },
  pathname: () => window.location.pathname,
});

// global-error replaces the root layout, so <Analytics> never mounts there and
// window.va would not exist for track(). inject() is idempotent: it creates the
// queue, registers beforeSend and skips the script tag if one is already present.
export const ensureAnalytics = () => inject({ debug: false, beforeSend });

export function SiteAnalytics() {
  return <Analytics beforeSend={beforeSend} />;
}
