# Free File Converter

CloudConvert-style converter — **no accounts, no credits, no permanent storage**. Built for Vercel serverless.

## Formats

| Category | Input / output |
|----------|----------------|
| **Images** | WebP ★ (default), JPEG, PNG, AVIF, GIF, TIFF, HEIC, HEIF, ICO — BMP in, convert out to anything else |
| **Video** | MP4, WebM, MOV, MKV, AVI, WMV, FLV, MPEG, 3GP, GIF |
| **Audio** | MP3, WAV, AAC, OGG, FLAC, M4A |
| **Documents** | PDF ↔ DOCX, PDF/DOCX/TXT/HTML (npm-only, no LibreOffice) |

DOC, ODT, PPTX, XLSX are listed but need LibreOffice — not installed on Vercel. You’ll get a clear error; use PDF/DOCX instead.

## Stack (no server `apt install`)

- **Sharp** — images  
- **ffmpeg-static** — bundled FFmpeg binary (video/audio)  
- **pdf-parse + docx + mammoth + puppeteer + chromium** — PDF/DOCX without LibreOffice  

## Run locally

```bash
npm install
npm run dev
```

## Deploy

Push to GitHub → import on Vercel. No Docker or LibreOffice required.

## Limits

- 4 MB per file (Vercel upload cap)
- 100 files per session
- Temp `/tmp` storage, wiped on refresh or “Done”
