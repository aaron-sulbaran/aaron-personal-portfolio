// Vercel Web Analytics shares the root layout, so any route listed in
// PRIVATE_ROUTES would otherwise show up in the public numbers. beforeSend
// drops those views. The list is empty today.
const PRIVATE_ROUTES: readonly string[] = [];

export function allowAnalyticsEvent(url: string, privateRoutes: readonly string[] = PRIVATE_ROUTES): boolean {
  let path: string;
  try {
    path = new URL(url, "http://localhost").pathname;
  } catch {
    return true;
  }
  return !privateRoutes.some((route) => path === route || path.startsWith(`${route}/`));
}
