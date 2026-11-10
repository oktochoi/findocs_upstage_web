import rawSamples from "@/data/결과_예시.json";
import type { AnalysisResult } from "@/lib/types";
import { parseAnalysisResult } from "@/lib/validate-result";

export const sampleCatalog = [
  {
    id: "set01",
    name: "주민등록번호가 보이는 문서",
    label: "매우 높음 예시",
    description: "식별정보가 그대로 보이는 결과",
  },
  {
    id: "set11",
    name: "계좌번호가 보이는 문서",
    label: "높음 예시",
    description: "계좌번호가 보이는 결과",
  },
  {
    id: "set12",
    name: "연락처가 있는 문서",
    label: "보통 · 추가 검토 예시",
    description: "위험도와 별개로 검토가 필요한 결과",
  },
  {
    id: "set08",
    name: "민감정보가 없는 문서",
    label: "민감정보 없음 예시",
    description: "탐지된 항목이 없는 결과",
  },
] as const;

export type SampleId = (typeof sampleCatalog)[number]["id"];

const results = {} as Record<SampleId, AnalysisResult>;

for (const sample of sampleCatalog) {
  const parsed = parseAnalysisResult(rawSamples[sample.id]);
  if (!parsed) {
    throw new Error(`저장된 예시 ${sample.id}의 결과 형식이 올바르지 않습니다.`);
  }
  results[sample.id] = parsed;
}

export function getSampleResult(id: SampleId): AnalysisResult {
  return results[id];
}
