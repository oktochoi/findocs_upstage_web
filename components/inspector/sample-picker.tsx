"use client";

import { sampleCatalog, type SampleId } from "@/lib/samples";

export function SamplePicker({
  selectedId,
  disabled,
  onSelect,
}: {
  selectedId: SampleId | null;
  disabled: boolean;
  onSelect: (id: SampleId) => void;
}) {
  return (
    <div id="samples" role="group" aria-label="예시 선택" className="mt-3 flex flex-wrap gap-2 scroll-mt-6">
      {sampleCatalog.map((sample) => {
        const selected = selectedId === sample.id;
        return (
          <button
            key={sample.id}
            type="button"
            disabled={disabled}
            aria-pressed={selected}
            onClick={() => onSelect(sample.id)}
            className={`inline-flex min-h-8 cursor-pointer items-center rounded-md border px-2.5 text-[13px] font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${
              selected ? "border-primary bg-[#EFF6FF] text-primary" : "border-line bg-white text-ink"
            }`}
          >
            {sample.name}
          </button>
        );
      })}
    </div>
  );
}
