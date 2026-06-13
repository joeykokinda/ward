import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

// JetBrains Mono is the data/log typeface. The CSS var keeps its historical
// name (--font-mono-geist) so every `.mono` / `var(--font-mono-geist)` usage
// across the app picks it up with no further edits.
const jetBrainsMono = JetBrains_Mono({
  variable: "--font-mono-geist",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "WARD · the autonomous agent for your home",
  description:
    "WARD watches every device in your home, fixes what it can, and hires a verified human when it can't — settling in USDC on machine-attested telemetry. Proof-of-physical-work escrow on Arc.",
};

export const viewport: Viewport = {
  themeColor: "#0a0a0f",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetBrainsMono.variable} h-full`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
