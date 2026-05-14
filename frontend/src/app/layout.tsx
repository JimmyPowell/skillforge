import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Sidebar } from "@/components/layout/Sidebar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "SkillForge",
  description:
    "AI Skill Development & Benchmarking Platform — develop, evaluate, and iterate on AI skills with automated benchmarking.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-slate-50 font-sans">
        <Providers>
          <Sidebar />
          <main className="min-h-screen p-6 pt-16 lg:pt-8 lg:ml-64 lg:p-8 transition-all duration-300">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
