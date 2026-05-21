import { canConvert, detectFormat, getFormat, type FormatDef } from "@/lib/formats";
import { convertImage } from "@/lib/converters/image";
import { convertMedia } from "@/lib/converters/video";
import { convertDocument } from "@/lib/converters/document";
import fs from "fs/promises";
import path from "path";

export type ConvertJobOptions = {
  quality?: number;
};

export async function runConversion(
  inputPath: string,
  outputPath: string,
  outputFormatId: string,
  options: ConvertJobOptions = {},
): Promise<{ inputFormat: FormatDef; outputFormat: FormatDef; outputBytes: number }> {
  const inputFormat = detectFormat(path.basename(inputPath));
  const outputFormat = getFormat(outputFormatId);

  if (!inputFormat) {
    throw new Error("Could not detect input file format.");
  }
  if (!outputFormat) {
    throw new Error(`Unknown output format: ${outputFormatId}`);
  }
  if (!canConvert(inputFormat, outputFormat.id)) {
    throw new Error(
      `Cannot convert ${inputFormat.label} to ${outputFormat.label}. Pick a compatible output format.`,
    );
  }

  if (inputFormat.category === "image") {
    const input = await fs.readFile(inputPath);
    const out = await convertImage(input, inputFormat, outputFormat, {
      quality: options.quality,
    });
    await fs.writeFile(outputPath, out);
    return { inputFormat, outputFormat, outputBytes: out.length };
  }

  if (inputFormat.category === "video" || inputFormat.category === "audio") {
    await convertMedia(inputPath, outputPath, outputFormat);
    const outStat = await fs.stat(outputPath);
    return { inputFormat, outputFormat, outputBytes: outStat.size };
  }

  if (inputFormat.category === "document") {
    await convertDocument(inputPath, outputPath, inputFormat, outputFormat);
    const outStat = await fs.stat(outputPath);
    return { inputFormat, outputFormat, outputBytes: outStat.size };
  }

  throw new Error("Unsupported file category.");
}
