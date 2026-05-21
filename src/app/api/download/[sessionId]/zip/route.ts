import { getFormat } from "@/lib/formats";
import { outputPath, readMeta } from "@/lib/session-store";
import fs from "fs/promises";
import JSZip from "jszip";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;
  const meta = await readMeta(sessionId);
  if (!meta) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  const ready = meta.files.filter((f) => f.status === "ready");
  if (ready.length === 0) {
    return NextResponse.json({ error: "No converted files to download." }, { status: 400 });
  }

  const zip = new JSZip();
  const usedNames = new Set<string>();

  for (const file of ready) {
    const fmt = getFormat(file.outputFormat);
    const ext = fmt?.extensions[0] ?? file.outputFormat;
    const filePath = outputPath(sessionId, file.id, ext);

    try {
      const data = await fs.readFile(filePath);
      let name = file.relativePath || file.outputName;
      let n = 1;
      while (usedNames.has(name)) {
        const stem = name.replace(/\.[^.]+$/, "");
        const e = name.split(".").pop();
        name = `${stem}-${n}.${e}`;
        n++;
      }
      usedNames.add(name);
      zip.file(name, data);
    } catch {
      // skip missing outputs
    }
  }

  const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="converted-files.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
