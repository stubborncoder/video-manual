import type { Metadata } from "next";
import { DM_Sans, DM_Serif_Display } from "next/font/google";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { I18nProvider } from "@/components/providers/I18nProvider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const dmSerifDisplay = DM_Serif_Display({
  variable: "--font-dm-serif-display",
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "vDocs - AI-powered documentation from video",
  description: "AI-powered documentation from video",
  icons: {
    icon: "/vdocs-icon-branded.svg",
    shortcut: "/vdocs-icon-branded.svg",
    apple: "/vdocs-logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${dmSans.variable} ${dmSerifDisplay.variable} antialiased min-h-screen bg-background`}
      >
        <I18nProvider>
          <ThemeProvider>
            {children}
            <Toaster richColors position="top-right" />
          </ThemeProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
