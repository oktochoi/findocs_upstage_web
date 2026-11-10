/** 업로드 상한. null이면 용량 제한을 두지 않고 화면에도 표시하지 않습니다. */
export function getMaxUploadBytes(): number | null {
  return 20 * 1024 * 1024;
}
