import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { navInner } from "./helpers/twClasses";

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
        <link rel="icon" href="/favicon.png" sizes="32x32" />
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <div className="min-h-screen">
          <nav className="sticky top-0 z-50 border-b border-zinc-200 bg-white/60 backdrop-blur-sm">
            <div className={navInner}>
              <a
                href="https://github.com/v-olya/Ollama-playground"
                target="_blank"
                rel="noopener noreferrer"
                className="nav-link"
              >
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
              <Link href="/judge" className="nav-link">
                Judge
              </Link>
            </div>
          </nav>

          <div className="min-h-screen py-12">{children}</div>
        </div>
      </body>
    </html>
  );
}
