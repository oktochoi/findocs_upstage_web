import { messages } from "@/lib/messages";

const ENV_NAMES = [
  "UPSTAGE_API_KEY",
  "UPSTAGE_AGENT_ID",
  "UPSTAGE_CONFIG_ID",
  "UPSTAGE_PROJECT_ID",
  "UPSTAGE_BASE_URL",
] as const;

export type UpstageEnvName = (typeof ENV_NAMES)[number];

export class UpstageError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "UpstageError";
    this.code = code;
    this.status = status;
  }
}

type UpstageConfig = {
  apiKey: string;
  agentId: string;
  configId: string;
  projectId: string;
  baseUrl: string;
};

export function missingUpstageEnv(): UpstageEnvName[] {
  return ENV_NAMES.filter((name) => !process.env[name]?.trim());
}

export function isAnalysisConfigured(): boolean {
  return missingUpstageEnv().length === 0;
}

function requireConfig(): UpstageConfig {
  const missing = missingUpstageEnv();
  if (missing.length > 0) {
    throw new UpstageError("MISSING_ENV", messages.missingEnv(missing), 503);
  }
  return {
    apiKey: process.env.UPSTAGE_API_KEY!.trim(),
    agentId: process.env.UPSTAGE_AGENT_ID!.trim(),
    configId: process.env.UPSTAGE_CONFIG_ID!.trim(),
    projectId: process.env.UPSTAGE_PROJECT_ID!.trim(),
    baseUrl: process.env.UPSTAGE_BASE_URL!.trim().replace(/\/$/, ""),
  };
}

function upstageHeaders(config: UpstageConfig, contentType?: string): Headers {
  const headers = new Headers();
  headers.set("Authorization", `Bearer ${config.apiKey}`);
  headers.set("x-project-id", config.projectId);
  if (contentType) headers.set("Content-Type", contentType);
  return headers;
}

function logFailure(operation: "upload" | "start" | "retrieve", status: number) {
  console.error(`[upstage] ${operation} request failed`, { status });
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

/**
 * 파일 객체와 작업 응답의 식별자 필드는 공식 스키마의 id 입니다.
 * 작업 예시 값은 job_ 로 시작하는 id 이며, job_id 필드는 응답 스키마에 없습니다.
 */
function readErrorCode(input: unknown): string | null {
  if (!input || typeof input !== "object") return null;
  const error = (input as { error?: unknown }).error;
  if (!error || typeof error !== "object") return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" && code.trim() ? code.trim() : null;
}

function readResourceId(input: unknown): string | null {
  if (!input || typeof input !== "object") return null;
  const id = (input as { id?: unknown }).id;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

export type ServiceJobStatus = "queued" | "in_progress" | "completed" | "failed";

const FAILED_UPSTAGE_STATUSES = new Set(["failed", "cancelled", "canceled", "incomplete", "expired"]);

function hasUpstageError(error: unknown): boolean {
  return error != null;
}

/**
 * Upstage 작업 상태를 서비스 상태로 바꿉니다.
 * queued와 in_progress는 진행 중이고, completed만 결과로 다룹니다.
 * failed, cancelled, canceled, incomplete, expired와 error 필드는 실패입니다.
 * 그 밖의 상태는 결과로 해석하지 않고 진행 중으로 둡니다.
 */
export function mapUpstageStatus(status: string, error: unknown): ServiceJobStatus {
  if (status === "completed" && !hasUpstageError(error)) return "completed";
  if (status === "queued") return "queued";
  if (status === "in_progress") return "in_progress";
  if (status === "completed" || FAILED_UPSTAGE_STATUSES.has(status) || hasUpstageError(error)) return "failed";
  return "in_progress";
}

export async function uploadPdf(file: File): Promise<string> {
  const config = requireConfig();
  const body = new FormData();
  body.append("purpose", "user_data");
  body.append("file", file, file.name || "document.pdf");

  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/files`, {
      method: "POST",
      headers: upstageHeaders(config),
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(60_000),
    });
  } catch {
    logFailure("upload", 0);
    throw new UpstageError("UPLOAD_FAILED", messages.uploadFailed, 502);
  }

  const data = await readJson(response);
  if (!response.ok) {
    logFailure("upload", response.status);
    throw new UpstageError("UPLOAD_FAILED", messages.uploadFailed, 502);
  }
  const fileId = readResourceId(data);
  if (!fileId) {
    logFailure("upload", response.status);
    throw new UpstageError("UPLOAD_FAILED", messages.uploadFailed, 502);
  }
  return fileId;
}

export async function startAgentRun(fileId: string): Promise<string> {
  const config = requireConfig();
  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/responses`, {
      method: "POST",
      headers: upstageHeaders(config, "application/json"),
      body: JSON.stringify({
        model: config.agentId,
        config_id: config.configId,
        input: [
          {
            role: "user",
            content: [{ type: "input_file", file_id: fileId }],
          },
        ],
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    logFailure("start", 0);
    throw new UpstageError("ANALYSIS_START_FAILED", messages.analysisStartFailed, 502);
  }

  const data = await readJson(response);
  if (!response.ok) {
    logFailure("start", response.status);
    const quota = readErrorCode(data) === "studio_subscription_quota_exceeded";
    throw new UpstageError(
      quota ? "QUOTA_EXCEEDED" : "ANALYSIS_START_FAILED",
      quota ? messages.quotaExceeded : messages.analysisStartFailed,
      502,
    );
  }
  const jobId = readResourceId(data);
  if (!jobId) {
    logFailure("start", response.status);
    throw new UpstageError("ANALYSIS_START_FAILED", messages.analysisStartFailed, 502);
  }
  return jobId;
}

export async function retrieveJob(jobId: string): Promise<unknown> {
  const config = requireConfig();
  const url = new URL(`${config.baseUrl}/responses/${encodeURIComponent(jobId)}`);
  // 명세의 조회 쿼리는 include[] 입니다. all 이어야 위험도_판정과 마지막 단계의 output_text 를 함께 볼 수 있습니다.
  url.searchParams.append("include[]", "all");

  let response: Response;
  try {
    response = await fetch(url, {
      headers: upstageHeaders(config),
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    logFailure("retrieve", 0);
    throw new UpstageError("STATUS_UNAVAILABLE", messages.statusUnavailable, 503);
  }

  const data = await readJson(response);
  if (response.status === 404) {
    logFailure("retrieve", response.status);
    throw new UpstageError("JOB_NOT_FOUND", messages.jobNotFound, 404);
  }
  if (!response.ok) {
    logFailure("retrieve", response.status);
    throw new UpstageError("STATUS_UNAVAILABLE", messages.statusUnavailable, 503);
  }
  return data;
}

export function readUpstageJobStatus(job: unknown): { status: string; error: unknown } | null {
  if (!job || typeof job !== "object") return null;
  const record = job as { status?: unknown; error?: unknown };
  if (typeof record.status !== "string" || !record.status.trim()) return null;
  return { status: record.status, error: record.error };
}
