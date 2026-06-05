import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Rehub — Care requests, visible instantly",
  description:
    "Rehub is a communication and workflow platform that helps residents request support and helps care teams respond with clarity, speed, and accountability.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-offwhite text-navy antialiased">
        {children}
      </body>
    </html>
  );
}
