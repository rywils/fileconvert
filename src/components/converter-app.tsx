"use client";

import { formatBytes } from "@/lib/format-bytes";
import {
  DEFAULT_OUTPUT_FORMAT,
  detectFormat,
  MAX_FILE_BYTES,
  outputFormatsForInput,
  type FormatDef,
} from "@/lib/formats";
import type { StoredFile } from "@/lib/session-store";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type QueuedFile = {
  file: File;
  relativePath: string;
  format?: FormatDef;
};

const OUTPUT_GROUPS: { label: string; ids: string[] }[] = [
  {
    label: "Images — WebP recommended",
    ids: ["webp", "jpg", "png", "avif", "gif", "tiff", "heic", "heif", "ico"],
  },
  { label: "Video", ids: ["mp4", "webm", "mov", "mkv", "avi", "wmv", "flv", "mpeg", "3gp", "gif"] },
  { label: "Audio", ids: ["mp3", "wav", "aac", "ogg", "flac", "m4a"] },
  {
    label: "Documents",
    ids: ["pdf", "docx", "txt", "html", "doc", "odt", "rtf", "pptx", "xlsx"],
  },
];

export function ConverterApp() {
  const fileRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const sessionRef = useRef<string | null>(null);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [outputFormat, setOutputFormat] = useState(DEFAULT_OUTPUT_FORMAT);
  const [quality, setQuality] = useState(85);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<StoredFile[] | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const initSession = useCallback(async () => {
    const res = await fetch("/api/session", { method: "POST" });
    if (!res.ok) throw new Error("Could not start session.");
    const data = (await res.json()) as { sessionId: string };
    sessionRef.current = data.sessionId;
    setSessionId(data.sessionId);
    return data.sessionId;
  }, []);

  const cleanup = useCallback((sid?: string | null) => {
    const id = sid ?? sessionRef.current;
    if (!id) return;
    const blob = new Blob([JSON.stringify({ sessionId: id })], {
      type: "application/json",
    });
    navigator.sendBeacon?.("/api/cleanup", blob);
  }, []);

  useEffect(() => {
    initSession().catch(() => setError("Failed to initialize. Refresh the page."));
    const onUnload = () => cleanup();
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [initSession, cleanup]);

  const addFiles = useCallback((list: FileList | File[], fromFolder = false) => {
    const arr = Array.from(list).filter((f) => {
      if (fromFolder && (f.name === ".DS_Store" || f.name.startsWith("."))) return false;
      return detectFormat(f.name, f.type) !== undefined;
    });

    if (arr.length === 0) {
      setError("No supported files found. Try images, video, audio, PDF, DOCX, or other listed formats.");
      return;
    }

    const oversized = arr.filter((f) => f.size > MAX_FILE_BYTES);
    if (oversized.length > 0) {
      setError(
        `${oversized.length} file(s) exceed the 4 MB per-file limit. Split the batch or resize first.`,
      );
      return;
    }

    setError(null);
    setResults(null);

    const queued: QueuedFile[] = arr.map((file) => ({
      file,
      relativePath:
        "webkitRelativePath" in file && file.webkitRelativePath
          ? file.webkitRelativePath
          : file.name,
      format: detectFormat(file.name, file.type),
    }));

    setQueue((prev) => [...prev, ...queued]);
  }, []);

  const compatibleOutputGroups = useMemo(() => {
    if (queue.length === 0) return OUTPUT_GROUPS;

    const union = new Set<string>();
    for (const q of queue) {
      if (!q.format) continue;
      for (const f of outputFormatsForInput(q.format)) {
        union.add(f.id);
      }
    }

    if (union.size === 0) return OUTPUT_GROUPS;

    return OUTPUT_GROUPS.map((g) => ({
      ...g,
      ids: g.ids.filter((id) => union.has(id)),
    })).filter((g) => g.ids.length > 0);
  }, [queue]);

  const showQuality =
    outputFormat === "webp" ||
    outputFormat === "jpg" ||
    outputFormat === "png" ||
    outputFormat === "avif" ||
    outputFormat === "heic" ||
    outputFormat === "heif";

  const convert = async () => {
    if (!queue.length) return;
    setLoading(true);
    setError(null);
    setResults(null);
    setProgress({ done: 0, total: queue.length });

    if (!sessionRef.current) await initSession();

    try {
      let latest: StoredFile[] = [];
      for (let i = 0; i < queue.length; i++) {
        const q = queue[i];
        const formData = new FormData();
        formData.append("files", q.file);
        formData.append("relativePaths", JSON.stringify([q.relativePath]));
        formData.append("outputFormat", outputFormat);
        formData.append("quality", String(quality));
        if (i > 0) formData.append("append", "true");

        const res = await fetch("/api/convert", { method: "POST", body: formData });
        const data = (await res.json()) as {
          results: StoredFile[];
          error?: string;
        };
        if (!res.ok) throw new Error(data.error ?? `Failed on ${q.relativePath}`);

        latest = data.results;
        setProgress({ done: i + 1, total: queue.length });
        setResults([...latest]);
      }

      if (latest.filter((r) => r.status === "ready").length === 0) {
        setError("All files failed. See errors below.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Conversion failed.");
    } finally {
      setLoading(false);
    }
  };

  const clearAll = async () => {
    cleanup();
    setQueue([]);
    setResults(null);
    setError(null);
    setProgress({ done: 0, total: 0 });
    await initSession();
  };

  const readyResults = results?.filter((r) => r.status === "ready") ?? [];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 pb-20">
      <header className="text-center">
        <p className="mb-2 text-sm font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
          Free · No account · No credits
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          File Converter
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-zinc-600 dark:text-zinc-400">
          Images (especially WebP), video, audio, PDF, DOCX, and more. Drop a folder, download a
          ZIP. Nothing is kept after you leave.
        </p>
      </header>

      <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
        <strong>We never store your files.</strong> Temp session storage only — wiped on refresh,
        download, or when you click Done. No conversion credits.
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
        }}
        className={`rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors ${
          dragOver
            ? "border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/30"
            : "border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/40"
        }`}
      >
        <p className="text-lg font-medium text-zinc-800 dark:text-zinc-200">
          Drop files or a folder here
        </p>
        <p className="mt-2 text-sm text-zinc-500">
          WebP · PNG · JPEG · MP4 · MP3 · PDF · DOCX · and dozens more — 4 MB per file
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-500"
          >
            Choose files
          </button>
          <button
            type="button"
            onClick={() => folderRef.current?.click()}
            className="rounded-lg border border-zinc-300 px-5 py-2.5 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-800"
          >
            Choose folder
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <input
          ref={folderRef}
          type="file"
          multiple
          className="hidden"
          {...({ webkitdirectory: "", directory: "" } as React.InputHTMLAttributes<HTMLInputElement>)}
          onChange={(e) => {
            if (e.target.files?.length) addFiles(e.target.files, true);
            e.target.value = "";
          }}
        />
      </div>

      {queue.length > 0 && (
        <section className="rounded-xl border border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <h2 className="font-medium">
              {queue.length} file{queue.length !== 1 ? "s" : ""} queued
            </h2>
            <button
              type="button"
              onClick={() => {
                setQueue([]);
                setResults(null);
              }}
              className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            >
              Clear queue
            </button>
          </div>
          <ul className="max-h-40 overflow-y-auto px-4 py-2 text-sm text-zinc-600 dark:text-zinc-400">
            {queue.slice(0, 8).map((q, i) => (
              <li key={`${q.relativePath}-${i}`} className="truncate py-0.5">
                {q.relativePath}
                {q.format && (
                  <span className="ml-2 text-zinc-400">({q.format.label})</span>
                )}
              </li>
            ))}
            {queue.length > 8 && (
              <li className="py-1 text-zinc-400">+ {queue.length - 8} more…</li>
            )}
          </ul>
        </section>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Convert to
          </label>
          <select
            value={outputFormat}
            onChange={(e) => setOutputFormat(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 dark:border-zinc-600 dark:bg-zinc-900"
          >
            {compatibleOutputGroups.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.ids.map((id) => (
                  <option key={id} value={id}>
                    {id.toUpperCase()}
                    {id === "webp" ? " ★" : ""}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        {showQuality ? (
          <div>
            <label className="mb-2 flex justify-between text-sm font-medium text-zinc-700 dark:text-zinc-300">
              <span>Quality (images)</span>
              <span className="tabular-nums text-zinc-500">{quality}</span>
            </label>
            <input
              type="range"
              min={1}
              max={100}
              value={quality}
              onChange={(e) => setQuality(Number(e.target.value))}
              className="mt-3 w-full accent-emerald-600"
            />
          </div>
        ) : (
          <div className="flex items-end pb-2 text-sm text-zinc-500">
            Quality slider applies to image outputs (WebP, JPEG, PNG, AVIF).
          </div>
        )}
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={convert}
        disabled={!queue.length || loading}
        className="h-12 rounded-xl bg-emerald-600 text-base font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading
          ? `Converting ${progress.done}/${progress.total}…`
          : `Convert ${queue.length || ""} file${queue.length !== 1 ? "s" : ""}`}
      </button>

      {results && (
        <section className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-medium">Results</h2>
            {readyResults.length > 0 && sessionId && (
              <div className="flex flex-wrap gap-2">
                <a
                  href={`/api/download/${sessionId}/zip`}
                  download="converted-files.zip"
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
                >
                  Download folder (.zip)
                </a>
                <button
                  type="button"
                  onClick={clearAll}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-600 dark:hover:bg-zinc-800"
                >
                  Done — delete my files
                </button>
              </div>
            )}
          </div>
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {results.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-zinc-900 dark:text-zinc-100">
                    {r.relativePath || r.originalName}
                  </p>
                  {r.status === "ready" ? (
                    <p className="text-zinc-500">
                      {formatBytes(r.originalBytes)} → {formatBytes(r.outputBytes)} ·{" "}
                      {r.inputFormat} → {r.outputFormat}
                    </p>
                  ) : (
                    <p className="text-red-600 dark:text-red-400">{r.error}</p>
                  )}
                </div>
                {r.status === "ready" && sessionId && (
                  <a
                    href={`/api/download/${sessionId}/${r.id}`}
                    download={r.outputName}
                    className="shrink-0 rounded-lg border border-zinc-300 px-3 py-1.5 font-medium hover:bg-zinc-50 dark:border-zinc-600 dark:hover:bg-zinc-800"
                  >
                    Download
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="text-center text-xs text-zinc-500">
        Temp storage only · Deleted when you leave · 4 MB per file · 100 files per session · WebP is
        the default image output
      </footer>
    </div>
  );
}
