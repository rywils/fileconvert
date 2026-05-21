import { runConversion } from "@/lib/converters";
import {
  detectFormat,
  getFormat,
  MAX_FILE_BYTES,
  MAX_FILES_PER_SESSION,
  MAX_SESSION_BYTES,
  outputFormatsForInput,
} from "@/lib/formats";
import { SESSION_COOKIE } from "@/lib/session-cookie";
import {
  inputPath,
  outputPath,
  readMeta,
  sessionTotalBytes,
  writeMeta,
  type StoredFile,
} from "@/lib/session-store";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import fs from "fs/promises";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const jar = await cookies();
    const sessionId = jar.get(SESSION_COOKIE)?.value;
    if (!sessionId) {
      return NextResponse.json({ error: "No session. Refresh the page." }, { status: 401 });
    }

    const meta = await readMeta(sessionId);
    if (!meta) {
      return NextResponse.json({ error: "Session expired. Refresh the page." }, { status: 401 });
    }

    const formData = await request.formData();
    const outputFormatId = String(formData.get("outputFormat") ?? "").toLowerCase();
    const qualityRaw = formData.get("quality");
    const quality = qualityRaw
      ? Math.min(100, Math.max(1, Number(qualityRaw)))
      : 85;

    const outputFormat = getFormat(outputFormatId);
    if (!outputFormat) {
      return NextResponse.json({ error: "Invalid output format." }, { status: 400 });
    }

    const entries = formData.getAll("files");
    const files = entries.filter((e): e is File => e instanceof File);

    let relativePaths: string[] = [];
    const pathsRaw = formData.get("relativePaths");
    if (typeof pathsRaw === "string") {
      try {
        relativePaths = JSON.parse(pathsRaw) as string[];
      } catch {
        relativePaths = [];
      }
    }

    if (files.length === 0) {
      return NextResponse.json({ error: "No files uploaded." }, { status: 400 });
    }
    const append = formData.get("append") === "true";

    if (!append && files.length > 1) {
      return NextResponse.json(
        { error: "Upload one file per request (required for Vercel)." },
        { status: 400 },
      );
    }

    if (meta.files.length + files.length > MAX_FILES_PER_SESSION) {
      return NextResponse.json(
        { error: `Maximum ${MAX_FILES_PER_SESSION} files per session.` },
        { status: 400 },
      );
    }

    let sessionBytes = await sessionTotalBytes(sessionId);
    const results: StoredFile[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileId = randomUUID();
      const relPath = relativePaths[i] || file.name;
      const detected = detectFormat(file.name, file.type);

      if (!detected) {
        results.push({
          id: fileId,
          originalName: file.name,
          relativePath: relPath,
          outputName: "",
          inputFormat: "unknown",
          outputFormat: outputFormatId,
          originalBytes: file.size,
          outputBytes: 0,
          status: "error",
          error: "Unrecognized file type.",
        });
        continue;
      }

      const allowed = outputFormatsForInput(detected).some((f) => f.id === outputFormatId);
      if (!allowed) {
        results.push({
          id: fileId,
          originalName: file.name,
          relativePath: relPath,
          outputName: "",
          inputFormat: detected.id,
          outputFormat: outputFormatId,
          originalBytes: file.size,
          outputBytes: 0,
          status: "error",
          error: `Cannot convert ${detected.label} to ${outputFormat.label}.`,
        });
        continue;
      }

      if (file.size > MAX_FILE_BYTES) {
        results.push({
          id: fileId,
          originalName: file.name,
          relativePath: relPath,
          outputName: "",
          inputFormat: detected.id,
          outputFormat: outputFormatId,
          originalBytes: file.size,
          outputBytes: 0,
          status: "error",
          error: "File exceeds 4 MB limit (Vercel).",
        });
        continue;
      }

      sessionBytes += file.size;
      if (sessionBytes > MAX_SESSION_BYTES) {
        results.push({
          id: fileId,
          originalName: file.name,
          relativePath: relPath,
          outputName: "",
          inputFormat: detected.id,
          outputFormat: outputFormatId,
          originalBytes: file.size,
          outputBytes: 0,
          status: "error",
          error: "Session storage limit reached (1 GB). Download or refresh to clear.",
        });
        continue;
      }

      const inExt = detected.extensions[0];
      const inFile = inputPath(sessionId, fileId, inExt);
      const buffer = Buffer.from(await file.arrayBuffer());
      await fs.writeFile(inFile, buffer);

      const baseName = file.name.replace(/\.[^.]+$/, "") || "file";
      const outName = `${baseName}.${outputFormat.extensions[0]}`;
      const relOut = relPath.includes("/")
        ? relPath.replace(/\.[^.]+$/, `.${outputFormat.extensions[0]}`)
        : outName;
      const outFile = outputPath(sessionId, fileId, outputFormat.extensions[0]);

      try {
        const { outputBytes } = await runConversion(inFile, outFile, outputFormatId, {
          quality,
        });
        sessionBytes += outputBytes;
        results.push({
          id: fileId,
          originalName: file.name,
          outputName: outName,
          relativePath: relOut,
          inputFormat: detected.id,
          outputFormat: outputFormatId,
          originalBytes: file.size,
          outputBytes,
          status: "ready",
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Conversion failed.";
        results.push({
          id: fileId,
          originalName: file.name,
          relativePath: relPath,
          outputName: "",
          inputFormat: detected.id,
          outputFormat: outputFormatId,
          originalBytes: file.size,
          outputBytes: 0,
          status: "error",
          error: message,
        });
      }
    }

    meta.files = append ? [...meta.files, ...results] : results;
    await writeMeta(meta);

    const all = meta.files;
    const ready = all.filter((r) => r.status === "ready");
    const failed = all.filter((r) => r.status === "error");

    return NextResponse.json({
      sessionId,
      results: all,
      batch: results,
      summary: {
        total: all.length,
        ready: ready.length,
        failed: failed.length,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Conversion failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
