import { messages } from "@/lib/messages";
import type { AnalysisResult, ValidationInfo } from "@/lib/types";
import { parseAnalysisResult } from "@/lib/validate-result";

const RESULT_KEYS = [
  "risk_grade",
  "needs_review",
  "action",
  "sensitive_items",
  "locations",
  "reason",
  "review_reason",
  "applied_rule",
] as const;

const KEY_LINE = new RegExp(`^(${RESULT_KEYS.join("|")})\\s*[:：]\\s*(.*)$`);
const VERDICT_KEYS = ["verdict", "signal", "color", "traffic_light", "validation", "validate_result", "result", "status", "outcome"];
const FAIL_TOKENS = new Set(["red", "fail", "failed", "failure", "error", "실패", "빨강", "빨간색", "적색", "불통과"]);
const PASS_TOKENS = new Set(["green", "pass", "passed", "success", "통과", "초록", "녹색"]);
const WARN_TOKENS = new Set(["yellow", "warn", "warning", "노랑", "노란색", "황색"]);

export type NormalizeOutcome =
  | { ok: true; result: AnalysisResult; validation: ValidationInfo }
  | { ok: false; code: "INVALID_RESULT"; message: string };

type Verdict = "fail" | "pass" | "warn" | "unknown";

type Step = {
  names: string[];
  texts: string[];
};

function invalid(): NormalizeOutcome {
  return { ok: false, code: "INVALID_RESULT", message: messages.resultInvalid };
}

function decodeWorkflowText(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.includes("\\n")) {
    return trimmed.slice(1, -1).replace(/\\n/g, "\n").replace(/\\"/g, '"');
  }
  return text;
}

function stripNoise(text: string): string {
  return text
    .replace(/^\uFEFF/, "")
    .replace(/```(?:json|text)?/gi, "")
    .replace(/```/g, "")
    .replace(/【[^】]*】/g, "")
    .trim();
}

function unwrapQuotes(text: string): string {
  const value = text.trim();
  if (value.length < 2) return value;
  const first = value[0];
  const last = value[value.length - 1];
  if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
    return value.slice(1, -1).trim();
  }
  return value;
}

function extractBalanced(text: string, start: number): string | null {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }
  return null;
}

function findResultObject(text: string): Record<string, unknown> | null {
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] !== "{") continue;
    const slice = extractBalanced(text, index);
    if (!slice) continue;
    try {
      const parsed = JSON.parse(slice) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && "risk_grade" in parsed) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      continue;
    }
  }
  return null;
}

function findAnyObject(text: string): Record<string, unknown> | null {
  const start = text.indexOf("{");
  if (start < 0) return null;
  const slice = extractBalanced(text, start);
  if (!slice) return null;
  try {
    const parsed = JSON.parse(slice) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
  return null;
}

function parseKeyValues(text: string): Record<string, string> | null {
  const found = new Map<string, string[]>();
  let current: string | null = null;
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(KEY_LINE);
    if (match) {
      current = match[1];
      found.set(current, [match[2]]);
      continue;
    }
    if (!current || !line.trim()) continue;
    found.get(current)?.push(line);
  }
  if (!found.has("risk_grade")) return null;
  const record: Record<string, string> = {};
  for (const [key, parts] of found) record[key] = parts.join("\n").trim();
  return record;
}

function parseText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return unwrapQuotes(stripNoise(value));
}

function parseNeedsReview(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return null;
  const text = unwrapQuotes(stripNoise(value));
  if (text === "예" || text.toLowerCase() === "true") return true;
  if (text === "아니오" || text === "아니요" || text.toLowerCase() === "false") return false;
  return null;
}

function parseStringArray(value: unknown[]): string[] | null {
  const items: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") return null;
    const text = unwrapQuotes(stripNoise(item));
    if (text) items.push(text);
  }
  return items;
}

