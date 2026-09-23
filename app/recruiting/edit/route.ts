import { revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { RECRUITING_COOKIE, verifySession } from "@/lib/recruiting/auth";
import { ledgerEditSchema } from "@/lib/recruiting/edits";
import { FEED_TAG, fileEdit } from "@/lib/recruiting/vault-issues";

// POST /recruiting/edit: file one dashboard edit as a vault issue. middleware.ts
// already gates this path on the session cookie; the check is repeated here so
// the handler is safe on its own, and a cross-origin post is refused.

const requestSchema = z.object({
  edit: ledgerEditSchema,
  company: z.string().trim().min(1).max(120),
});

function notFound() {
  return new NextResponse(null, { status: 404 });
}

export async function POST(request: NextRequest) {
  const secret = process.env.RECRUITING_KEY;
  if (!(await verifySession(request.cookies.get(RECRUITING_COOKIE)?.value, secret))) return notFound();
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return notFound();

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.issues[0]?.message ?? "Invalid edit" }, { status: 400 });
  }

  const result = await fileEdit(parsed.data.edit, parsed.data.company);
  if (result.error !== null) return NextResponse.json(result, { status: 502 });
  revalidateTag(FEED_TAG);
  return NextResponse.json(result);
}
