"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BannerState, PreviewState, RunState, SelectionState } from "@/components/inspector/inspection-model";
import { AnalysisClientError, getAnalysis, isAbortError, startAnalysis } from "@/lib/analysis-client";
import { getMaxUploadBytes } from "@/lib/config";
import { hasPdfHeader, isPdfFile } from "@/lib/files";
import { formatBytes } from "@/lib/format";
import { messages } from "@/lib/messages";
import { getSampleResult, type SampleId } from "@/lib/samples";

export function useInspection() {
  const [selection, setSelection] = useState<SelectionState>({ kind: "none" });
  const [preview, setPreview] = useState<PreviewState>({ status: "empty" });
  const [run, setRun] = useState<RunState>({ status: "idle" });
  const [banner, setBanner] = useState<BannerState>(null);
  const [page, setPage] = useState(1);
  const [pageWarning, setPageWarning] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [focusTick, setFocusTick] = useState(0);

  const runningRef = useRef(false);
  const selectSeq = useRef(0);
  const generation = useRef(0);
  const mountedRef = useRef(true);

  const locked = run.status === "uploading" || run.status === "active" || run.status === "poll_error";
  const activeJobId = run.status === "active" ? run.jobId : null;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    runningRef.current = locked;
  }, [locked]);

  useEffect(() => {
    if (!activeJobId) return;
    const jobId = activeJobId;
    const seq = generation.current;
    const controller = new AbortController();
    let stopped = false;
    let timer = 0;

    const schedule = () => {
      if (stopped) return;
      timer = window.setTimeout(() => {
        void poll();
      }, 3000);
    };

    const stillCurrent = () => !stopped && mountedRef.current && generation.current === seq;

    const poll = async () => {
      if (!stillCurrent()) return;
      try {
        const view = await getAnalysis(jobId, controller.signal);
        if (!stillCurrent()) return;
        if (view.status === "active") {
          setRun((current) =>
            current.status === "active" && current.jobId === jobId ? { ...current, stage: view.stage } : current,
          );
          schedule();
          return;
        }
        if (view.status === "completed") {
          setRun((current) => {
            if (current.status !== "active" || current.jobId !== jobId) return current;
            return { status: "completed", result: view.result, validation: view.validation };
          });
          setFocusTick((tick) => tick + 1);
          return;
        }
        setRun((current) => {
          if (current.status !== "active" || current.jobId !== jobId) return current;
          if (view.code === "INVALID_RESULT") {
            return { status: "invalid_result", jobId, message: view.message, startedAt: current.startedAt };
          }
          return { status: "job_failed", message: view.message };
        });
        setFocusTick((tick) => tick + 1);
      } catch (error) {
        if (stopped || controller.signal.aborted || isAbortError(error) || !stillCurrent()) return;
        const resolved =
          error instanceof AnalysisClientError
            ? error
            : new AnalysisClientError("status_unavailable", messages.statusUnavailable, 0);
        if (resolved.code === "invalid_result") {
          setRun((current) =>
            current.status === "active" && current.jobId === jobId
              ? { status: "invalid_result", jobId, message: resolved.message, startedAt: current.startedAt }
              : current,
          );
        } else if (resolved.code === "job_not_found") {
          setRun((current) =>
            current.status === "active" && current.jobId === jobId
              ? { status: "job_failed", message: resolved.message }
              : current,
          );
        } else {
          setRun((current) => {
            if (current.status !== "active" || current.jobId !== jobId) return current;
            return {
              status: "poll_error",
              jobId,
              stage: current.stage,
              startedAt: current.startedAt,
              message: resolved.message || messages.statusUnavailable,
            };
          });
        }
        setFocusTick((tick) => tick + 1);
      }
    };

    void poll();
    return () => {
      stopped = true;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [activeJobId]);

  const bumpFocus = () => setFocusTick((tick) => tick + 1);

  const acceptFiles = useCallback(async (input: FileList | File[]) => {
    if (runningRef.current) return;
    const files = Array.from(input);
    if (files.length === 0) return;
    const file = files[0];
    const limit = getMaxUploadBytes();

    if (!isPdfFile(file)) {
      setBanner({ tone: "error", message: messages.notPdf });
      return;
    }
    if (limit != null && file.size > limit) {
      setBanner({ tone: "error", message: messages.tooLarge(formatBytes(limit)) });
      return;
    }

    generation.current += 1;
    const seq = ++selectSeq.current;
    setBanner(
      files.length > 1
        ? { tone: "info", message: "한 번에 1개의 PDF만 검사합니다. 첫 번째 파일을 선택했어요." }
        : null,
    );
    setSelection({ kind: "file", file });
    setRun({ status: "ready" });
    setPage(1);
    setPageWarning(null);
    setPreviewOpen(true);
    setPreview({ status: "loading" });

    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (selectSeq.current !== seq || !mountedRef.current) return;
      if (!hasPdfHeader(bytes)) {
        setPreview({ status: "error", message: messages.unreadablePdf });
        bumpFocus();
        return;
      }
      setPreview({ status: "ready", data: bytes, numPages: null });
    } catch {
      if (selectSeq.current !== seq || !mountedRef.current) return;
      setPreview({ status: "error", message: messages.unreadablePdf });
      bumpFocus();
    }
  }, []);

  const handlePreviewReady = useCallback((numPages: number) => {
    setPreview((current) => (current.status === "ready" ? { ...current, numPages } : current));
    setPage((current) => (current > numPages ? numPages : current));
  }, []);

  const handlePreviewError = useCallback(() => {
    setPreview((current) => (current.status === "error" ? current : { status: "error", message: messages.unreadablePdf }));
    bumpFocus();
  }, []);

  const start = useCallback(async () => {
    if (runningRef.current) return;
    if (selection.kind !== "file") return;
    if (preview.status !== "ready" || preview.numPages == null) return;

    const seq = generation.current;
    const file = selection.file;
    const startedAt = Date.now();
    runningRef.current = true;
    setRun({ status: "uploading", startedAt });

    try {
      const started = await startAnalysis(file);
      if (!mountedRef.current || generation.current !== seq) {
        runningRef.current = false;
        return;
      }
      setRun({ status: "active", jobId: started.jobId, stage: "queued", startedAt });
    } catch (error) {
      runningRef.current = false;
      if (!mountedRef.current || generation.current !== seq) return;
      const resolved =
        error instanceof AnalysisClientError
          ? error
          : new AnalysisClientError("upload_failed", messages.uploadFailed, 0);
      if (resolved.code === "MISSING_ENV" || resolved.code === "analysis_not_configured") {
        setRun({ status: "unavailable", message: resolved.message });
      } else if (resolved.code === "ANALYSIS_START_FAILED") {
        setRun({ status: "start_error", message: resolved.message });
      } else if (resolved.code === "not_pdf" || resolved.code === "file_too_large") {
        setBanner({ tone: "error", message: resolved.message });
        setRun({ status: "ready" });
      } else {
        setRun({
          status: "upload_error",
          message: resolved.code === "invalid_result" ? messages.uploadFailed : resolved.message,
        });
      }
      bumpFocus();
    }
  }, [preview, selection]);

  const recheck = useCallback(() => {
    setRun((current) => {
      if (current.status === "poll_error") {
        return { status: "active", jobId: current.jobId, stage: current.stage, startedAt: current.startedAt };
      }
      if (current.status === "invalid_result") {
        return { status: "active", jobId: current.jobId, stage: "in_progress", startedAt: current.startedAt };
      }
      return current;
    });
  }, []);

  const openSample = useCallback((id: SampleId) => {
    if (runningRef.current) return;
    selectSeq.current += 1;
    generation.current += 1;
    setSelection({ kind: "sample", id });
    setPreview({ status: "empty" });
    setRun({ status: "idle" });
    setBanner(null);
    setPage(1);
    setPageWarning(null);
    setPreviewOpen(false);
    bumpFocus();
  }, []);

  const resetInspection = useCallback(() => {
    if (runningRef.current && (run.status === "uploading" || run.status === "active")) return;
    runningRef.current = false;
    selectSeq.current += 1;
    generation.current += 1;
    setSelection({ kind: "none" });
    setPreview({ status: "empty" });
    setRun({ status: "idle" });
    setBanner(null);
    setPage(1);
    setPageWarning(null);
    setPreviewOpen(false);
  }, [run.status]);

  const jumpToPage = useCallback(
    (nextPage: number) => {
      if (preview.status !== "ready" || preview.numPages == null) return;
      if (nextPage < 1 || nextPage > preview.numPages) {
        setPageWarning(`${nextPage}쪽은 이 문서에 없습니다. 현재 문서는 ${preview.numPages}쪽입니다.`);
        setPreviewOpen(true);
        return;
      }
      setPageWarning(null);
      setPage(nextPage);
      setPreviewOpen(true);
      document.getElementById("document-preview")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    },
    [preview],
  );

  const changePage = useCallback((nextPage: number) => {
    setPageWarning(null);
    setPage(nextPage);
  }, []);

  const showSamples = useCallback(() => {
    resetInspection();
    window.setTimeout(() => {
      document.getElementById("samples")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }, [resetInspection]);

  return {
    selection,
    preview,
    run,
    banner,
    page,
    pageWarning,
    previewOpen,
    setPreviewOpen,
    focusTick,
    locked,
    sampleResult: selection.kind === "sample" ? getSampleResult(selection.id) : null,
    acceptFiles,
    handlePreviewReady,
    handlePreviewError,
    start,
    recheck,
    openSample,
    resetInspection,
    jumpToPage,
    showSamples,
    changePage,
  };
}
