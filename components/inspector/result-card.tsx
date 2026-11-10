"use client";

import { useEffect, useState } from "react";
import type { PreviewState, RunState, SelectionState } from "@/components/inspector/inspection-model";
import { AlertIcon, ChevronIcon, InfoIcon } from "@/components/inspector/icons";
import { Button } from "@/components/ui/button";
import { formatElapsed, reviewLabel } from "@/lib/format";
import { messages, stageLabels } from "@/lib/messages";
import { parseLocation } from "@/lib/parse-location";
import { reviewBadgeStyles, riskStyles } from "@/lib/risk-style";
import type { AnalysisResult, ValidationInfo } from "@/lib/types";

export function ResultCard({
  selection,
  preview,
  run,
  sampleResult,
  onStart,
  onRecheck,
  onReset,
  onShowSamples,
  onJump,
  startDisabled,
}: {
  selection: SelectionState;
  preview: PreviewState;
  run: RunState;
  sampleResult: AnalysisResult | null;
  onStart: () => void;
  onRecheck: () => void;
  onReset: () => void;
  onShowSamples: () => void;
  onJump: (page: number) => void;
  startDisabled: boolean;
}) {
  const canJump = selection.kind === "file" && preview.status === "ready" && preview.numPages != null;

  if (sampleResult) {
    return <AnalysisResultView result={sampleResult} source="sample" canJump={false} onJump={onJump} />;
  }

  if (run.status === "completed") {
    return (
      <AnalysisResultView
        result={run.result}
        source="live"
        validation={run.validation}
        canJump={canJump}
        onJump={onJump}
      />
    );
  }

  return (
    <section className="rounded-xl border border-line bg-white p-4" aria-label="검사 상태">
      <div>
        {selection.kind === "file" && preview.status === "loading" ? (
          <StatusCopy title="문서를 확인하고 있어요" message="미리보기가 준비되면 검사를 시작할 수 있어요." />
        ) : null}

        {selection.kind === "file" && preview.status === "error" ? (
          <StatusCopy title="검사를 시작할 수 없어요" message={messages.unreadablePdf} />
        ) : null}

        {selection.kind === "file" && preview.status === "ready" && (run.status === "idle" || run.status === "ready") ? (
          <ReadyState canStart={preview.numPages != null && !startDisabled} onStart={onStart} />
        ) : null}

        {run.status === "uploading" || run.status === "active" ? (
          <ProgressState
            stage={run.status === "uploading" ? "uploading" : run.stage}
            startedAt={run.startedAt}
          />
        ) : null}

        {run.status === "poll_error" ? (
          <div className="space-y-4">
            <MessageBlock tone="error" title="상태를 확인하지 못했어요" message={run.message} />
            <p className="text-[14px] text-muted">마지막 확인 상태는 {stageLabels[run.stage]}입니다.</p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={onRecheck}>상태 다시 확인</Button>
              <Button variant="secondary" onClick={onReset}>
                새 문서 검사
              </Button>
            </div>
          </div>
        ) : null}

        {run.status === "unavailable" ? (
          <div className="space-y-4">
            <MessageBlock tone="info" title="실시간 분석을 사용할 수 없어요" message={run.message} />
            <div className="flex flex-wrap gap-2">
              <Button onClick={onShowSamples}>예시 결과 보기</Button>
              <Button variant="secondary" onClick={onStart} disabled={startDisabled}>
                민감정보 검사 시작
              </Button>
            </div>
          </div>
        ) : null}

        {run.status === "upload_error" ? (
          <div className="space-y-4">
            <MessageBlock tone="error" title="파일을 업로드하지 못했어요" message={run.message} />
            <Button onClick={onStart} disabled={startDisabled}>
              민감정보 검사 시작
            </Button>
          </div>
        ) : null}

        {run.status === "start_error" ? (
          <div className="space-y-4">
            <MessageBlock tone="error" title="분석을 시작하지 못했어요" message={run.message} />
            <Button onClick={onStart} disabled={startDisabled}>
              민감정보 검사 시작
            </Button>
          </div>
        ) : null}

        {run.status === "job_failed" ? (
          <div className="space-y-4">
            <MessageBlock tone="error" title="분석을 완료하지 못했어요" message={run.message} />
            <div className="flex flex-wrap gap-2">
              <Button onClick={onStart} disabled={startDisabled}>분석 다시 시작</Button>
              <Button variant="secondary" onClick={onReset}>
                새 문서 검사
              </Button>
            </div>
          </div>
        ) : null}

        {run.status === "invalid_result" ? (
          <div className="space-y-4">
            <MessageBlock tone="error" title="분석 결과를 불러오지 못했어요" message={run.message} />
            <div className="flex flex-wrap gap-2">
              <Button onClick={onRecheck}>상태 다시 확인</Button>
              <Button variant="secondary" onClick={onReset}>
                새 문서 검사
              </Button>
            </div>
          </div>
        ) : null}

      </div>
    </section>
  );
}

