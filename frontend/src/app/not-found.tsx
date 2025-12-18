"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Home, ArrowLeft, Search, FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VDocsIcon } from "@/components/ui/VDocsIcon";
import { VDocsText } from "@/components/ui/vdocs-text";

export default function NotFound() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background geometric pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Gradient mesh background */}
        <div
          className="absolute top-0 left-0 w-full h-full opacity-[0.03]"
          style={{
            backgroundImage: `
              radial-gradient(ellipse 80% 50% at 20% 40%, var(--primary) 0%, transparent 50%),
              radial-gradient(ellipse 60% 40% at 80% 60%, var(--primary) 0%, transparent 50%)
            `,
          }}
        />

        {/* Grid lines */}
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `
              linear-gradient(var(--foreground) 1px, transparent 1px),
              linear-gradient(90deg, var(--foreground) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px',
          }}
        />

        {/* Floating geometric elements */}
        {mounted && (
          <>
            <div
              className="absolute w-96 h-96 border border-primary/10 rounded-full animate-float-1"
              style={{ top: '10%', right: '5%' }}
            />
            <div
              className="absolute w-64 h-64 border border-primary/5 rounded-full animate-float-2"
              style={{ bottom: '15%', left: '10%' }}
            />
            <div
              className="absolute w-32 h-32 bg-primary/5 rounded-lg rotate-45 animate-float-3"
              style={{ top: '60%', right: '15%' }}
            />
          </>
        )}
      </div>

      {/* Content */}
      <div
        className={`relative z-10 flex flex-col items-center text-center px-6 max-w-xl transition-all duration-700 ${
          mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}
      >
        {/* Logo */}
        <Link
          href="/"
          className="group mb-12 flex items-center gap-3 transition-transform hover:scale-105"
        >
          <VDocsIcon branded className="w-10 h-10" />
          <VDocsText className="font-display text-2xl tracking-tight text-foreground" />
        </Link>

        {/* Error code with decorative treatment */}
        <div className="relative mb-8">
          <span
            className="block font-display text-[10rem] md:text-[14rem] leading-none tracking-tighter text-primary/10 select-none"
            style={{ fontWeight: 400 }}
          >
            404
          </span>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-background/80 backdrop-blur-sm px-6 py-3 rounded-lg border border-border">
              <FileQuestion className="w-12 h-12 text-primary mx-auto mb-2" />
              <span className="label-md text-muted-foreground">Page Not Found</span>
            </div>
          </div>
        </div>

        {/* Message */}
        <h1 className="font-display text-3xl md:text-4xl text-foreground mb-4 tracking-tight">
          Lost in the documentation?
        </h1>
        <p className="body-lg text-muted-foreground mb-10 max-w-md leading-relaxed">
          The page you&apos;re looking for seems to have wandered off.
          Don&apos;t worry, let&apos;s get you back on track.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
          <Button asChild size="lg" className="gap-2 min-w-[160px]">
            <Link href="/">
              <Home className="w-4 h-4" />
              Go Home
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="gap-2 min-w-[160px]">
            <Link href="/dashboard">
              <ArrowLeft className="w-4 h-4" />
              Dashboard
            </Link>
          </Button>
        </div>

        {/* Help text */}
        <p className="mt-12 text-sm text-muted-foreground/60">
          Need help?{" "}
          <Link
            href="mailto:support@vdocs.io"
            className="text-primary hover:underline underline-offset-4 transition-colors"
          >
            Contact support
          </Link>
        </p>
      </div>

      {/* Bottom accent line */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
    </div>
  );
}
