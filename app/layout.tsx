import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Algarve Machinery Rental",
  description: "Heavy machinery and tools for rent in the Algarve area.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning data-theme="light-warm">
      {/* theme can be dark-industrial, dark-premium or light-warm */}
      <body className={cn("min-h-screen", geistSans.variable)}>{children}</body>
    </html>
  );
}
