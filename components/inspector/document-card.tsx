"use client";

import { useRef, useState } from "react";
import type { PreviewState, SelectionState } from "@/components/inspector/inspection-model";
import { DocumentIcon } from "@/components/inspector/icons";
import { PdfViewport } from "@/components/inspector/pdf-viewport";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/format";
import { messages } from "@/lib/messages";

export function DocumentCard({
  selection,
  preview,
  page,
  pageWarning,
  locked,
  previewVisible,
  banner,
  onFiles,
  onReady,
  onPreviewError,
  onPageChange,
}: {
  selection: SelectionState;
  preview: PreviewState;
  page: number;
  pageWarning: string | null;
  locked: boolean;
  previewVisible: boolean;
  banner: { tone: "error" | "info"; message: string } | null;
  onFiles: (files: FileList | File[]) => void;
  onReady: (numPages: number) => void;
  onPreviewError: () => void;
  onPageChange: (page: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  if (selection.kind !== "file") return null;

  return (
    <section className="rounded-xl border border-line bg-white p-4" aria-labelledby="document-card-title">
      <h2 id="document-card-title" className="text-[16px] font-semibold leading-[1.5]">
        미리보기
      </h2>
      <div className="mt-3">
        <div>
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <DocumentIcon className="mt-0.5 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <FileName name={selection.file.name} />
                  <p className="mt-1 text-[13px] text-muted">{formatBytes(selection.file.size)}</p>
                </div>
              </div>
              <Button
                variant="secondary"
                className="shrink-0"
                onClick={() => inputRef.current?.click()}
                disabled={locked}
              >
                파일 변경
              </Button>
              <input
                ref={inputRef}
                type="file"
                accept="application/pdf,.pdf"
                tabIndex={-1}
                aria-hidden="true"
                className="sr-only"
                onChange={(event) => {
                  if (event.target.files) onFiles(event.target.files);
                  event.target.value = "";
                }}
              />
            </div>
            {banner ? (
              <p
                className={`mt-3 text-[14px] leading-relaxed ${banner.tone === "error" ? "text-ink" : "text-muted"}`}
                role={banner.tone === "error" ? "alert" : "status"}
              >
                {banner.message}
              </p>
            ) : null}
            <div className="mt-4">
              {preview.status === "loading" ? (
                <div className="flex min-h-[240px] items-center justify-center rounded-lg border border-line bg-canvas px-6 text-center">
                  <p className="text-[15px] text-muted">문서를 확인하고 있어요.</p>
                </div>
              ) : null}
              {preview.status === "error" ? (
                <div className="flex min-h-[240px] flex-col items-center justify-center rounded-lg border border-line bg-canvas px-6 text-center">
                  <p className="text-[16px] font-semibold">{messages.unreadablePdf}</p>
                  <p className="mt-2 text-[14px] leading-relaxed text-muted">
                    위쪽의 파일 변경으로 다른 PDF를 선택해주세요.
                  </p>
                </div>
              ) : null}
              {preview.status === "ready" ? (
                <PdfViewport
                  key={`${selection.file.name}:${selection.file.size}:${selection.file.lastModified}`}
                  data={preview.data}
                  page={page}
                  numPages={preview.numPages}
                  visible={previewVisible}
                  pageWarning={pageWarning}
                  onReady={onReady}
                  onError={onPreviewError}
                  onPageChange={onPageChange}
                />
              ) : null}
            </div>
          </div>
        </div>
    </section>
  );
}

export function FileName({ name }: { name: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <button
      type="button"
      className={`w-full cursor-pointer text-left text-[15px] font-semibold ${expanded ? "break-all" : "truncate"}`}
      aria-expanded={expanded}
      title={name}
      onClick={() => setExpanded((current) => !current)}
    >
      <span className="sr-only">{expanded ? "파일명 접기" : "파일명 전체 보기"}: </span>
      {name}
    </button>
  );
}
