import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LexiNote - 日语词汇学习解释器",
  description: "为中文母语者提供日语词典查询与 AI 学习讲解",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
