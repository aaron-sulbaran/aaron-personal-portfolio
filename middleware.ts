import { NextResponse, type NextRequest } from "next/server";
import {
  RECRUITING_COOKIE,
  RECRUITING_COOKIE_MAX_AGE,
  keyMatches,
  signSession,
  verifySession,
} from "@/lib/recruiting/auth";

// /recruiting is private. Every request under it needs the signed session
// cookie; /recruiting/unlock?key=<RECRUITING_KEY> mints that cookie and
// bounces to the dashboard. Anything else (wrong key, no cookie, no key
// configured on the server) is rewritten to a path that does not exist so
// the visitor sees the site's ordinary 404 and learns nothing. The site-mode
// holding switch (lib/holding.ts) is never consulted here: the route is
// exempt by construction.
export async function middleware(request: NextRequest) {
  const secret = process.env.RECRUITING_KEY;
  const { pathname, searchParams } = request.nextUrl;

  if (pathname === "/recruiting/unlock") {
    if (!keyMatches(searchParams.get("key"), secret)) return hide(request);
    const response = NextResponse.redirect(new URL("/recruiting", request.url));
    response.cookies.set({
      name: RECRUITING_COOKIE,
      value: await signSession(secret as string),
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/recruiting",
      maxAge: RECRUITING_COOKIE_MAX_AGE,
    });
    return response;
  }

  const cookie = request.cookies.get(RECRUITING_COOKIE)?.value;
  if (await verifySession(cookie, secret)) return NextResponse.next();
  return hide(request);
}

function hide(request: NextRequest) {
  const url = new URL("/recruiting/__hidden", request.url);
  const response = NextResponse.rewrite(url, { status: 404 });
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export const config = {
  matcher: ["/recruiting", "/recruiting/:path*"],
};
