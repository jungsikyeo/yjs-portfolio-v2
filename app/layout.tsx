import type { Metadata } from "next";
import "./globals.css";
import {AppearanceProvider} from "./theme-controls";

export const metadata: Metadata = {
  title: "YJS Portfolio",
  description: "경력, 프로젝트, 기술의 연결 관계를 탐색하는 포트폴리오.",
  openGraph: { title: "YJS Portfolio", description: "경력과 프로젝트, 기술의 연결을 탐색하세요.", locale: "ko_KR", type: "website" },
  twitter: { card: "summary", title: "YJS Portfolio", description: "경력과 프로젝트, 기술의 연결을 탐색하세요." },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className="antialiased"><AppearanceProvider>{children}</AppearanceProvider></body>
    </html>
  );
}
