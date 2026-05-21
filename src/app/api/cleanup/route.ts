import { deleteSession, purgeExpiredSessions } from "@/lib/session-store";
import { SESSION_COOKIE } from "@/lib/session-cookie";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  await purgeExpiredSessions();

  let sessionId: string | undefined;

  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      const body = (await request.json()) as { sessionId?: string };
      sessionId = body.sessionId;
    } catch {
      // ignore
    }
  }

  if (!sessionId) {
    const jar = await cookies();
    sessionId = jar.get(SESSION_COOKIE)?.value;
  }

  if (sessionId) {
    await deleteSession(sessionId);
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
    path: "/",
  });
  return res;
}
