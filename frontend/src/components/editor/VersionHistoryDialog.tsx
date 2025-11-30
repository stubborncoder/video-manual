"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  History,
  RotateCcw,
  Eye,
  Loader2,
  Clock,
  FileText,
  ChevronRight,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { manuals, type VersionInfo } from "@/lib/api";

interface VersionHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  manualId: string;
  language: string;
  onRestored: () => void;
}

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getTimeAgo(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(isoString);
}

export function VersionHistoryDialog({
  open,
  onOpenChange,
  manualId,
  language,
  onRestored,
}: VersionHistoryDialogProps) {
  const [loading, setLoading] = useState(false);
  const [versions, setVersions] = useState<VersionInfo[]>([]);
  const [currentVersion, setCurrentVersion] = useState<string>("");
  const [previewVersion, setPreviewVersion] = useState<string | null>(null);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [versionToRestore, setVersionToRestore] = useState<VersionInfo | null>(null);
  const [restoring, setRestoring] = useState(false);

  const loadVersions = useCallback(async () => {
    if (!manualId) return;
    setLoading(true);
    try {
      const data = await manuals.listVersions(manualId);
      setVersions(data.versions);
      setCurrentVersion(data.current_version);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to load versions";
      toast.error("Failed to load version history", { description: message });
    } finally {
      setLoading(false);
    }
  }, [manualId]);

  useEffect(() => {
    if (open) {
      loadVersions();
    } else {
      setPreviewVersion(null);
      setPreviewContent(null);
    }
  }, [open, loadVersions]);

  // Auto-load current version when versions are loaded
  useEffect(() => {
    if (versions.length > 0 && !previewVersion) {
      const currentVersionInfo = versions.find(v => v.is_current);
      if (currentVersionInfo) {
        handlePreview(currentVersionInfo);
      }
    }
  }, [versions]);

  const handlePreview = async (version: VersionInfo) => {
    setPreviewVersion(version.version);
    setLoadingPreview(true);
    try {
      if (version.is_current) {
        // Fetch current content from the regular API
        const data = await manuals.get(manualId, language);
        setPreviewContent(data.content);
      } else {
        // Fetch historical version content
        const data = await manuals.getVersionContent(manualId, version.version, language);
        setPreviewContent(data.content);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to load version";
      toast.error("Failed to load version content", { description: message });
      setPreviewContent(null);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleRestoreClick = (version: VersionInfo) => {
    setVersionToRestore(version);
    setRestoreDialogOpen(true);
  };

  const handleRestore = async () => {
    if (!versionToRestore) return;

    setRestoring(true);
    try {
      await manuals.restoreVersion(manualId, versionToRestore.version, language);
      toast.success(`Restored to version ${versionToRestore.version}`);
      setRestoreDialogOpen(false);
      onOpenChange(false);
      onRestored();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to restore";
      toast.error("Restore failed", { description: message });
    } finally {
      setRestoring(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="!max-w-[90vw] !w-[90vw] !h-[85vh] flex flex-col overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Version History
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 flex gap-4 min-h-0 overflow-hidden">
            {/* Version List */}
            <div className="w-64 shrink-0 flex flex-col border rounded-lg overflow-hidden">
              <div className="px-3 py-2 border-b bg-muted/30 shrink-0">
                <span className="text-sm font-medium">Versions</span>
              </div>
              <ScrollArea className="flex-1 min-h-0">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : versions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No version history</p>
                  </div>
                ) : (
                  <div className="p-2 space-y-1">
                    {versions.map((version) => (
                      <button
                        key={version.version}
                        onClick={() => handlePreview(version)}
                        className={`w-full text-left p-3 rounded-lg transition-colors ${
                          previewVersion === version.version || (version.is_current && !previewVersion)
                            ? "bg-primary/10 border border-primary/30"
                            : "hover:bg-muted/50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-medium">
                                v{version.version}
                              </span>
                              {version.is_current && (
                                <Badge variant="default" className="text-xs">
                                  Current
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                              <Clock className="h-3 w-3" />
                              <span>{getTimeAgo(version.created_at)}</span>
                            </div>
                            {version.notes && (
                              <p className="text-xs text-muted-foreground mt-1 truncate">
                                {version.notes}
                              </p>
                            )}
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>

            {/* Preview Panel */}
            <div className="flex-1 flex flex-col border rounded-lg min-w-0 overflow-hidden">
              <div className="px-3 py-2 border-b bg-muted/30 flex items-center justify-between shrink-0">
                <span className="text-sm font-medium">
                  {previewVersion
                    ? versions.find(v => v.version === previewVersion)?.is_current
                      ? `Current Version (v${previewVersion})`
                      : `Preview: v${previewVersion}`
                    : "Select a version"}
                </span>
                {previewVersion && !versions.find(v => v.version === previewVersion)?.is_current && (
                  <Button
                    size="sm"
                    onClick={() => {
                      const version = versions.find((v) => v.version === previewVersion);
                      if (version) handleRestoreClick(version);
                    }}
                    disabled={restoring}
                  >
                    <RotateCcw className="h-4 w-4 mr-1.5" />
                    Restore
                  </Button>
                )}
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto">
                {loadingPreview ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : previewContent ? (
                  <div className="p-6">
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          img: ({ src, alt }) => {
                            // Convert relative screenshot paths to API URLs
                            const srcStr = typeof src === "string" ? src : "";
                            const filename = srcStr.split("/").pop() || srcStr;
                            // Use version-specific endpoint for historical versions
                            const isCurrentVersion = versions.find(v => v.version === previewVersion)?.is_current;
                            const apiUrl = isCurrentVersion
                              ? `/api/manuals/${manualId}/screenshots/${filename}`
                              : `/api/manuals/${manualId}/versions/${previewVersion}/screenshots/${filename}`;
                            return (
                              <span className="block my-4">
                                <img
                                  src={apiUrl}
                                  alt={alt || "Screenshot"}
                                  className="rounded-lg border shadow-sm max-w-full"
                                />
                                {alt && (
                                  <span className="block text-center text-xs text-muted-foreground mt-1">
                                    {alt}
                                  </span>
                                )}
                              </span>
                            );
                          },
                          h1: ({ children }) => (
                            <h1 className="text-2xl font-bold mt-6 mb-3 first:mt-0 pb-2 border-b">
                              {children}
                            </h1>
                          ),
                          h2: ({ children }) => (
                            <h2 className="text-xl font-semibold mt-6 mb-3">
                              {children}
                            </h2>
                          ),
                          h3: ({ children }) => (
                            <h3 className="text-lg font-medium mt-4 mb-2">
                              {children}
                            </h3>
                          ),
                          h4: ({ children }) => (
                            <h4 className="text-base font-medium mt-3 mb-2">
                              {children}
                            </h4>
                          ),
                          p: ({ children }) => (
                            <p className="my-3 leading-7 text-foreground/90">
                              {children}
                            </p>
                          ),
                          ul: ({ children }) => (
                            <ul className="my-3 ml-6 list-disc space-y-1">
                              {children}
                            </ul>
                          ),
                          ol: ({ children }) => (
                            <ol className="my-3 ml-6 list-decimal space-y-1">
                              {children}
                            </ol>
                          ),
                          li: ({ children }) => (
                            <li className="leading-7">{children}</li>
                          ),
                          hr: () => <hr className="my-6 border-border" />,
                          blockquote: ({ children }) => (
                            <blockquote className="border-l-4 border-primary/50 bg-muted/50 pl-4 pr-4 py-2 my-3 italic rounded-r-lg">
                              {children}
                            </blockquote>
                          ),
                          strong: ({ children }) => (
                            <strong className="font-semibold text-foreground">
                              {children}
                            </strong>
                          ),
                          code: ({ children, className }) => {
                            const isInline = !className;
                            return isInline ? (
                              <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">
                                {children}
                              </code>
                            ) : (
                              <pre className="bg-muted p-3 rounded-lg overflow-x-auto my-3">
                                <code className="text-sm font-mono">{children}</code>
                              </pre>
                            );
                          },
                          pre: ({ children }) => <>{children}</>,
                          table: ({ children }) => (
                            <div className="my-3 overflow-x-auto">
                              <table className="w-full border-collapse border border-border rounded-lg text-sm">
                                {children}
                              </table>
                            </div>
                          ),
                          th: ({ children }) => (
                            <th className="border border-border bg-muted px-3 py-2 text-left font-semibold">
                              {children}
                            </th>
                          ),
                          td: ({ children }) => (
                            <td className="border border-border px-3 py-2">
                              {children}
                            </td>
                          ),
                        }}
                      >
                        {previewContent}
                      </ReactMarkdown>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-8 text-muted-foreground">
                    <div className="text-center">
                      <Eye className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Select a version to preview</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Restore Confirmation Dialog */}
      <AlertDialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore Version?</AlertDialogTitle>
            <AlertDialogDescription>
              This will restore version {versionToRestore?.version}. Your current
              content will be saved as a new version before restoring.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restoring}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestore} disabled={restoring}>
              {restoring ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Restoring...
                </>
              ) : (
                "Restore"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default VersionHistoryDialog;
