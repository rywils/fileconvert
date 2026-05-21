import type { FormatDef } from "@/lib/formats";
import fs from "fs/promises";

const VERCEL_DOCUMENT_PAIRS = new Set([
  "pdf-docx",
  "docx-pdf",
  "pdf-txt",
  "txt-pdf",
  "html-pdf",
  "html-docx",
  "docx-txt",
  "txt-docx",
  "txt-html",
  "html-txt",
]);

export function isVercelDocumentPair(inputId: string, outputId: string): boolean {
  return VERCEL_DOCUMENT_PAIRS.has(`${inputId}-${outputId}`);
}

export async function convertDocument(
  inputPath: string,
  outputPath: string,
  inputFormat: FormatDef,
  outputFormat: FormatDef,
): Promise<void> {
  if (!isVercelDocumentPair(inputFormat.id, outputFormat.id)) {
    throw new Error(
      `${inputFormat.label} → ${outputFormat.label} is not supported without LibreOffice. ` +
        `Supported on Vercel: PDF ↔ DOCX, PDF/DOCX/TXT/HTML conversions listed in the app.`,
    );
  }

  const pair = `${inputFormat.id}-${outputFormat.id}`;

  switch (pair) {
    case "pdf-docx":
      return pdfToDocx(inputPath, outputPath);
    case "docx-pdf":
      return docxToPdf(inputPath, outputPath);
    case "pdf-txt":
      return pdfToText(inputPath, outputPath);
    case "txt-pdf":
      return textToPdf(await fs.readFile(inputPath, "utf8"), outputPath);
    case "html-pdf":
      return htmlToPdf(await fs.readFile(inputPath, "utf8"), outputPath);
    case "html-docx":
      return htmlToDocx(await fs.readFile(inputPath, "utf8"), outputPath);
    case "docx-txt":
      return docxToText(inputPath, outputPath);
    case "txt-docx":
      return textToDocx(await fs.readFile(inputPath, "utf8"), outputPath);
    case "txt-html":
      return fs.writeFile(
        outputPath,
        `<!DOCTYPE html><html><body><pre>${escapeHtml(await fs.readFile(inputPath, "utf8"))}</pre></body></html>`,
      );
    case "html-txt":
      return fs.writeFile(
        outputPath,
        (await fs.readFile(inputPath, "utf8")).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
      );
    default:
      throw new Error(`Unsupported document conversion: ${pair}`);
  }
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function pdfToText(inputPath: string, outputPath: string) {
  const pdfParse = (await import("pdf-parse")).default;
  const data = await pdfParse(await fs.readFile(inputPath));
  await fs.writeFile(outputPath, data.text);
}

async function pdfToDocx(inputPath: string, outputPath: string) {
  const pdfParse = (await import("pdf-parse")).default;
  const { Document, Packer, Paragraph, TextRun } = await import("docx");
  const data = await pdfParse(await fs.readFile(inputPath));
  const paragraphs = data.text
    .split(/\n\s*\n/)
    .filter(Boolean)
    .map((block: string) => new Paragraph({ children: [new TextRun(block.trim())] }));
  const doc = new Document({
    sections: [{ children: paragraphs.length ? paragraphs : [new Paragraph("")] }],
  });
  await fs.writeFile(outputPath, await Packer.toBuffer(doc));
}

async function textToDocx(text: string, outputPath: string) {
  const { Document, Packer, Paragraph, TextRun } = await import("docx");
  const paragraphs = text
    .split(/\n\s*\n/)
    .filter(Boolean)
    .map((block) => new Paragraph({ children: [new TextRun(block)] }));
  const doc = new Document({
    sections: [{ children: paragraphs.length ? paragraphs : [new Paragraph("")] }],
  });
  await fs.writeFile(outputPath, await Packer.toBuffer(doc));
}

async function docxToText(inputPath: string, outputPath: string) {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ path: inputPath });
  await fs.writeFile(outputPath, result.value);
}

async function htmlToDocx(html: string, outputPath: string) {
  const text = html.replace(/<[^>]+>/g, "\n").replace(/\s+/g, "\n").trim();
  await textToDocx(text, outputPath);
}

async function htmlToPdf(html: string, outputPath: string) {
  await renderHtmlToPdf(wrapHtml(html), outputPath);
}

async function textToPdf(text: string, outputPath: string) {
  await renderHtmlToPdf(wrapHtml(`<pre>${escapeHtml(text)}</pre>`), outputPath);
}

async function docxToPdf(inputPath: string, outputPath: string) {
  const mammoth = await import("mammoth");
  const result = await mammoth.convertToHtml({ path: inputPath });
  await renderHtmlToPdf(wrapHtml(result.value), outputPath);
}

function wrapHtml(body: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:system-ui,sans-serif;padding:2rem;line-height:1.5;}</style></head><body>${body}</body></html>`;
}

async function renderHtmlToPdf(html: string, outputPath: string) {
  const puppeteer = await import("puppeteer-core");
  const chromium = await import("@sparticuz/chromium-min");

  const browser = await puppeteer.default.launch({
    args: chromium.default.args,
    defaultViewport: { width: 794, height: 1123 },
    executablePath: await chromium.default.executablePath(),
    headless: true,
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    await page.pdf({
      path: outputPath,
      format: "A4",
      printBackground: true,
      margin: { top: "40px", bottom: "40px", left: "40px", right: "40px" },
    });
  } finally {
    await browser.close();
  }
}
