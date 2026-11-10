import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "문서안심",
  description: "전송 전, 금융문서의 민감정보를 확인하세요.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full">
      <body className="min-h-full bg-canvas font-sans text-ink antialiased">{children}</body>
    </html>
  );
}
