import { SESSION_TTL_MS } from "@/lib/formats";
import fs from "fs/promises";
import path from "path";
import os from "os";

const ROOT = path.join(os.tmpdir(), "file-converter-sessions");

export type StoredFile = {
  id: string;
  originalName: string;
  outputName: string;
  relativePath?: string;
  inputFormat: string;
  outputFormat: string;
  originalBytes: number;
  outputBytes: number;
  status: "ready" | "error";
  error?: string;
};

export type SessionMeta = {
  id: string;
  createdAt: number;
  lastAccessedAt: number;
  files: StoredFile[];
};

function sessionDir(id: string) {
  return path.join(ROOT, id);
}

export async function ensureRoot() {
  await fs.mkdir(ROOT, { recursive: true });
}

export async function createSession(id: string): Promise<SessionMeta> {
  await ensureRoot();
  const dir = sessionDir(id);
  await fs.mkdir(dir, { recursive: true });
  const meta: SessionMeta = {
    id,
    createdAt: Date.now(),
    lastAccessedAt: Date.now(),
    files: [],
  };
  await writeMeta(meta);
  return meta;
}

function metaPath(id: string) {
  return path.join(sessionDir(id), "meta.json");
}

export async function readMeta(id: string): Promise<SessionMeta | null> {
  try {
    const raw = await fs.readFile(metaPath(id), "utf8");
    return JSON.parse(raw) as SessionMeta;
  } catch {
    return null;
  }
}

export async function writeMeta(meta: SessionMeta) {
  meta.lastAccessedAt = Date.now();
  await fs.mkdir(sessionDir(meta.id), { recursive: true });
  await fs.writeFile(metaPath(meta.id), JSON.stringify(meta, null, 2));
}

export function inputPath(sessionId: string, fileId: string, ext: string) {
  return path.join(sessionDir(sessionId), `in-${fileId}.${ext}`);
}

export function outputPath(sessionId: string, fileId: string, ext: string) {
  return path.join(sessionDir(sessionId), `out-${fileId}.${ext}`);
}

export async function deleteSession(id: string) {
  try {
    await fs.rm(sessionDir(id), { recursive: true, force: true });
  } catch {
    // already gone
  }
}

export async function purgeExpiredSessions() {
  await ensureRoot();
  const entries = await fs.readdir(ROOT, { withFileTypes: true });
  const now = Date.now();
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const meta = await readMeta(entry.name);
    if (!meta) {
      await deleteSession(entry.name);
      continue;
    }
    if (now - meta.lastAccessedAt > SESSION_TTL_MS) {
      await deleteSession(entry.name);
    }
  }
}

export async function sessionTotalBytes(id: string): Promise<number> {
  const dir = sessionDir(id);
  try {
    const names = await fs.readdir(dir);
    let total = 0;
    for (const name of names) {
      const stat = await fs.stat(path.join(dir, name));
      if (stat.isFile()) total += stat.size;
    }
    return total;
  } catch {
    return 0;
  }
}
