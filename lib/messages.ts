export const messages = {
  notPdf: "PDF 파일을 선택해주세요.",
  uploadFailed: "파일을 업로드하지 못했어요. 연결을 확인하고 다시 시도해주세요.",
  resultInvalid: "분석 결과를 불러오지 못했어요. 다시 확인해주세요.",
  statusUnavailable: "분석 상태를 확인하지 못했어요. 잠시 후 다시 확인해주세요.",
  analysisFailed: "문서 분석을 완료하지 못했어요. 다시 시도해주세요.",
  unreadablePdf: "이 PDF를 열 수 없어요. 다른 파일을 선택해주세요.",
  analysisStartFailed: "분석을 시작하지 못했어요. 잠시 후 다시 시도해주세요.",
  validationFailed: "최종 검증을 통과하지 못한 결과라 정상 판정으로 표시하지 않습니다.",
  notConfigured:
    "실시간 분석 서버가 연결되지 않았어요. 저장된 예시로 결과 화면을 확인할 수 있어요.",
  jobNotFound: "분석 작업을 찾지 못했어요. 분석을 다시 시작해주세요.",
  missingEnv(names: string[]) {
    return `서버 환경변수 ${names.join(", ")} 설정이 필요합니다.`;
  },
  tooLarge(limit: string) {
    return `파일 크기가 ${limit}를 넘어요. 더 작은 PDF를 선택해주세요.`;
  },
};

export const stageLabels = {
  uploading: "파일 업로드 중",
  queued: "분석 대기 중",
  in_progress: "문서 분석 중",
} as const;
