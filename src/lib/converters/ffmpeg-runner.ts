import { spawn } from "child_process";
import ffmpegPath from "ffmpeg-static";

function resolveFfmpeg(): string {
  if (ffmpegPath) return ffmpegPath;
  return "ffmpeg";
}

export function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(resolveFfmpeg(), ["-y", "-hide_banner", "-loglevel", "error", ...args]);
    let stderr = "";
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `ffmpeg exited with code ${code}`));
    });
  });
}
