"use client";

import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";
import { allowAnalyticsEvent } from "@/lib/analytics";

function beforeSend(event: BeforeSendEvent): BeforeSendEvent | null {
  return allowAnalyticsEvent(event.url) ? event : null;
}

export function SiteAnalytics() {
  return <Analytics beforeSend={beforeSend} />;
}