function parseList(value: unknown, kind: "items" | "locations"): string[] | null {
  if (Array.isArray(value)) return parseStringArray(value);
  if (typeof value !== "string") return null;
  const text = unwrapQuotes(stripNoise(value));
  if (!text || text === "없음") return [];
  if (text.startsWith("[")) {
    try {
      const parsed = JSON.parse(text) as unknown;
      if (Array.isArray(parsed)) return parseStringArray(parsed);
    } catch {
      // 배열처럼 보이지만 JSON이 아니면 아래 줄 분리로 이어갑니다.
    }
  }
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*•]\s*/, "").trim())
    .filter((line) => line.length > 0);
  if (lines.length > 1) return lines;
  if (kind === "locations" && /,\s*\d+\s*쪽/.test(text)) {
    return text
      .split(/,\s*(?=\d+\s*쪽)/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }
  if (kind === "items") {
    return text
      .split(/\s*[,，、;]\s*/)
      .map((item) => unwrapQuotes(item))
      .filter((item) => item.length > 0);
  }
  return [text];
}

function looseFields(text: string): Record<string, unknown> | null {
  const cleaned = stripNoise(decodeWorkflowText(text));
  if (!cleaned) return null;
  return findResultObject(cleaned) ?? parseKeyValues(cleaned);
}

function parseLooseResult(text: string): AnalysisResult | null {
  const raw = looseFields(text);
  if (!raw) return null;
  const riskGrade = parseText(raw.risk_grade);
  const needsReview = parseNeedsReview(raw.needs_review);
  const action = parseText(raw.action);
  const sensitiveItems = parseList(raw.sensitive_items, "items");
  const locations = parseList(raw.locations, "locations");
  const reason = parseText(raw.reason);
  const reviewReason = parseText(raw.review_reason);
  const appliedRule = parseText(raw.applied_rule);
  if (
    riskGrade == null ||
    needsReview == null ||
    action == null ||
    sensitiveItems == null ||
    locations == null ||
    reason == null ||
    reviewReason == null ||
    appliedRule == null
  ) {
    return null;
  }
  return parseAnalysisResult({
    risk_grade: riskGrade,
    needs_review: needsReview,
    action,
    sensitive_items: sensitiveItems,
    locations,
    reason,
    review_reason: reviewReason,
    applied_rule: appliedRule,
  });
}

function readVerdictToken(value: unknown): Exclude<Verdict, "unknown"> | null {
  if (typeof value !== "string") return null;
  const token = unwrapQuotes(value).toLowerCase();
  if (FAIL_TOKENS.has(token)) return "fail";
  if (PASS_TOKENS.has(token)) return "pass";
  if (WARN_TOKENS.has(token)) return "warn";
  return null;
}

function nameFromText(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const record = parsed as Record<string, unknown>;
    for (const key of ["name", "node_name", "step_name", "node"]) {
      const value = record[key];
      if (value === "위험도_판정" || value === "판정_검사") return value;
    }
  } catch {
    return null;
  }
  return null;
}

function asText(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return null;
    }
  }
  return null;
}

function collectSteps(job: unknown): Step[] {
  if (!job || typeof job !== "object") return [];
  const record = job as { output?: unknown; output_text?: unknown };
  const steps: Step[] = [];
  if (Array.isArray(record.output)) {
    for (const item of record.output) {
      if (!item || typeof item !== "object") continue;
      const output = item as { model?: unknown; content?: unknown };
      const texts: string[] = [];
      if (Array.isArray(output.content)) {
        for (const part of output.content) {
          if (!part || typeof part !== "object") continue;
          const content = part as { text?: unknown; additional_values?: unknown };
          const text = asText(content.text);
          const extra = asText(content.additional_values);
          if (text) texts.push(text);
          if (extra) texts.push(extra);
        }
      }
      const names: string[] = [];
      if (typeof output.model === "string" && output.model.trim()) names.push(output.model.trim());
      for (const text of texts) {
        const extraName = nameFromText(text);
        if (extraName) names.push(extraName);
      }
      steps.push({ names, texts });
    }
  }
  const outputText = asText(record.output_text);
  if (outputText) steps.push({ names: ["output_text"], texts: [outputText] });
  return steps;
}

function isJudgmentStep(step: Step): boolean {
  return step.names.some((name) => name.includes("위험도_판정"));
}

function isFinalInspection(step: Step): boolean {
  return step.names.some((name) => name.includes("판정_검사"));
}

function isValidationStep(step: Step): boolean {
  return isFinalInspection(step) || step.names.some((name) => /validate/i.test(name));
}

