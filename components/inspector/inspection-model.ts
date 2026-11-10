import type { AnalysisResult, ProgressStage } from "@/lib/types";
import type { SampleId } from "@/lib/samples";

export type SelectionState =
  | { kind: "none" }
  | { kind: "file"; file: File }
  | { kind: "sample"; id: SampleId };

export type PreviewState =
  | { status: "empty" }
  | { status: "loading" }
  | { status: "ready"; data: Uint8Array; numPages: number | null }
  | { status: "error"; message: string };

export type RunState =
  | { status: "idle" }
  | { status: "ready" }
  | { status: "uploading"; startedAt: number }
  | { status: "active"; jobId: string; stage: ProgressStage; startedAt: number }
  | { status: "poll_error"; jobId: string; stage: ProgressStage; startedAt: number; message: string }
  | { status: "unavailable"; message: string }
  | { status: "upload_error"; message: string }
  | { status: "start_error"; message: string }
  | { status: "job_failed"; message: string }
  | { status: "invalid_result"; jobId: string; message: string; startedAt: number }
  | { status: "completed"; result: AnalysisResult };

export type BannerState = { tone: "error" | "info"; message: string } | null;
