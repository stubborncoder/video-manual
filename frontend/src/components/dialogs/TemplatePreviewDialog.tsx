"use client";

import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DialogClose } from "@/components/ui/dialog";
import { Loader2, X, Download } from "lucide-react";

interface TemplatePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateName: string;
  isGlobal?: boolean;
}

export function TemplatePreviewDialog({
  open,
  onOpenChange,
  templateName,
  isGlobal,
}: TemplatePreviewDialogProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !templateName) return;

    let cancelled = false;

    async function loadPreview() {
      setLoading(true);
      setError(null);

      try {
        // Fetch the template file
        const response = await fetch(`/api/templates/${encodeURIComponent(templateName)}`);
        if (!response.ok) {
          throw new Error(`Failed to load template: ${response.statusText}`);
        }

        const blob = await response.blob();

        if (cancelled) return;

        // Dynamically import docx-preview (it's a client-side only library)
        const docxPreview = await import("docx-preview");

        if (cancelled || !containerRef.current) return;

        // Clear previous content
        containerRef.current.innerHTML = "";

        // Render the docx file
        await docxPreview.renderAsync(blob, containerRef.current, undefined, {
          className: "docx-preview",
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          ignoreFonts: false,
          breakPages: true,
          ignoreLastRenderedPageBreak: true,
          experimental: false,
          trimXmlDeclaration: true,
          useBase64URL: true,
          renderHeaders: true,
          renderFooters: true,
          renderFootnotes: true,
          renderEndnotes: true,
        });

        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to load template preview:", err);
          setError(err instanceof Error ? err.message : "Failed to load preview");
          setLoading(false);
        }
      }
    }

    loadPreview();

    return () => {
      cancelled = true;
    };
  }, [open, templateName]);

  // Handle download
  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = `/api/templates/${encodeURIComponent(templateName)}`;
    link.download = `${templateName}.docx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0" showCloseButton={false}>
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <div className="flex items-center justify-between gap-4">
            <DialogTitle className="text-lg font-semibold">
              {templateName}
              {isGlobal && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  (Built-in template)
                </span>
              )}
            </DialogTitle>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Download
              </Button>
              <DialogClose asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close</span>
                </Button>
              </DialogClose>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-auto min-h-0 bg-gray-100 dark:bg-gray-900">
          {loading && (
            <div className="flex items-center justify-center h-96">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Loading preview...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center h-96">
              <div className="flex flex-col items-center gap-3 text-center px-6">
                <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                  <X className="h-6 w-6 text-destructive" />
                </div>
                <p className="text-sm text-destructive font-medium">Failed to load preview</p>
                <p className="text-xs text-muted-foreground max-w-sm">{error}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownload}
                  className="mt-2 gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download instead
                </Button>
              </div>
            </div>
          )}

          <div
            ref={containerRef}
            className={`docx-container p-4 ${loading || error ? "hidden" : ""}`}
          />
        </div>

        {/* Add styles for docx-preview */}
        <style jsx global>{`
          .docx-container .docx-wrapper {
            background: white;
            padding: 30px;
            padding-bottom: 30px;
            max-width: 100%;
            margin: 0 auto;
            box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
            border-radius: 4px;
          }

          .docx-container .docx-wrapper > section.docx {
            padding: 0;
            min-height: auto;
            box-shadow: none;
            margin-bottom: 20px;
          }

          .docx-container .docx-wrapper > section.docx:last-child {
            margin-bottom: 0;
          }

          /* Make sure content doesn't overflow */
          .docx-container .docx-wrapper img {
            max-width: 100%;
            height: auto;
          }

          /* Page break styling */
          .docx-container .docx-wrapper > section.docx + section.docx::before {
            content: '';
            display: block;
            height: 1px;
            background: #e5e7eb;
            margin: 20px 0;
          }

          /* Dark mode adjustments */
          .dark .docx-container .docx-wrapper {
            background: #1f2937;
          }

          .dark .docx-container .docx-wrapper > section.docx {
            background: #1f2937;
          }

          .dark .docx-container .docx-wrapper > section.docx + section.docx::before {
            background: #374151;
          }
        `}</style>
      </DialogContent>
    </Dialog>
  );
}
