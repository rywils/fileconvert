import { getFormat } from "@/lib/formats";
import { readMeta } from "@/lib/session-store";
import { outputPath } from "@/lib/session-store";
import fs from "fs/promises";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  mp4: "video/mp4",
  webm: "video/webm",
  mp3: "audio/mpeg",
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string; fileId: string }> },
) {
  const { sessionId, fileId } = await params;
  const meta = await readMeta(sessionId);
  if (!meta) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  const file = meta.files.find((f) => f.id === fileId && f.status === "ready");
  if (!file) {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }

  const fmt = getFormat(file.outputFormat);
  const ext = fmt?.extensions[0] ?? file.outputFormat;
  const path = outputPath(sessionId, fileId, ext);

  try {
    const data = await fs.readFile(path);
    return new NextResponse(data, {
      headers: {
        "Content-Type": MIME[ext] ?? "application/octet-stream",
        "Content-Disposition": `attachment; filename="${file.outputName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Output file missing." }, { status: 404 });
  }
}
