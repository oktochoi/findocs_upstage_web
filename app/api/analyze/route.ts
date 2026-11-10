import { getMaxUploadBytes } from "@/lib/config";
import { hasPdfHeader, isPdfFile } from "@/lib/files";
import { formatBytes } from "@/lib/format";
import { messages } from "@/lib/messages";
import { startAgentRun, UpstageError, uploadPdf } from "@/lib/upstage";

function jsonError(status: number, code: string, message: string) {
  return Response.json(
    { error: { code, message } },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError(400, "upload_failed", messages.uploadFailed);
  }

  const entry = formData.get("file");
  if (!(entry instanceof File) || entry.size === 0) {
    return jsonError(400, "upload_failed", messages.uploadFailed);
  }
  if (!isPdfFile(entry)) {
    return jsonError(400, "not_pdf", messages.notPdf);
  }

  const limit = getMaxUploadBytes();
  if (limit != null && entry.size > limit) {
    return jsonError(413, "file_too_large", messages.tooLarge(formatBytes(limit)));
  }

  const header = new Uint8Array(await entry.slice(0, 1024).arrayBuffer());
  if (!hasPdfHeader(header)) {
    return jsonError(400, "not_pdf", messages.unreadablePdf);
  }

  try {
    const fileId = await uploadPdf(entry);
    const jobId = await startAgentRun(fileId);
    return Response.json(
      { jobId, status: "queued" },
      { status: 202, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof UpstageError) {
      return jsonError(error.status, error.code, error.message);
    }
    return jsonError(502, "UPLOAD_FAILED", messages.uploadFailed);
  }
}
