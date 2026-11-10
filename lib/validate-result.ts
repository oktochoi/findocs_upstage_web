import { RISK_GRADES, type AnalysisResult, type JobView, type ProgressStage, type ValidationInfo } from "@/lib/types";
import { messages } from "@/lib/messages";

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export function parseAnalysisResult(input: unknown): AnalysisResult | null {
  if (!input || typeof input !== "object") return null;
  const value = input as Record<string, unknown>;
  if (typeof value.risk_grade !== "string" || !RISK_GRADES.includes(value.risk_grade as AnalysisResult["risk_grade"])) {
    return null;
  }
  if (typeof value.needs_review !== "boolean") return null;
  if (typeof value.action !== "string") return null;
  if (!isStringList(value.sensitive_items)) return null;
  if (!isStringList(value.locations)) return null;
  if (typeof value.reason !== "string") return null;
  if (typeof value.review_reason !== "string") return null;
  if (typeof value.applied_rule !== "string") return null;

  return {
    risk_grade: value.risk_grade as AnalysisResult["risk_grade"],
    needs_review: value.needs_review,
    action: value.action,
    sensitive_items: value.sensitive_items,
    locations: value.locations,
    reason: value.reason,
    review_reason: value.review_reason,
    applied_rule: value.applied_rule,
  };
}

const KNOWN_STAGES = new Set<ProgressStage>(["queued", "in_progress"]);

function parseValidation(input: unknown): ValidationInfo {
  if (!input || typeof input !== "object") return { status: "unknown", reasons: [] };
  const record = input as { status?: unknown; reasons?: unknown };
  const status = record.status === "pass" || record.status === "fail" || record.status === "unknown" ? record.status : "unknown";
  const reasons = Array.isArray(record.reasons)
    ? record.reasons.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
  return { status, reasons };
}

function failedDetails(input: unknown): { code: string; message: string } {
  if (!input || typeof input !== "object") return { code: "ANALYSIS_FAILED", message: messages.analysisFailed };
  const error = (input as { error?: unknown }).error;
  if (!error || typeof error !== "object") return { code: "ANALYSIS_FAILED", message: messages.analysisFailed };
  const record = error as Record<string, unknown>;
  const code = typeof record.code === "string" && record.code.trim() ? record.code : "ANALYSIS_FAILED";
  const message = typeof record.message === "string" && record.message.trim() ? record.message : messages.analysisFailed;
  return { code, message };
}

export function parseJobView(input: unknown): JobView | null {
  if (!input || typeof input !== "object") return null;
  const status = (input as { status?: unknown }).status;
  if (typeof status !== "string" || !status) return null;

  if (status === "completed") {
    const result = parseAnalysisResult((input as { result?: unknown }).result);
    if (!result) return null;
    return { status: "completed", result, validation: parseValidation((input as { validation?: unknown }).validation) };
  }

  if (status === "failed") {
    const failed = failedDetails(input);
    return { status: "failed", message: failed.message, code: failed.code };
  }

  if (!KNOWN_STAGES.has(status as ProgressStage)) return null;
  return { status: "active", stage: status as ProgressStage };
}
