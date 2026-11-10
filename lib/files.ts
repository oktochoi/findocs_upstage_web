export function isPdfFile(file: { name: string; type: string }): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

export function hasPdfHeader(bytes: Uint8Array): boolean {
  const slice = bytes.subarray(0, Math.min(bytes.length, 1024));
  const text = new TextDecoder("latin1").decode(slice);
  return text.includes("%PDF-");
}
