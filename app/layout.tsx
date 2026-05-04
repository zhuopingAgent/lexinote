import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LexiNote - 日语词查询",
  description: "为中文母语者提供日语词条查询与 AI 补全",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const themeInitScript = `
(() => {
  try {
    const storedTheme = window.localStorage.getItem("lexinote-theme");
    document.documentElement.dataset.theme =
      storedTheme === "paper" || storedTheme === "dark" ? storedTheme : "dark";
  } catch {
    document.documentElement.dataset.theme = "dark";
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="antialiased">
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        {children}
      </body>
    </html>
  );
}
