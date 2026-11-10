"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { Button } from "@/components/ui/button";

const ZOOMS = [1, 1.25, 1.5, 2, 3];

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
  const frameRef = useRef<HTMLDivElement>(null);
  const docRef = useRef<PDFDocumentProxy | null>(null);
  const onReadyRef = useRef(onReady);
  const onErrorRef = useRef(onError);
  const [zoomIndex, setZoomIndex] = useState(0);
  const [frameSize, setFrameSize] = useState({ width: 0, height: 0 });
  const [docVersion, setDocVersion] = useState(0);
  const [opening, setOpening] = useState(true);
  const [renderError, setRenderError] = useState(false);
  const zoom = ZOOMS[zoomIndex] ?? 1;

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
    const frame = frameRef.current;
    if (!frame) return;
    const update = () => {
      const next = { width: frame.clientWidth, height: frame.clientHeight };
      setFrameSize((current) => (current.width === next.width && current.height === next.height ? current : next));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    const doc = docRef.current;
    const canvas = canvasRef.current;
    if (!doc || !canvas || opening || frameSize.width < 2 || frameSize.height < 2) return;

    let cancelled = false;
    const renderState: { task: RenderTask | null } = { task: null };

    void (async () => {
      try {
        const pageProxy = await doc.getPage(page);
        if (cancelled) return;
        const base = pageProxy.getViewport({ scale: 1 });
        const fit = Math.min((frameSize.width - 16) / base.width, (frameSize.height - 16) / base.height);
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        const viewport = pageProxy.getViewport({ scale: Math.max(fit, 0.1) * zoom * pixelRatio });
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
  }, [page, zoom, visible, opening, docVersion, frameSize]);

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
            disabled={zoomIndex <= 0}
            onClick={() => setZoomIndex((current) => Math.max(0, current - 1))}
          >
            축소
          </Button>
          <p className="w-14 text-center text-[14px] tabular-nums">{zoom === 1 ? "맞춤" : `${Math.round(zoom * 100)}%`}</p>
          <Button
            variant="secondary"
            aria-label="확대"
            disabled={zoomIndex >= ZOOMS.length - 1}
            onClick={() => setZoomIndex((current) => Math.min(ZOOMS.length - 1, current + 1))}
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
      <div
        ref={frameRef}
        className={`mt-4 flex h-[calc(100dvh-13rem)] min-h-[420px] justify-center overflow-auto rounded-lg border border-line bg-canvas p-2 ${zoom > 1 ? "items-start" : "items-center"}`}
      >
        {opening ? <p className="text-[14px] text-muted">문서를 열고 있어요.</p> : null}
        {renderError ? (
          <p className="mb-3 text-[14px] text-muted" role="status">
            이 페이지를 그리지 못했어요. 다른 페이지로 이동해 보세요.
          </p>
        ) : null}
        <canvas
          ref={canvasRef}
          className={`shrink-0 border border-line bg-white ${opening ? "hidden" : "block"}`}
          role="img"
          aria-label={numPages ? `PDF ${page}쪽 미리보기` : "PDF 미리보기"}
        />
      </div>
    </div>
  );
}
