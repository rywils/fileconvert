import type { FormatDef } from "@/lib/formats";
import sharp from "sharp";

export type ImageConvertOptions = {
  quality?: number;
};

export async function convertImage(
  input: Buffer,
  inputFormat: FormatDef,
  outputFormat: FormatDef,
  options: ImageConvertOptions = {},
): Promise<Buffer> {
  const quality = options.quality ?? 85;
  let pipeline = sharp(input, { failOn: "error" });

  if (inputFormat.id === "svg") {
    pipeline = sharp(input, { density: 300 });
  }

  switch (outputFormat.id) {
    case "jpg":
      return pipeline.jpeg({ quality, mozjpeg: true }).toBuffer();
    case "png":
      return pipeline.png({ compressionLevel: 9 }).toBuffer();
    case "webp":
      return pipeline.webp({ quality, effort: 4 }).toBuffer();
    case "avif":
      return pipeline.avif({ quality }).toBuffer();
    case "gif":
      return pipeline.gif().toBuffer();
    case "tiff":
      return pipeline.tiff({ compression: "lzw" }).toBuffer();
    case "heic":
      return pipeline.heif({ compression: "hevc", quality }).toBuffer();
    case "heif":
      return pipeline.heif({ compression: "hevc", quality }).toBuffer();
    case "ico":
      return pipeline.resize(256, 256, { fit: "inside" }).png().toBuffer();
    default:
      throw new Error(`Unsupported image output: ${outputFormat.id}`);
  }
}
