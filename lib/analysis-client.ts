import { messages } from "@/lib/messages";
import type { JobView } from "@/lib/types";
import { parseJobView } from "@/lib/validate-result";

export class AnalysisClientError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "AnalysisClientError";
    this.code = code;
    this.status = status;
  }
}

type ApiErrorBody = { code: string; message: string };

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function readApiError(input: unknown, fallback: ApiErrorBody): ApiErrorBody {
  if (!input || typeof input !== "object" || !("error" in input)) return fallback;
  const error = (input as { error?: unknown }).error;
  if (!error || typeof error !== "object") return fallback;
  const record = error as Record<string, unknown>;
  if (typeof record.code !== "string" || typeof record.message !== "string" || !record.message.trim()) {
    return fallback;
  }
  return { code: record.code, message: record.message };
}

function isStartPayload(input: unknown): input is { jobId: string; status: "queued" } {
  if (!input || typeof input !== "object") return false;
  const record = input as Record<string, unknown>;
  return typeof record.jobId === "string" && record.jobId.trim().length > 0 && record.status === "queued";
}

export async function startAnalysis(file: File): Promise<{ jobId: string }> {
  const body = new FormData();
  body.append("file", file);

  let response: Response;
  try {
    response = await fetch("/api/analyze", { method: "POST", body, cache: "no-store" });
  } catch {
    throw new AnalysisClientError("upload_failed", messages.uploadFailed, 0);
  }

  const data = await readBody(response);
  if (!response.ok) {
    const error = readApiError(data, { code: "upload_failed", message: messages.uploadFailed });
    throw new AnalysisClientError(error.code, error.message, response.status);
  }
  if (!isStartPayload(data)) {
    throw new AnalysisClientError("invalid_result", messages.resultInvalid, response.status);
  }
  return { jobId: data.jobId };
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

export async function getAnalysis(jobId: string, signal?: AbortSignal): Promise<JobView> {
  let response: Response;
  try {
    response = await fetch(`/api/analyze/${encodeURIComponent(jobId)}`, { cache: "no-store", signal });
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new AnalysisClientError("status_unavailable", messages.statusUnavailable, 0);
  }

  const data = await readBody(response);
  if (!response.ok) {
    if (response.status >= 500) {
      const error = readApiError(data, { code: "status_unavailable", message: messages.statusUnavailable });
      throw new AnalysisClientError("status_unavailable", error.message, response.status);
    }
    const error = readApiError(data, { code: "job_not_found", message: messages.jobNotFound });
    throw new AnalysisClientError(error.code, error.message, response.status);
  }

  const view = parseJobView(data);
  if (!view) {
    throw new AnalysisClientError("invalid_result", messages.resultInvalid, response.status);
  }
  return view;
}
