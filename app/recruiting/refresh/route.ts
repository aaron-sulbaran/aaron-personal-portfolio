import { revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { RECRUITING_COOKIE, verifySession } from "@/lib/recruiting/auth";
import { refreshState, requestRefresh } from "@/lib/recruiting/refresh";
import { FEED_TAG } from "@/lib/recruiting/vault-issues";

// POST /recruiting/refresh files (or reuses) a refresh request for the Mac.
// GET /recruiting/refresh?number=N reports its progress; once it is closed the
// feed cache is dropped so the next render reads the fresh export. Gated like
// /recruiting/edit: middleware checks the cookie, and so does this handler.

function notFound() {
  return new NextResponse(null, { status: 404 });
}

async function allowed(request: NextRequest): Promise<boolean> {
  if (!(await verifySession(request.cookies.get(RECRUITING_COOKIE)?.value, process.env.RECRUITING_KEY))) return false;
  const origin = request.headers.get("origin");
  return !origin || origin === request.nextUrl.origin;
}

export async function POST(request: NextRequest) {
  if (!(await allowed(request))) return notFound();
  const result = await requestRefresh();
  return NextResponse.json(result, { status: result.error === null ? 200 : 502 });
}

export async function GET(request: NextRequest) {
  if (!(await allowed(request))) return notFound();
  const number = Number(request.nextUrl.searchParams.get("number"));
  if (!Number.isInteger(number) || number <= 0) {
    return NextResponse.json({ data: null, error: "number is required" }, { status: 400 });
  }
  const result = await refreshState(number);
  if (result.error === null && !result.data.open) revalidateTag(FEED_TAG);
  return NextResponse.json(result, { status: result.error === null ? 200 : 502 });
}
