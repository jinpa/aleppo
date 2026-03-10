import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { SessionProvider } from "next-auth/react";

export const metadata: Metadata = {
  title: {
    default: "Aleppo — Your Cooking Diary",
    template: "%s | Aleppo",
  },
  description:
    "Save recipes, log every cook, and follow friends to see what they've been cooking. Your cooking life, organized.",
  keywords: ["recipes", "cooking diary", "cook log", "recipe management"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-stone-50 antialiased">
        <SessionProvider>
          {children}
          <Toaster />
        </SessionProvider>
      </body>
    </html>
  );
}
