import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LexiNote - 日语词查询",
  description: "为中文母语者提供日语词条查询与 AI 补全",
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
