"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  History,
  MoreVertical,
  RotateCcw,
  Trash2,
  Eye,
  Edit2,
  FileText,
  Clock,
  Languages,
  Tag,
  Loader2,
  CheckCircle2,
  Info,
  BookOpen,
  Calendar,
  GitBranch,
  Layers,
  Download,
  ChevronDown,
} from "lucide-react";
import { compilations, type CompilationVersionSummary, type CompilationVersionDetail } from "@/lib/api";

interface CompilationVersionHistoryProps {
  projectId: string;
}

export function CompilationVersionHistory({ projectId }: CompilationVersionHistoryProps) {
  const [versions, setVersions] = useState<CompilationVersionSummary[]>([]);
  const [loading, setLoading] = useState(true);

  // View dialog state
  const [viewingVersion, setViewingVersion] = useState<CompilationVersionSummary | null>(null);
  const [versionDetail, setVersionDetail] = useState<CompilationVersionDetail | null>(null);
  const [viewContent, setViewContent] = useState<string | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<string>("");

  // Edit metadata state
  const [editingVersion, setEditingVersion] = useState<string | null>(null);
  const [editNotes, setEditNotes] = useState("");
  const [editTags, setEditTags] = useState("");
  const [saving, setSaving] = useState(false);

  // Restore state
  const [restoringVersion, setRestoringVersion] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  // Delete state
  const [deletingVersion, setDeletingVersion] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Export state
  const [exportingVersion, setExportingVersion] = useState<string | null>(null);
  const [languageDialogOpen, setLanguageDialogOpen] = useState(false);
  const [pendingExport, setPendingExport] = useState<{
    version: string;
    format: "pdf" | "word" | "html";
    languages: string[];
  } | null>(null);

  useEffect(() => {
    loadVersions();
  }, [projectId]);

  async function loadVersions() {
    setLoading(true);
    try {
      const res = await compilations.list(projectId);
      setVersions(res.versions);
    } catch (e) {
      console.error("Failed to load compilation versions:", e);
      setVersions([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleViewVersion(version: CompilationVersionSummary) {
    setViewingVersion(version);
    setLoadingContent(true);
    setSelectedLanguage(version.languages[0] || "");

    try {
      // Load version details
      const detail = await compilations.get(projectId, version.version);
      setVersionDetail(detail);

      // Load content for first language
      if (version.languages.length > 0) {
        const contentRes = await compilations.getContent(projectId, version.version, version.languages[0]);
        setViewContent(contentRes.content);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to load version";
      toast.error("Error", { description: message });
      setViewingVersion(null);
    } finally {
      setLoadingContent(false);
    }
  }

  async function handleLanguageChange(language: string) {
    if (!viewingVersion) return;
    setSelectedLanguage(language);
    setLoadingContent(true);

    try {
      const contentRes = await compilations.getContent(projectId, viewingVersion.version, language);
      setViewContent(contentRes.content);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to load content";
      toast.error("Error", { description: message });
    } finally {
      setLoadingContent(false);
    }
  }

  function closeViewDialog() {
    setViewingVersion(null);
    setVersionDetail(null);
    setViewContent(null);
    setSelectedLanguage("");
  }

  function openEditDialog(version: CompilationVersionSummary) {
    setEditingVersion(version.version);
    setEditNotes(version.notes || "");
    setEditTags(version.tags?.join(", ") || "");
  }

  async function handleSaveMetadata() {
    if (!editingVersion) return;

    setSaving(true);
    try {
      const tags = editTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      await compilations.updateMetadata(projectId, editingVersion, editNotes, tags);
      toast.success("Version updated");
      setEditingVersion(null);
      await loadVersions();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to update";
      toast.error("Error", { description: message });
    } finally {
      setSaving(false);
    }
  }

  async function handleRestore() {
    if (!restoringVersion) return;

    setRestoring(true);
    try {
      await compilations.restore(projectId, restoringVersion);
      toast.success("Version restored", {
        description: `Restored version ${restoringVersion} to current`,
      });
      setRestoringVersion(null);
      await loadVersions();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to restore";
      toast.error("Error", { description: message });
    } finally {
      setRestoring(false);
    }
  }

  async function handleDelete() {
    if (!deletingVersion) return;

    setDeleting(true);
    try {
      await compilations.delete(projectId, deletingVersion);
      toast.success("Version deleted");
      setDeletingVersion(null);
      await loadVersions();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to delete";
      toast.error("Error", { description: message });
    } finally {
      setDeleting(false);
    }
  }

  function handleExportClick(version: CompilationVersionSummary, format: "pdf" | "word" | "html") {
    if (version.languages.length === 0) {
      toast.error("No content to export", { description: "This compilation has no languages" });
      return;
    }

    if (version.languages.length === 1) {
      // Single language - export directly
      handleExport(version.version, format, version.languages[0]);
    } else {
      // Multiple languages - show dialog
      setPendingExport({
        version: version.version,
        format,
        languages: version.languages,
      });
      setLanguageDialogOpen(true);
    }
  }

  async function handleExport(version: string, format: "pdf" | "word" | "html", language: string) {
    setExportingVersion(version);
    setLanguageDialogOpen(false);
    setPendingExport(null);

    try {
      await compilations.export(projectId, version, format, language);
      toast.success("Export complete", {
        description: `Downloaded ${format.toUpperCase()} (${language})`,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Export failed";
      toast.error("Export failed", { description: message });
    } finally {
      setExportingVersion(null);
    }
  }

  // Transform image URLs in markdown to use the API
  function transformImageUrl(src: string): string {
    if (!viewingVersion) return src;
    const srcStr = typeof src === "string" ? src : "";
    if (srcStr.startsWith("screenshots/") || srcStr.includes("/screenshots/")) {
      const filename = srcStr.split("/").pop() || srcStr;
      return `/api/projects/${projectId}/compilations/${viewingVersion.version}/screenshots/${filename}`;
    }
    return srcStr;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Loading version history...
      </div>
    );
  }

  if (versions.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-lg">
        <History className="mx-auto h-12 w-12 mb-4 opacity-50" />
        <p className="text-lg font-medium">No compilation history</p>
        <p className="text-sm mt-1">
          Compile your project to create the first version
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        View and restore previous compilation versions. Each compilation is automatically saved before a new one is created.
      </p>

      <div className="space-y-3">
        {versions.map((version) => (
          <Card
            key={version.version}
            className={version.is_current ? "border-primary/50 bg-primary/5" : ""}
          >
            <CardContent className="p-4">
              {/* Version Info */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono font-semibold text-lg">
                  v{version.version}
                </span>
                {version.is_current && (
                  <Badge className="bg-primary text-primary-foreground">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Current
                  </Badge>
                )}
                {version.tags?.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    <Tag className="h-3 w-3 mr-1" />
                    {tag}
                  </Badge>
                ))}
              </div>

              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {formatDistanceToNow(new Date(version.created_at), { addSuffix: true })}
                </span>
                <span className="flex items-center gap-1">
                  <Languages className="h-3.5 w-3.5" />
                  {version.languages.join(", ") || "—"}
                </span>
                <span className="flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5" />
                  {version.source_manual_count} source manual{version.source_manual_count !== 1 ? "s" : ""}
                </span>
              </div>

              {version.notes && (
                <p className="text-sm text-muted-foreground mt-2 italic">
                  "{version.notes}"
                </p>
              )}

              {/* Action Buttons Row */}
              <div className="flex items-center gap-2 mt-4 pt-3 border-t">
                {/* View Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleViewVersion(version)}
                  disabled={version.languages.length === 0}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  View
                </Button>

                {/* Tags Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openEditDialog(version)}
                >
                  <Tag className="h-4 w-4 mr-2" />
                  Tags
                </Button>

                {/* Export Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={version.languages.length === 0 || exportingVersion === version.version}
                    >
                      {exportingVersion === version.version ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4 mr-2" />
                      )}
                      Export
                      <ChevronDown className="h-4 w-4 ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onClick={() => handleExportClick(version, "pdf")}>
                      PDF Document
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExportClick(version, "word")}>
                      Word Document (.docx)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExportClick(version, "html")}>
                      HTML File
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* More Actions Menu (Restore/Delete) */}
                {!version.is_current && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 ml-auto">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setRestoringVersion(version.version)}>
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Restore
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setDeletingVersion(version.version)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Compilation Review Dialog */}
      <Dialog open={viewingVersion !== null} onOpenChange={() => closeViewDialog()}>
        <DialogContent className="sm:max-w-6xl w-[95vw] max-h-[90vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-3">
                <BookOpen className="h-6 w-6 text-primary" />
                <span>Compilation v{viewingVersion?.version}</span>
                {viewingVersion?.is_current && (
                  <Badge className="bg-primary text-primary-foreground">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Current
                  </Badge>
                )}
              </DialogTitle>

              {/* Language selector */}
              {viewingVersion && viewingVersion.languages.length > 1 && (
                <div className="flex items-center gap-2">
                  <Label className="text-sm text-muted-foreground">Language:</Label>
                  <Select value={selectedLanguage} onValueChange={handleLanguageChange}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {viewingVersion.languages.map((lang) => (
                        <SelectItem key={lang} value={lang}>
                          {lang.toUpperCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </DialogHeader>

          <Tabs defaultValue="document" className="flex-1 flex flex-col overflow-hidden">
            <div className="px-6 pt-2 border-b shrink-0">
              <TabsList>
                <TabsTrigger value="document" className="gap-2">
                  <FileText className="h-4 w-4" />
                  Document
                </TabsTrigger>
                <TabsTrigger value="details" className="gap-2">
                  <Info className="h-4 w-4" />
                  Details
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Document Tab */}
            <TabsContent value="document" className="flex-1 overflow-y-auto m-0 p-0">
              {loadingContent ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <div className="p-6">
                  <div className="max-w-4xl mx-auto">
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          img: ({ src, alt }) => {
                            const srcStr = typeof src === "string" ? src : "";
                            const apiUrl = transformImageUrl(srcStr);
                            return (
                              <span className="block my-6">
                                <img
                                  src={apiUrl}
                                  alt={alt || "Screenshot"}
                                  className="rounded-lg border shadow-sm w-full"
                                />
                                {alt && (
                                  <span className="block text-center text-sm text-muted-foreground mt-2">
                                    {alt}
                                  </span>
                                )}
                              </span>
                            );
                          },
                          h1: ({ children }) => (
                            <h1 className="text-3xl font-bold mt-8 mb-4 first:mt-0 pb-3 border-b">{children}</h1>
                          ),
                          h2: ({ children }) => (
                            <h2 className="text-2xl font-semibold mt-8 mb-4 pb-2 border-b">{children}</h2>
                          ),
                          h3: ({ children }) => (
                            <h3 className="text-xl font-medium mt-6 mb-3">{children}</h3>
                          ),
                          h4: ({ children }) => (
                            <h4 className="text-lg font-medium mt-4 mb-2">{children}</h4>
                          ),
                          p: ({ children }) => (
                            <p className="my-4 leading-7 text-foreground/90">{children}</p>
                          ),
                          ul: ({ children }) => (
                            <ul className="my-4 ml-6 list-disc space-y-2">{children}</ul>
                          ),
                          ol: ({ children }) => (
                            <ol className="my-4 ml-6 list-decimal space-y-2">{children}</ol>
                          ),
                          li: ({ children }) => (
                            <li className="leading-7">{children}</li>
                          ),
                          code: ({ children, className }) => {
                            const isInline = !className;
                            return isInline ? (
                              <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">{children}</code>
                            ) : (
                              <pre className="bg-muted p-4 rounded-lg overflow-x-auto my-4">
                                <code className="text-sm font-mono">{children}</code>
                              </pre>
                            );
                          },
                          pre: ({ children }) => <>{children}</>,
                          blockquote: ({ children }) => (
                            <blockquote className="border-l-4 border-primary/50 bg-muted/50 pl-4 pr-4 py-3 my-4 italic rounded-r-lg">
                              {children}
                            </blockquote>
                          ),
                          strong: ({ children }) => (
                            <strong className="font-semibold text-foreground">{children}</strong>
                          ),
                          hr: () => <hr className="my-8 border-t-2" />,
                          table: ({ children }) => (
                            <div className="my-4 overflow-x-auto">
                              <table className="w-full border-collapse border">{children}</table>
                            </div>
                          ),
                          th: ({ children }) => (
                            <th className="border px-4 py-2 bg-muted text-left font-semibold">{children}</th>
                          ),
                          td: ({ children }) => (
                            <td className="border px-4 py-2">{children}</td>
                          ),
                        }}
                      >
                        {viewContent || ""}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Details Tab */}
            <TabsContent value="details" className="flex-1 overflow-y-auto m-0 p-6">
              {versionDetail ? (
                <div className="max-w-2xl mx-auto space-y-6">
                  {/* Version Info */}
                  <Card>
                    <CardContent className="p-6">
                      <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                        <GitBranch className="h-5 w-5 text-primary" />
                        Version Information
                      </h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Version</p>
                          <p className="font-mono font-semibold">v{versionDetail.version}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Status</p>
                          <p>
                            {versionDetail.is_current ? (
                              <Badge className="bg-primary text-primary-foreground">Current</Badge>
                            ) : (
                              <Badge variant="secondary">Historical</Badge>
                            )}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Created</p>
                          <p className="flex items-center gap-1">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            {format(new Date(versionDetail.created_at), "PPpp")}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Languages</p>
                          <div className="flex gap-1 flex-wrap">
                            {versionDetail.languages.map((lang) => (
                              <Badge key={lang} variant="outline">{lang.toUpperCase()}</Badge>
                            ))}
                          </div>
                        </div>
                      </div>

                      {versionDetail.notes && (
                        <div className="mt-4 pt-4 border-t">
                          <p className="text-sm text-muted-foreground mb-1">Notes</p>
                          <p className="text-sm italic">"{versionDetail.notes}"</p>
                        </div>
                      )}

                      {versionDetail.tags && versionDetail.tags.length > 0 && (
                        <div className="mt-4 pt-4 border-t">
                          <p className="text-sm text-muted-foreground mb-2">Tags</p>
                          <div className="flex gap-2 flex-wrap">
                            {versionDetail.tags.map((tag) => (
                              <Badge key={tag} variant="secondary">
                                <Tag className="h-3 w-3 mr-1" />
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Merge Plan Summary */}
                  <Card>
                    <CardContent className="p-6">
                      <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                        <Layers className="h-5 w-5 text-primary" />
                        Compilation Summary
                      </h3>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="text-center p-4 bg-muted/50 rounded-lg">
                          <p className="text-3xl font-bold text-primary">
                            {versionDetail.merge_plan_summary?.chapter_count || 0}
                          </p>
                          <p className="text-sm text-muted-foreground">Chapters</p>
                        </div>
                        <div className="text-center p-4 bg-muted/50 rounded-lg">
                          <p className="text-3xl font-bold text-primary">
                            {versionDetail.source_manuals?.length || 0}
                          </p>
                          <p className="text-sm text-muted-foreground">Source Manuals</p>
                        </div>
                        <div className="text-center p-4 bg-muted/50 rounded-lg">
                          <p className="text-3xl font-bold text-primary">
                            {versionDetail.merge_plan_summary?.duplicates_detected || 0}
                          </p>
                          <p className="text-sm text-muted-foreground">Duplicates Removed</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Source Manuals */}
                  {versionDetail.source_manuals && versionDetail.source_manuals.length > 0 && (
                    <Card>
                      <CardContent className="p-6">
                        <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                          <FileText className="h-5 w-5 text-primary" />
                          Source Manuals
                        </h3>
                        <div className="space-y-2">
                          {versionDetail.source_manuals.map((manual, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-lg"
                            >
                              <span className="font-medium">{manual.manual_id}</span>
                              <Badge variant="outline" className="font-mono">
                                v{manual.version}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Edit Metadata Dialog */}
      <Dialog open={editingVersion !== null} onOpenChange={() => setEditingVersion(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Version {editingVersion}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Add notes about this version..."
              />
            </div>
            <div className="space-y-2">
              <Label>Tags</Label>
              <Input
                value={editTags}
                onChange={(e) => setEditTags(e.target.value)}
                placeholder="Comma-separated tags (e.g., draft, final, reviewed)"
              />
              <p className="text-xs text-muted-foreground">
                Separate multiple tags with commas
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingVersion(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveMetadata} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restore Confirmation Dialog */}
      <AlertDialog open={restoringVersion !== null} onOpenChange={() => setRestoringVersion(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5" />
              Restore Version {restoringVersion}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will restore the content from version {restoringVersion} to the current compilation.
              Your current compilation will be saved as a new version before restoring.
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
                <>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Restore
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deletingVersion !== null} onOpenChange={() => setDeletingVersion(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Delete Version {deletingVersion}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete version {deletingVersion}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Language Selection Dialog */}
      <Dialog open={languageDialogOpen} onOpenChange={setLanguageDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Languages className="h-5 w-5" />
              Select Language
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              This compilation has multiple languages. Select which one to export.
            </p>
            {pendingExport && (
              <div className="space-y-2">
                {pendingExport.languages.map((lang) => (
                  <Button
                    key={lang}
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => handleExport(pendingExport.version, pendingExport.format, lang)}
                  >
                    <Languages className="h-4 w-4 mr-2" />
                    {lang.toUpperCase()}
                  </Button>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setLanguageDialogOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
