"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { Button } from "@/components/ui/button";

const SCALES = [0.8, 1, 1.25, 1.5, 2];

async function loadPdfjs() {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
  return pdfjs;
}

export function PdfViewport({
  data,
  page,
  numPages,
  visible,
  pageWarning,
  onReady,
  onError,
  onPageChange,
}: {
  data: Uint8Array;
  page: number;
  numPages: number | null;
  visible: boolean;
  pageWarning: string | null;
  onReady: (numPages: number) => void;
  onError: () => void;
  onPageChange: (page: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const docRef = useRef<PDFDocumentProxy | null>(null);
  const onReadyRef = useRef(onReady);
  const onErrorRef = useRef(onError);
  const [scaleIndex, setScaleIndex] = useState(1);
  const [docVersion, setDocVersion] = useState(0);
  const [opening, setOpening] = useState(true);
  const [renderError, setRenderError] = useState(false);
  const scale = SCALES[scaleIndex] ?? 1;

  useEffect(() => {
    onReadyRef.current = onReady;
    onErrorRef.current = onError;
  });

  useEffect(() => {
    let cancelled = false;
    let loadingTask: PDFDocumentLoadingTask | null = null;

    void (async () => {
      try {
        const pdfjs = await loadPdfjs();
        if (cancelled) return;
        const task = pdfjs.getDocument({
          data: data.slice(),
          cMapUrl: "/pdfjs/cmaps/",
          cMapPacked: true,
          standardFontDataUrl: "/pdfjs/standard_fonts/",
        });
        loadingTask = task;
        const doc = await task.promise;
        if (cancelled) {
          await task.destroy();
          return;
        }
        docRef.current = doc;
        setDocVersion((version) => version + 1);
        setOpening(false);
        onReadyRef.current(doc.numPages);
      } catch {
        if (!cancelled) onErrorRef.current();
      }
    })();

    return () => {
      cancelled = true;
      const current = docRef.current;
      docRef.current = null;
      if (current) {
        void current.loadingTask.destroy();
      } else {
        void loadingTask?.destroy();
      }
    };
  }, [data]);

  useEffect(() => {
    if (!visible) return;
    const doc = docRef.current;
    const canvas = canvasRef.current;
    if (!doc || !canvas || opening) return;

    let cancelled = false;
    const renderState: { task: RenderTask | null } = { task: null };

    void (async () => {
      try {
        const pageProxy = await doc.getPage(page);
        if (cancelled) return;
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        const viewport = pageProxy.getViewport({ scale: scale * pixelRatio });
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = `${Math.floor(viewport.width / pixelRatio)}px`;
        canvas.style.height = `${Math.floor(viewport.height / pixelRatio)}px`;
        const task = pageProxy.render({ canvas, viewport });
        renderState.task = task;
        await task.promise;
        if (!cancelled) setRenderError(false);
      } catch (error) {
        if (cancelled) return;
        const name = error instanceof Error ? error.name : "";
        if (name === "RenderingCancelledException") return;
        setRenderError(true);
      }
    })();

    return () => {
      cancelled = true;
      renderState.task?.cancel();
    };
  }, [page, scale, visible, opening, docVersion]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          aria-label="이전 페이지"
          disabled={!numPages || page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          이전 페이지
        </Button>
        <p className="min-w-16 text-center text-[14px] tabular-nums" aria-live="polite">
          {numPages ? `${page} / ${numPages}` : "확인 중"}
        </p>
        <Button
          variant="secondary"
          aria-label="다음 페이지"
          disabled={!numPages || page >= numPages}
          onClick={() => onPageChange(page + 1)}
        >
          다음 페이지
        </Button>
        <div className="flex items-center gap-2 lg:ml-auto">
          <Button
            variant="secondary"
            aria-label="축소"
            disabled={scaleIndex <= 0}
            onClick={() => setScaleIndex((current) => Math.max(0, current - 1))}
          >
            축소
          </Button>
          <p className="w-14 text-center text-[14px] tabular-nums">{Math.round(scale * 100)}%</p>
          <Button
            variant="secondary"
            aria-label="확대"
            disabled={scaleIndex >= SCALES.length - 1}
            onClick={() => setScaleIndex((current) => Math.min(SCALES.length - 1, current + 1))}
          >
            확대
          </Button>
        </div>
      </div>
      {pageWarning ? (
        <p className="mt-3 text-[14px] leading-relaxed text-muted" role="status">
          {pageWarning}
        </p>
      ) : null}
      <div className="mt-4 max-h-[720px] overflow-auto rounded-lg border border-line bg-canvas p-4">
        {opening ? <p className="text-[14px] text-muted">문서를 열고 있어요.</p> : null}
        {renderError ? (
          <p className="mb-3 text-[14px] text-muted" role="status">
            이 페이지를 그리지 못했어요. 다른 페이지로 이동해 보세요.
          </p>
        ) : null}
        <canvas
          ref={canvasRef}
          className={`mx-auto border border-line bg-white ${opening ? "hidden" : "block"}`}
          role="img"
          aria-label={numPages ? `PDF ${page}쪽 미리보기` : "PDF 미리보기"}
        />
      </div>
    </div>
  );
}
