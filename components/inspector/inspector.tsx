"use client";

import { useEffect, useRef, useState } from "react";
import { DocumentCard } from "@/components/inspector/document-card";
import { DocumentIcon, InfoIcon } from "@/components/inspector/icons";
import { ResultCard } from "@/components/inspector/result-card";
import { SamplePicker } from "@/components/inspector/sample-picker";
import { UploadZone } from "@/components/inspector/upload-zone";
import { useInspection } from "@/components/inspector/use-inspection";
import { getMaxUploadBytes } from "@/lib/config";
import { formatBytes } from "@/lib/format";
import { sampleCatalog } from "@/lib/samples";

export function Inspector() {
  const inspection = useInspection();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [analysisConfigured, setAnalysisConfigured] = useState<boolean | null>(null);
  const [missingEnv, setMissingEnv] = useState<string[]>([]);
  const limit = getMaxUploadBytes();
  const uploadHint = limit == null ? "PDF" : `PDF · 최대 ${formatBytes(limit)}`;
  const hasFile = inspection.selection.kind === "file";
  const showSamples = !hasFile;
  const sampleName =
    inspection.selection.kind === "sample"
      ? sampleCatalog.find((sample) => sample.id === inspection.selection.id)?.name
      : null;
  const documentName = hasFile ? inspection.selection.file.name : sampleName;
  const showingResult = Boolean(inspection.sampleResult) || inspection.run.status === "completed";

  useEffect(() => {
    if (inspection.focusTick === 0) return;
    headingRef.current?.focus();
    headingRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [inspection.focusTick]);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const response = await fetch("/api/config", { cache: "no-store", signal: controller.signal });
        if (!response.ok) return;
        const data = (await response.json()) as { configured?: unknown; missing?: unknown };
        if (typeof data.configured !== "boolean" || !Array.isArray(data.missing)) return;
        const missing = data.missing.filter((item): item is string => typeof item === "string");
        if (controller.signal.aborted) return;
        setAnalysisConfigured(data.configured);
        setMissingEnv(missing);
      } catch {
        // 연결 상태를 아직 모르면 배너를 띄우지 않습니다. 검사 시작 응답이 누락된 환경변수를 안내합니다.
      }
    };
    void load();
    return () => controller.abort();
  }, []);

  const documentColumn = hasFile ? (
    <DocumentCard
      selection={inspection.selection}
      preview={inspection.preview}
      page={inspection.page}
      pageWarning={inspection.pageWarning}
      locked={inspection.locked}
      previewVisible
      banner={inspection.banner}
      onFiles={inspection.acceptFiles}
      onReady={inspection.handlePreviewReady}
      onPreviewError={inspection.handlePreviewError}
      onPageChange={inspection.changePage}
    />
  ) : null;

  const resultColumn =
    hasFile || inspection.sampleResult ? (
      <ResultCard
        selection={inspection.selection}
        preview={inspection.preview}
        run={inspection.run}
        sampleResult={inspection.sampleResult}
        onStart={inspection.start}
        onRecheck={inspection.recheck}
        onReset={inspection.resetInspection}
        onShowSamples={inspection.showSamples}
        onJump={inspection.jumpToPage}
        startDisabled={inspection.locked}
      />
    ) : null;

  return (
    <div className="min-h-full bg-canvas text-ink">
      <a
        href="#main"
        className="absolute top-3 left-4 z-50 -translate-y-20 rounded-lg bg-white px-4 py-2 text-[14px] font-semibold focus:translate-y-0"
      >
        본문으로 건너뛰기
      </a>
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-3 px-4">
          <button
            type="button"
            className="flex min-w-0 cursor-pointer items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={inspection.resetInspection}
            disabled={inspection.locked}
          >
            <span className="grid size-7 shrink-0 place-items-center rounded-md bg-primary text-white">
              <DocumentIcon size={16} />
            </span>
            <span className="truncate text-[16px] font-semibold">문서안심</span>
          </button>
          <button
            type="button"
            className="inline-flex h-9 shrink-0 cursor-pointer items-center rounded-lg border border-line bg-white px-3 text-[14px] font-semibold disabled:cursor-not-allowed disabled:opacity-50"
            onClick={inspection.resetInspection}
            disabled={inspection.locked}
          >
            + 새 검사
          </button>
        </div>
      </header>

      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1200px] px-4 py-6">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <h1
            ref={headingRef}
            tabIndex={-1}
            className={`min-w-0 text-[28px] leading-[1.3] font-bold outline-none ${documentName ? "break-all" : ""}`}
          >
            {documentName ?? "금융문서 민감정보 검사"}
          </h1>
          {inspection.sampleResult ? (
            <span className="inline-flex h-6 items-center rounded-md border border-line bg-[#F8FAFC] px-2 text-[12px] font-semibold text-[#475569]">
              저장된 예시
            </span>
          ) : null}
          {!inspection.sampleResult && inspection.run.status === "completed" ? (
            <span className="inline-flex h-6 items-center rounded-md border border-[#BFDBFE] bg-[#EFF6FF] px-2 text-[12px] font-semibold text-[#1D4ED8]">
              실시간 분석
            </span>
          ) : null}
        </div>
        {inspection.sampleResult ? <p className="mt-1 text-[13px] text-muted">원본 PDF 미제공</p> : null}
        {showSamples ? (
          <SamplePicker
            selectedId={inspection.selection.kind === "sample" ? inspection.selection.id : null}
            disabled={inspection.locked}
            onSelect={inspection.openSample}
          />
        ) : null}

        {analysisConfigured === false ? (
          <p className="mt-3 flex items-start gap-2 text-[14px] leading-relaxed text-muted" role="status">
            <InfoIcon className="mt-0.5 shrink-0" />
            <span>
              실시간 분석은 연결되지 않았습니다.
              {missingEnv.length > 0 ? ` 서버 환경변수 ${missingEnv.join(", ")} 설정이 필요합니다.` : ""}
            </span>
          </p>
        ) : null}

        {showingResult ? (
          <div className="mt-6">
            {resultColumn}
            {hasFile ? (
              <div id="document-preview" className="mt-4">
                {documentColumn}
              </div>
            ) : null}
          </div>
        ) : hasFile ? (
          <div id="document-preview" className="mt-6 grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
            {documentColumn}
            {resultColumn}
          </div>
        ) : (
          <div className="mt-6">
            <UploadZone hint={uploadHint} disabled={inspection.locked} onFiles={inspection.acceptFiles} />
            {inspection.banner ? (
              <p className="mt-3 text-[14px] text-ink" role="alert">
                {inspection.banner.message}
              </p>
            ) : null}
          </div>
        )}
      </main>
    </div>
  );
}
