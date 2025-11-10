import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ollama models to compare",
  description: "Model comparison playground",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.svg" sizes="any" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <div className="min-h-screen">
          <nav className="mx-auto max-w-6xl flex items-center justify-start space-x-4 border-b border-zinc-200 bg-white/60 backdrop-blur-sm px-4 py-3">
            <a href="https://github.com/v-olya/olla" target="_blank" rel="noopener noreferrer" className="nav-link">
              GitHub Repo
            </a>
            <Link href="/" className="nav-link">
              Home
            </Link>
            <Link href="/compare" className="nav-link">
              Compare
            </Link>

            <Link href="/clash" className="nav-link">
              Clash
            </Link>
          </nav>

          <div className="min-h-screen py-12">{children}</div>
        </div>
      </body>
    </html>
  );
}
