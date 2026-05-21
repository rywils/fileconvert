import type { FormatDef } from "@/lib/formats";
import { runFfmpeg } from "@/lib/converters/ffmpeg-runner";
import fs from "fs/promises";

const VIDEO_CODECS: Record<string, { vcodec?: string; acodec?: string; extra?: string[] }> = {
  mp4: { vcodec: "libx264", acodec: "aac", extra: ["-movflags", "+faststart"] },
  webm: { vcodec: "libvpx-vp9", acodec: "libopus" },
  mov: { vcodec: "libx264", acodec: "aac" },
  mkv: { vcodec: "libx264", acodec: "aac" },
  avi: { vcodec: "libx264", acodec: "mp3" },
  wmv: { vcodec: "wmv2", acodec: "wmav2" },
  flv: { vcodec: "libx264", acodec: "aac" },
  mpeg: { vcodec: "mpeg2video", acodec: "mp2" },
  "3gp": { vcodec: "h264", acodec: "aac" },
  gif: { extra: ["-vf", "fps=10,scale=480:-1:flags=lanczos"] },
};

const AUDIO_CODECS: Record<string, string> = {
  mp3: "libmp3lame",
  wav: "pcm_s16le",
  aac: "aac",
  ogg: "libvorbis",
  flac: "flac",
  m4a: "aac",
};

export async function convertMedia(
  inputPath: string,
  outputPath: string,
  outputFormat: FormatDef,
): Promise<void> {
  const args: string[] = ["-i", inputPath];

  if (outputFormat.category === "audio") {
    const acodec = AUDIO_CODECS[outputFormat.id];
    if (!acodec) throw new Error(`Unsupported audio output: ${outputFormat.label}`);
    args.push("-vn", "-acodec", acodec, outputPath);
    await runFfmpeg(args);
    return;
  }

  if (outputFormat.id === "gif") {
    args.push(...(VIDEO_CODECS.gif.extra ?? []), outputPath);
    await runFfmpeg(args);
    return;
  }

  const cfg = VIDEO_CODECS[outputFormat.id];
  if (!cfg?.vcodec) throw new Error(`Unsupported video output: ${outputFormat.label}`);

  args.push("-c:v", cfg.vcodec);
  if (cfg.acodec) args.push("-c:a", cfg.acodec);
  if (cfg.extra) args.push(...cfg.extra);
  args.push(outputPath);

  await runFfmpeg(args);
  await fs.access(outputPath);
}