function failureReason(check: Record<string, unknown>): string | null {
  const severity = typeof check.severity === "string" ? check.severity.toLowerCase() : "";
  const blocks = severity === "error" || check.required === true;
  if (!blocks || check.passed !== false) return null;
  const name = typeof check.name === "string" && check.name.trim() ? check.name.trim() : "검증 항목";
  const reason = typeof check.reason === "string" ? check.reason.trim() : "";
  return reason ? `${name}: ${reason}` : name;
}

function readFinalValidation(step: Step | undefined): ValidationInfo {
  if (!step) return { status: "unknown", reasons: [] };
  let verdict: "pass" | "fail" | "warn" | null = null;
  let sawSignal = false;
  const reasons: string[] = [];

  for (const text of step.texts) {
    const cleaned = stripNoise(decodeWorkflowText(text));
    if (!cleaned) continue;
    const direct = cleaned.length <= 24 ? readVerdictToken(unwrapQuotes(cleaned)) : null;
    if (direct) {
      sawSignal = true;
      if (direct === "fail") verdict = "fail";
      else if (verdict !== "fail") verdict = direct === "warn" ? "warn" : "pass";
    }
    for (const line of cleaned.split(/\r?\n/)) {
      const match = line.trim().match(/^([A-Za-z_]+)\s*[:：]\s*(.+)$/);
      if (!match || !VERDICT_KEYS.includes(match[1].toLowerCase())) continue;
      const token = readVerdictToken(match[2]);
      if (!token) continue;
      sawSignal = true;
      if (token === "fail") verdict = "fail";
      else if (verdict !== "fail") verdict = token === "warn" ? "warn" : "pass";
    }
    const record = findAnyObject(cleaned);
    if (!record) continue;
    for (const key of VERDICT_KEYS) {
      if (!(key in record)) continue;
      const token = readVerdictToken(record[key]);
      if (!token) continue;
      sawSignal = true;
      if (token === "fail") verdict = "fail";
      else if (verdict !== "fail") verdict = token === "warn" ? "warn" : "pass";
    }
    const checks = Array.isArray(record.checks) ? record.checks : Array.isArray(record.rules) ? record.rules : null;
    if (!checks) continue;
    sawSignal = true;
    for (const item of checks) {
      if (!item || typeof item !== "object") continue;
      const reason = failureReason(item as Record<string, unknown>);
      if (reason) reasons.push(reason);
    }
  }

  if (reasons.length > 0 || verdict === "fail") {
    return {
      status: "fail",
      reasons: reasons.length > 0 ? reasons : ["최종 판정_검사가 실패로 끝났습니다."],
    };
  }
  if (sawSignal && (verdict === "pass" || verdict === "warn")) return { status: "pass", reasons: [] };
  return { status: "unknown", reasons: [] };
}

function parseStep(step: Step): AnalysisResult | null {
  for (const text of step.texts) {
    const result = parseLooseResult(text);
    if (result) return result;
  }
  if (step.texts.length > 1) return parseLooseResult(step.texts.join("\n"));
  return null;
}

/**
 * Upstage 작업 응답에서 화면용 결과를 고릅니다.
 * 최종 검증은 판정_검사 노드만 보고, 다른 Validate 분기는 실패로 쓰지 않습니다.
 * 위험도_판정 단계가 있으면 그 결과를 먼저 쓰고, 판정_검사의 green/red 만으로는 위험도를 만들지 않습니다.
 */
export function normalizeWorkflowOutput(job: unknown): NormalizeOutcome {
  const steps = collectSteps(job);
  if (steps.length === 0) return invalid();
  const validation = readFinalValidation([...steps].reverse().find(isFinalInspection));

  const namedJudgment = steps.find(isJudgmentStep);
  if (namedJudgment) {
    const result = parseStep(namedJudgment);
    if (result) return { ok: true, result, validation };
  }

  const outputText = steps.find((step) => step.names.includes("output_text"));
  if (outputText) {
    const result = parseStep(outputText);
    if (result) return { ok: true, result, validation };
  }

  for (let index = steps.length - 1; index >= 0; index -= 1) {
    const step = steps[index];
    if (step.names.includes("output_text") || isValidationStep(step)) continue;
    const result = parseStep(step);
    if (result) return { ok: true, result, validation };
  }

  for (let index = steps.length - 1; index >= 0; index -= 1) {
    const step = steps[index];
    if (!isValidationStep(step)) continue;
    const result = parseStep(step);
    if (result) return { ok: true, result, validation };
  }
  return invalid();
}