function ReadyState({ canStart, onStart }: { canStart: boolean; onStart: () => void }) {
  return (
    <Button onClick={onStart} disabled={!canStart}>
      민감정보 검사 시작
    </Button>
  );
}

function ProgressState({
  stage,
  startedAt,
}: {
  stage: "uploading" | "queued" | "in_progress";
  startedAt: number;
}) {
  return (
    <div className="flex min-h-[280px] flex-col justify-center">
      <div className="flex items-center gap-3">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-primary" aria-hidden="true" />
        <p className="text-[18px] font-semibold" aria-live="polite">
          {stageLabels[stage]}
        </p>
      </div>
      <ElapsedTime startedAt={startedAt} />
      <p className="mt-3 text-[14px] leading-relaxed text-muted">문서에 따라 분석에 몇 분이 걸릴 수 있어요.</p>
    </div>
  );
}

function ElapsedTime({ startedAt }: { startedAt: number }) {
  const [label, setLabel] = useState("00:00");

  useEffect(() => {
    const update = () => setLabel(formatElapsed(Date.now() - startedAt));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [startedAt]);

  return <p className="mt-4 text-[15px] font-semibold tabular-nums">{label} 경과</p>;
}

function StatusCopy({ title, message }: { title: string; message: string }) {
  return (
    <div>
      <h3 className="text-[18px] font-semibold leading-[1.5]">{title}</h3>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">{message}</p>
    </div>
  );
}

function MessageBlock({ tone, title, message }: { tone: "info" | "error"; title: string; message: string }) {
  const Icon = tone === "error" ? AlertIcon : InfoIcon;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-xl border p-4 ${tone === "error" ? "border-[#FECACA] bg-[#FFFBFB]" : "border-line bg-[#F8FAFC]"}`}
    >
      <div className="flex gap-3">
        <Icon className="mt-0.5 shrink-0 text-muted" />
        <div className="min-w-0">
          <p className="text-[15px] font-semibold">{title}</p>
          <p className="mt-1 text-[14px] leading-relaxed break-words text-muted">{message}</p>
        </div>
      </div>
    </div>
  );
}

function AnalysisResultView({
  result,
  source,
  validation,
  canJump,
  onJump,
}: {
  result: AnalysisResult;
  source: "live" | "sample";
  validation?: ValidationInfo;
  canJump: boolean;
  onJump: (page: number) => void;
}) {
  const style = riskStyles[result.risk_grade];
  const review = reviewLabel(result.needs_review);
  const hasPageJump = result.locations.some((location) => parseLocation(location).page != null);
  const summary = `${source === "live" ? "실시간 분석" : "저장된 예시"}. 민감정보 위험도 ${result.risk_grade}. ${review}.`;

  return (
    <div>
      <p className="sr-only">{summary}</p>
      {validation?.status === "fail" ? (
        <div className="mb-4">
          <h2 className="text-[18px] leading-snug font-semibold">분석 완료 · 결과 검토 필요</h2>
          <span className="mt-2 inline-flex h-6 items-center rounded-md border border-line bg-[#F8FAFC] px-2 text-[12px] font-semibold text-[#475569]">
            미검증 결과
          </span>
          {validation.reasons.length > 0 ? (
            <ul className="mt-3 space-y-2 border-t border-line pt-3">
              {validation.reasons.map((reason, index) => (
                <li key={`${index}-${reason.slice(0, 24)}`} className="text-[14px] leading-relaxed break-words text-ink">
                  {reason}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {validation?.status === "unknown" ? (
        <p className="mb-4 text-[14px] text-muted">검증 상태 확인 불가</p>
      ) : null}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,13fr)]">
      <section className="overflow-hidden rounded-xl border border-line bg-white" aria-label="판정 요약">
        <div className={`h-0.5 ${style.bar}`} />
        <div className="px-5 py-5">
          <p className="text-[13px] text-muted">위험도</p>
          <p className={`mt-2 text-[40px] leading-none font-bold ${style.text}`}>{result.risk_grade}</p>
          <span
            className={`mt-4 inline-flex min-h-7 items-center rounded-md border px-2.5 text-[13px] font-semibold ${
              result.needs_review ? reviewBadgeStyles.needed : reviewBadgeStyles.clear
            }`}
          >
            {review}
          </span>
          <p className="mt-5 text-[13px] text-muted">권장 조치</p>
          <p className="mt-1 text-[15px] leading-relaxed break-words whitespace-pre-wrap">
            {result.action.trim() || "권장 조치 문구가 포함되지 않았습니다."}
          </p>
        </div>
      </section>

      <section className="min-w-0 rounded-xl border border-line bg-white px-5 py-4" aria-label="발견 항목">
        {result.locations.length === 0 ? (
          <p className="py-2 text-[14px] leading-relaxed text-muted">확인이 필요한 위치가 없습니다.</p>
        ) : (
          <>
            {hasPageJump && canJump ? (
              <p className="pb-1 text-[12px] text-muted">페이지를 누르면 해당 쪽으로 이동합니다.</p>
            ) : null}
            <div className="grid grid-cols-[4.5rem_minmax(0,1fr)_minmax(4.5rem,auto)] gap-3 border-b border-line py-2 text-[12px] text-muted">
              <span>페이지</span>
              <span>항목</span>
              <span>노출 상태</span>
            </div>
            <ul className="divide-y divide-line">
              {result.locations.map((location, index) => {
                const parsed = parseLocation(location);
                const clickable = parsed.page != null && canJump;
                const pageLabel = parsed.page != null ? `${parsed.page}쪽` : "—";
                const item = parsed.title || parsed.raw;
                const exposure = parsed.exposure || "—";
                const rowClass =
                  "grid w-full grid-cols-[4.5rem_minmax(0,1fr)_minmax(4.5rem,auto)] gap-3 py-2.5 text-left text-[14px]";
                return (
                  <li key={`${location}-${index}`}>
                    {clickable ? (
                      <button type="button" className={`${rowClass} cursor-pointer`} onClick={() => onJump(parsed.page as number)}>
                        <span className="font-semibold text-primary">{pageLabel}</span>
                        <span className="min-w-0 break-words">{item}</span>
                        <span className="text-muted">{exposure}</span>
                      </button>
                    ) : (
                      <div className={rowClass}>
                        <span>{pageLabel}</span>
                        <span className="min-w-0 break-words">{item}</span>
                        <span className="text-muted">{exposure}</span>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}

        <details className="group mt-3 border-t border-line">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-[14px] font-semibold">
            자세한 근거
            <ChevronIcon className="text-muted transition-transform group-open:rotate-180" />
          </summary>
          <div className="space-y-3 pb-2">
            <div>
              <p className="text-[13px] text-muted">발견된 민감정보</p>
              {result.sensitive_items.length === 0 ? (
                <p className="mt-1 text-[15px]">탐지된 민감정보가 없습니다</p>
              ) : (
                <ul className="mt-2 flex flex-wrap gap-2">
                  {result.sensitive_items.map((item, index) => (
                    <li key={`${item}-${index}`} className="rounded-md bg-canvas px-2 py-1 text-[14px] break-all">
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <p className="text-[13px] text-muted">판단 근거</p>
              <p className="mt-1 text-[15px] leading-relaxed break-words whitespace-pre-wrap">
                {result.reason.trim() || "판단 근거가 포함되지 않았습니다."}
              </p>
            </div>
            {result.needs_review && result.review_reason.trim() ? (
              <div>
                <p className="text-[13px] text-muted">추가 검토 사유</p>
                <p className="mt-1 text-[15px] leading-relaxed break-words whitespace-pre-wrap">{result.review_reason}</p>
              </div>
            ) : null}
            <div>
              <p className="text-[13px] text-muted">적용 규칙</p>
              <p className="mt-1 text-[15px] break-words">{result.applied_rule.trim() || "포함된 규칙 정보가 없습니다."}</p>
            </div>
          </div>
        </details>
      </section>
      </div>
    </div>
  );
}
