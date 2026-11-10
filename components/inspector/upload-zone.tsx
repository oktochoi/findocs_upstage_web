"use client";

import { useRef, useState } from "react";
import { UploadIcon } from "@/components/inspector/icons";
import { Button } from "@/components/ui/button";

export function UploadZone({
  hint,
  onFiles,
  disabled,
}: {
  hint: string;
  onFiles: (files: FileList) => void;
  disabled: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const depth = useRef(0);
  const [dragging, setDragging] = useState(false);

  const openPicker = () => {
    if (!disabled) inputRef.current?.click();
  };

  return (
    <div
      data-dropzone
      className={`flex h-[300px] flex-col items-center justify-center rounded-xl border-2 border-dashed bg-white px-6 text-center ${
        dragging ? "border-primary bg-[#EFF6FF]" : "border-line"
      }`}
      onDragEnter={(event) => {
        event.preventDefault();
        if (disabled || !Array.from(event.dataTransfer.types).includes("Files")) return;
        depth.current += 1;
        setDragging(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        depth.current = Math.max(0, depth.current - 1);
        if (depth.current === 0) setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        depth.current = 0;
        setDragging(false);
        if (!disabled && event.dataTransfer.files.length > 0) onFiles(event.dataTransfer.files);
      }}
    >
      <UploadIcon size={32} className="text-primary" />
      <p className="mt-3 text-[16px] font-semibold">검사할 PDF를 올려주세요</p>
      <Button className="mt-4" onClick={openPicker} disabled={disabled}>
        PDF 선택
      </Button>
      <p className="mt-4 text-[13px] text-muted">{hint}</p>
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
  );
}
