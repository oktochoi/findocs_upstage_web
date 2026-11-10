"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { CloseIcon } from "@/components/inspector/icons";

const steps = [
  "PDF 문서를 선택합니다.",
  "분석을 시작합니다.",
  "위험도와 추가 검토 여부를 확인합니다.",
  "발견 위치를 보며 필요한 조치를 검토합니다.",
];

export function GuideModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    dialog?.focus();

    const focusable = () =>
      dialog
        ? [...dialog.querySelectorAll<HTMLElement>("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])")].filter(
            (element) => !element.hasAttribute("disabled"),
          )
        : [];

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previous?.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#172B4D]/40 px-4"
      onMouseDown={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="guide-title"
        tabIndex={-1}
        className="w-full max-w-md rounded-xl border border-line bg-white p-6 outline-none"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id="guide-title" className="text-[18px] font-semibold leading-[1.5]">
            이용 안내
          </h2>
          <button
            type="button"
            className="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg text-muted hover:bg-canvas"
            onClick={onClose}
            aria-label="닫기"
          >
            <CloseIcon />
          </button>
        </div>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">다음 순서로 문서를 검사합니다.</p>
        <ol className="mt-4 list-decimal space-y-3 pl-5 text-[15px] leading-relaxed">
          {steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <div className="mt-6 flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            닫기
          </Button>
        </div>
      </div>
    </div>
  );
}
