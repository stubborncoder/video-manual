"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { publicShare, SharedDocInfo } from "@/lib/api";
import { Loader2, AlertCircle, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { VDocsIcon } from "@/components/ui/VDocsIcon";
import { VDocsText } from "@/components/ui/vdocs-text";
import { ThemeToggle } from "@/components/ui/theme-toggle";

/** Format document_format slug to display name (e.g., "incident-report" -> "Incident Report") */
function formatDocType(format: string | null | undefined): string {
  if (!format) return "Document";
  return format
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default function SharePage() {
  const params = useParams();
  const token = params.token as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [doc, setDoc] = useState<SharedDocInfo | null>(null);

  useEffect(() => {
    if (token) {
      loadSharedDoc();
    }
  }, [token]);

  async function loadSharedDoc() {
    setLoading(true);
    setError(null);
    try {
      const data = await publicShare.getDoc(token);
      setDoc(data);
    } catch (err: unknown) {
      console.error("Failed to load shared doc:", err);
      if (err instanceof Error && err.message.includes("404")) {
        setError("not_found");
      } else {
        setError("error");
      }
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Loading shared document...</p>
        </div>
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">
              {error === "not_found" ? "Share Not Found" : "Error Loading Document"}
            </h1>
            <p className="text-muted-foreground">
              {error === "not_found"
                ? "This share link is invalid or has been revoked by the owner."
                : "There was a problem loading this document. Please try again later."}
            </p>
          </div>
          <Link
            href="/"
            className={cn(
              "inline-flex items-center gap-2 px-4 py-2 rounded-lg",
              "bg-primary text-primary-foreground hover:bg-primary/90",
              "transition-colors"
            )}
          >
            Go to <VDocsText className="text-primary-foreground [&_span]:text-primary-foreground" />
            <ExternalLink className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <VDocsIcon className="h-8 w-8 text-primary" branded />
            <div>
              <h1 className="font-semibold text-sm truncate max-w-[200px] sm:max-w-none">
                {formatDocType(doc.document_format)}
              </h1>
              <p className="text-xs text-muted-foreground">
                Shared via <VDocsText className="text-xs" />
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              href="/"
              className={cn(
                "text-sm font-medium text-muted-foreground hover:text-foreground",
                "transition-colors flex items-center gap-1"
              )}
            >
              <span className="hidden sm:inline">Powered by</span>
              <VDocsText />
            </Link>
          </div>
        </div>
      </header>

      {/* Document content */}
      <main className="container max-w-4xl mx-auto px-4 py-8">
        <article
          className={cn(
            "prose prose-neutral dark:prose-invert max-w-none",
            "prose-headings:font-display prose-headings:tracking-tight",
            "prose-h1:text-3xl prose-h1:font-bold prose-h1:mb-4",
            "prose-h2:text-2xl prose-h2:font-semibold prose-h2:mt-8 prose-h2:mb-3",
            "prose-h3:text-xl prose-h3:font-medium prose-h3:mt-6 prose-h3:mb-2",
            "prose-p:leading-relaxed prose-p:text-foreground/90",
            "prose-li:my-1",
            "prose-img:rounded-lg prose-img:shadow-md prose-img:border prose-img:my-6",
            "prose-a:text-primary prose-a:no-underline hover:prose-a:underline",
            "prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm",
            "prose-pre:bg-muted prose-pre:border prose-pre:shadow-sm",
            "prose-blockquote:border-l-4 prose-blockquote:border-primary/30 prose-blockquote:bg-muted/30 prose-blockquote:py-1",
            "prose-table:border prose-table:border-collapse",
            "prose-th:bg-muted prose-th:p-2 prose-th:border",
            "prose-td:p-2 prose-td:border"
          )}
          dangerouslySetInnerHTML={{ __html: doc.content_html }}
        />
      </main>

      {/* Footer */}
      <footer className="border-t mt-16">
        <div className="container max-w-4xl mx-auto px-4 py-6 space-y-4">
          {/* Version info */}
          {(doc.version || doc.updated_at) && (
            <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
              {doc.version && (
                <span className="px-2 py-0.5 rounded bg-muted">
                  v{doc.version}
                </span>
              )}
              {doc.updated_at && (
                <span>
                  Last updated: {new Date(doc.updated_at).toLocaleDateString()}
                </span>
              )}
            </div>
          )}
          {/* Branding */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <p>
              This document was shared publicly via{" "}
              <Link href="/" className="hover:underline">
                <VDocsText />
              </Link>
            </p>
            <p>
              Create your own AI-powered documentation at{" "}
              <Link href="/" className="hover:underline">
                <VDocsText />
              </Link>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
