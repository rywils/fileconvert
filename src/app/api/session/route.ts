import { purgeExpiredSessions, createSession, readMeta } from "@/lib/session-store";
import { SESSION_COOKIE } from "@/lib/session-cookie";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

export async function POST() {
  await purgeExpiredSessions();

  const jar = await cookies();
  const existing = jar.get(SESSION_COOKIE)?.value;
  if (existing) {
    const meta = await readMeta(existing);
    if (meta) {
      return NextResponse.json({ sessionId: existing });
    }
  }

  const sessionId = randomUUID();
  await createSession(sessionId);

  const res = NextResponse.json({ sessionId });
  res.cookies.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 30,
    path: "/",
  });
  return res;
}
