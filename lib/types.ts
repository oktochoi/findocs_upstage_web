export const RISK_GRADES = ["매우 높음", "높음", "보통", "없음"] as const;

export type RiskGrade = (typeof RISK_GRADES)[number];

export type AnalysisResult = {
  risk_grade: RiskGrade;
  needs_review: boolean;
  action: string;
  sensitive_items: string[];
  locations: string[];
  reason: string;
  review_reason: string;
  applied_rule: string;
};

export type ProgressStage = "queued" | "in_progress";

export type ValidationStatus = "pass" | "fail" | "unknown";

export type ValidationInfo = {
  status: ValidationStatus;
  reasons: string[];
};

export type JobView =
  | { status: "active"; stage: ProgressStage }
  | { status: "completed"; result: AnalysisResult; validation: ValidationInfo }
  | { status: "failed"; message: string; code: string };
