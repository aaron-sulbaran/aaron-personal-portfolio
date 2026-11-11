// The month this build shipped, in Austin time ("September 2026"), from the
// timestamp next.config.mjs inlines at build (SITE_BUILT_AT). Falls back to
// now when the variable is missing (tests, a bare import).
export function lastUpdatedMonth(builtAt: string | undefined = process.env.SITE_BUILT_AT) {
  const date = builtAt ? new Date(builtAt) : new Date();
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "America/Chicago" }).format(date);
}

// The same build timestamp as a Date, for the sitemap's lastModified.
export function builtAtDate(builtAt: string | undefined = process.env.SITE_BUILT_AT): Date {
  return builtAt ? new Date(builtAt) : new Date();
}
