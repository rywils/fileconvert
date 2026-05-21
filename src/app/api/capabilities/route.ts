import { FORMATS, formatsByCategory } from "@/lib/formats";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    images: true,
    video: true,
    audio: true,
    documents: true,
    documentNote:
      "PDF ↔ DOCX and related formats use npm libraries (no LibreOffice). DOC/ODT/PPTX/XLSX may show an error.",
    formats: FORMATS,
    categories: {
      image: formatsByCategory("image"),
      video: formatsByCategory("video"),
      audio: formatsByCategory("audio"),
      document: formatsByCategory("document"),
    },
  });
}
