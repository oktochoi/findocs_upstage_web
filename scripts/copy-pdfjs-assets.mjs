import { cpSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pdfjs = join(root, "node_modules/pdfjs-dist");
const pdfjsDest = join(root, "public/pdfjs");
const fontDest = join(root, "public/fonts");

mkdirSync(pdfjsDest, { recursive: true });
mkdirSync(fontDest, { recursive: true });

cpSync(join(pdfjs, "build/pdf.worker.min.mjs"), join(pdfjsDest, "pdf.worker.min.mjs"));
cpSync(join(pdfjs, "cmaps"), join(pdfjsDest, "cmaps"), { recursive: true });
cpSync(join(pdfjs, "standard_fonts"), join(pdfjsDest, "standard_fonts"), { recursive: true });
cpSync(
  join(root, "node_modules/pretendard/dist/web/variable/woff2/PretendardVariable.woff2"),
  join(fontDest, "PretendardVariable.woff2"),
);
