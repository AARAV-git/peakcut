import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Peakcut — Learning to Rank Video Highlights",
  description:
    "Peakcut is a video highlight detection system that ranks the most important moments in long-form video using a learning-to-rank model, with LLM-generated titles and summaries.",
  keywords: [
    "Peakcut",
    "video highlight detection",
    "learning to rank",
    "video summarization",
    "TVSum",
    "SumMe",
    "machine learning",
  ],
  authors: [{ name: "Peakcut" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
