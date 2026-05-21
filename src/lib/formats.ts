export type FormatCategory = "image" | "video" | "audio" | "document";

export type FormatDef = {
  id: string;
  label: string;
  category: FormatCategory;
  extensions: string[];
  mimeTypes: string[];
};

export const FORMATS: FormatDef[] = [
  { id: "jpg", label: "JPEG", category: "image", extensions: ["jpg", "jpeg"], mimeTypes: ["image/jpeg"] },
  { id: "png", label: "PNG", category: "image", extensions: ["png"], mimeTypes: ["image/png"] },
  { id: "webp", label: "WebP", category: "image", extensions: ["webp"], mimeTypes: ["image/webp"] },
  { id: "avif", label: "AVIF", category: "image", extensions: ["avif"], mimeTypes: ["image/avif"] },
  { id: "gif", label: "GIF", category: "image", extensions: ["gif"], mimeTypes: ["image/gif"] },
  { id: "tiff", label: "TIFF", category: "image", extensions: ["tiff", "tif"], mimeTypes: ["image/tiff"] },
  { id: "bmp", label: "BMP", category: "image", extensions: ["bmp"], mimeTypes: ["image/bmp", "image/x-ms-bmp"] },
  { id: "heic", label: "HEIC", category: "image", extensions: ["heic"], mimeTypes: ["image/heic"] },
  { id: "heif", label: "HEIF", category: "image", extensions: ["heif"], mimeTypes: ["image/heif"] },
  { id: "ico", label: "ICO", category: "image", extensions: ["ico"], mimeTypes: ["image/x-icon", "image/vnd.microsoft.icon"] },
  { id: "svg", label: "SVG", category: "image", extensions: ["svg"], mimeTypes: ["image/svg+xml"] },
  { id: "mp4", label: "MP4", category: "video", extensions: ["mp4", "m4v"], mimeTypes: ["video/mp4", "video/x-m4v"] },
  { id: "webm", label: "WebM", category: "video", extensions: ["webm"], mimeTypes: ["video/webm"] },
  { id: "mov", label: "MOV", category: "video", extensions: ["mov"], mimeTypes: ["video/quicktime"] },
  { id: "mkv", label: "MKV", category: "video", extensions: ["mkv"], mimeTypes: ["video/x-matroska"] },
  { id: "avi", label: "AVI", category: "video", extensions: ["avi"], mimeTypes: ["video/x-msvideo", "video/avi"] },
  { id: "wmv", label: "WMV", category: "video", extensions: ["wmv"], mimeTypes: ["video/x-ms-wmv"] },
  { id: "flv", label: "FLV", category: "video", extensions: ["flv"], mimeTypes: ["video/x-flv"] },
  { id: "mpeg", label: "MPEG", category: "video", extensions: ["mpeg", "mpg"], mimeTypes: ["video/mpeg"] },
  { id: "3gp", label: "3GP", category: "video", extensions: ["3gp"], mimeTypes: ["video/3gpp"] },
  { id: "mp3", label: "MP3", category: "audio", extensions: ["mp3"], mimeTypes: ["audio/mpeg", "audio/mp3"] },
  { id: "wav", label: "WAV", category: "audio", extensions: ["wav"], mimeTypes: ["audio/wav", "audio/wave", "audio/x-wav"] },
  { id: "aac", label: "AAC", category: "audio", extensions: ["aac"], mimeTypes: ["audio/aac"] },
  { id: "ogg", label: "OGG", category: "audio", extensions: ["ogg", "oga"], mimeTypes: ["audio/ogg"] },
  { id: "flac", label: "FLAC", category: "audio", extensions: ["flac"], mimeTypes: ["audio/flac"] },
  { id: "m4a", label: "M4A", category: "audio", extensions: ["m4a"], mimeTypes: ["audio/mp4", "audio/x-m4a"] },
  { id: "pdf", label: "PDF", category: "document", extensions: ["pdf"], mimeTypes: ["application/pdf"] },
  { id: "docx", label: "DOCX", category: "document", extensions: ["docx"], mimeTypes: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"] },
  { id: "doc", label: "DOC", category: "document", extensions: ["doc"], mimeTypes: ["application/msword"] },
  { id: "odt", label: "ODT", category: "document", extensions: ["odt"], mimeTypes: ["application/vnd.oasis.opendocument.text"] },
  { id: "rtf", label: "RTF", category: "document", extensions: ["rtf"], mimeTypes: ["application/rtf", "text/rtf"] },
  { id: "txt", label: "TXT", category: "document", extensions: ["txt"], mimeTypes: ["text/plain"] },
  { id: "html", label: "HTML", category: "document", extensions: ["html", "htm"], mimeTypes: ["text/html"] },
  { id: "pptx", label: "PPTX", category: "document", extensions: ["pptx"], mimeTypes: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"] },
  { id: "xlsx", label: "XLSX", category: "document", extensions: ["xlsx"], mimeTypes: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"] },
];

const byId = new Map(FORMATS.map((f) => [f.id, f]));

/** Default output — WebP is the priority format. */
export const DEFAULT_OUTPUT_FORMAT = "webp";

export function getFormat(id: string): FormatDef | undefined {
  return byId.get(id.toLowerCase());
}

export function extensionOf(filename: string): string {
  const parts = filename.split(".");
  return parts.length > 1 ? (parts.pop()?.toLowerCase() ?? "") : "";
}

export function detectFormat(filename: string, mimeType?: string): FormatDef | undefined {
  const ext = extensionOf(filename);
  if (ext) {
    const match = FORMATS.find((f) => f.extensions.includes(ext));
    if (match) return match;
  }
  if (mimeType) {
    const match = FORMATS.find((f) => f.mimeTypes.includes(mimeType));
    if (match) return match;
  }
  return undefined;
}

export function formatsByCategory(category: FormatCategory): FormatDef[] {
  return FORMATS.filter((f) => f.category === category);
}

/** Sharp cannot encode BMP on Vercel; BMP is input-only. */
const IMAGE_OUTPUT_EXCLUDE = new Set(["bmp"]);

export function outputFormatsForInput(input: FormatDef): FormatDef[] {
  const { category } = input;
  if (category === "image") {
    return formatsByCategory("image").filter(
      (f) =>
        !IMAGE_OUTPUT_EXCLUDE.has(f.id) &&
        (f.id !== input.id || input.id === "svg"),
    );
  }
  if (category === "video") {
    return [...formatsByCategory("video"), ...formatsByCategory("audio")].filter(
      (f) => f.id !== input.id,
    );
  }
  if (category === "audio") {
    return formatsByCategory("audio").filter((f) => f.id !== input.id);
  }
  return formatsByCategory("document").filter((f) => f.id !== input.id);
}

export function canConvert(input: FormatDef, outputId: string): boolean {
  const output = getFormat(outputId);
  if (!output) return false;
  if (input.category === "image" && output.category === "image") return true;
  if (input.category === "video" && (output.category === "video" || output.category === "audio"))
    return true;
  if (input.category === "audio" && output.category === "audio") return true;
  if (input.category === "document" && output.category === "document") return true;
  return false;
}

/** All output format ids, WebP first. */
export function allOutputFormatIds(): string[] {
  const ids = FORMATS.map((f) => f.id);
  return ["webp", ...ids.filter((id) => id !== "webp")];
}

export const MAX_FILE_BYTES = 4 * 1024 * 1024;
export const MAX_SESSION_BYTES = 400 * 1024 * 1024;
export const MAX_FILES_PER_SESSION = 100;
export const SESSION_TTL_MS = 30 * 60 * 1000;
