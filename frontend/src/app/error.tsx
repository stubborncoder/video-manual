"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw, Home, AlertTriangle, ChevronDown, ChevronUp, Bug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { VDocsIcon } from "@/components/ui/VDocsIcon";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  const [mounted, setMounted] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Log the error to console for debugging
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background pattern - more dramatic for errors */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Subtle red-tinted gradient for error state */}
        <div
          className="absolute top-0 left-0 w-full h-full opacity-[0.04]"
          style={{
            backgroundImage: `
              radial-gradient(ellipse 100% 80% at 50% 20%, #EF4444 0%, transparent 60%),
              radial-gradient(ellipse 60% 40% at 20% 80%, var(--primary) 0%, transparent 50%)
            `,
          }}
        />

        {/* Diagonal lines for visual tension */}
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `repeating-linear-gradient(
              -45deg,
              var(--foreground) 0px,
              var(--foreground) 1px,
              transparent 1px,
              transparent 40px
            )`,
          }}
        />

        {/* Floating alert elements */}
        {mounted && (
          <>
            <div
              className="absolute w-64 h-64 border-2 border-destructive/10 rounded-full animate-pulse-slow"
              style={{ top: '20%', left: '10%' }}
            />
            <div
              className="absolute w-48 h-48 border border-destructive/5 rounded-full animate-float-2"
              style={{ bottom: '20%', right: '15%' }}
            />
            <div
              className="absolute w-24 h-24 bg-destructive/5 rotate-45 animate-float-3"
              style={{ top: '50%', left: '80%' }}
            />
          </>
        )}
      </div>

      {/* Content */}
      <div
        className={`relative z-10 flex flex-col items-center text-center px-6 max-w-2xl transition-all duration-700 ${
          mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}
      >
        {/* Logo */}
        <Link
          href="/"
          className="group mb-10 flex items-center gap-3 transition-transform hover:scale-105"
        >
          <VDocsIcon branded className="w-10 h-10" />
          <span className="font-display text-2xl tracking-tight text-foreground">
            vDocs
          </span>
        </Link>

        {/* Error icon with pulse effect */}
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-destructive/20 rounded-full blur-2xl animate-pulse" />
          <div className="relative bg-destructive/10 rounded-full p-6 border border-destructive/20">
            <AlertTriangle className="w-16 h-16 text-destructive" strokeWidth={1.5} />
          </div>
        </div>

        {/* Message */}
        <h1 className="font-display text-3xl md:text-4xl text-foreground mb-4 tracking-tight">
          Something went wrong
        </h1>
        <p className="body-lg text-muted-foreground mb-8 max-w-md leading-relaxed">
          An unexpected error occurred while loading this page.
          Our team has been notified and we&apos;re working on it.
        </p>

        {/* Error details card */}
        {(error.message || error.digest) && (
          <Card className="w-full max-w-lg mb-8 bg-card/50 backdrop-blur-sm border-border/50">
            <CardContent className="p-0">
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors rounded-xl"
              >
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Bug className="w-4 h-4" />
                  <span>Error details</span>
                </div>
                {showDetails ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                )}
              </button>
              {showDetails && (
                <div className="px-4 pb-4 pt-0">
                  <div className="bg-muted/50 rounded-lg p-4 text-left">
                    {error.message && (
                      <p className="text-sm font-mono text-foreground/80 break-all">
                        {error.message}
                      </p>
                    )}
                    {error.digest && (
                      <p className="mt-2 text-xs text-muted-foreground font-mono">
                        Error ID: {error.digest}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
          <Button
            onClick={reset}
            size="lg"
            className="gap-2 min-w-[160px]"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </Button>
          <Button asChild variant="outline" size="lg" className="gap-2 min-w-[160px]">
            <Link href="/">
              <Home className="w-4 h-4" />
              Go Home
            </Link>
          </Button>
        </div>

        {/* Help text */}
        <p className="mt-12 text-sm text-muted-foreground/60">
          If this problem persists,{" "}
          <Link
            href="mailto:support@vdocs.io"
            className="text-primary hover:underline underline-offset-4 transition-colors"
          >
            contact our support team
          </Link>
        </p>
      </div>

      {/* Bottom accent line - using destructive color */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-destructive/30 to-transparent" />
    </div>
  );
}
