"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useTranslations } from "next-intl";
import { templates, TemplateInfo } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  FileText,
  Upload,
  Download,
  Trash2,
  Globe,
  User,
  Plus,
  X,
  Check,
  Loader2,
  Sparkles,
  Eye,
  File,
  Clock,
  HardDrive,
  ArrowUpRight,
  BookOpen,
  ClipboardList,
  AlertTriangle,
  CheckSquare,
  TrendingUp,
  Zap,
  FileSearch,
  BarChart3,
} from "lucide-react";
import { SidebarToggle } from "@/components/layout/SidebarToggle";
import { AlphaBadge } from "@/components/ui/alpha-badge";
import { cn } from "@/lib/utils";
import { TemplatePreviewDialog } from "@/components/dialogs/TemplatePreviewDialog";

// Document format categories and metadata
const FORMAT_CATEGORIES = {
  instructional: {
    id: "instructional",
    labelKey: "categoryInstructional",
    descKey: "categoryInstructionalDesc",
    icon: BookOpen,
    color: "from-blue-500/20 to-cyan-500/10",
    borderColor: "border-blue-500/30",
    textColor: "text-blue-600 dark:text-blue-400",
    formats: ["step-manual", "quick-guide", "reference", "summary"],
  },
  reports: {
    id: "reports",
    labelKey: "categoryReports",
    descKey: "categoryReportsDesc",
    icon: ClipboardList,
    color: "from-amber-500/20 to-orange-500/10",
    borderColor: "border-amber-500/30",
    textColor: "text-amber-600 dark:text-amber-400",
    formats: ["incident-report", "inspection-report", "progress-report"],
  },
} as const;

const FORMAT_METADATA: Record<string, {
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
  badgeColor: string;
  category: keyof typeof FORMAT_CATEGORIES;
}> = {
  "step-manual": {
    labelKey: "formatStepManual",
    icon: BookOpen,
    badgeColor: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    category: "instructional",
  },
  "quick-guide": {
    labelKey: "formatQuickGuide",
    icon: Zap,
    badgeColor: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20",
    category: "instructional",
  },
  "reference": {
    labelKey: "formatReference",
    icon: FileSearch,
    badgeColor: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
    category: "instructional",
  },
  "summary": {
    labelKey: "formatSummary",
    icon: BarChart3,
    badgeColor: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
    category: "instructional",
  },
  "incident-report": {
    labelKey: "formatIncidentReport",
    icon: AlertTriangle,
    badgeColor: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
    category: "reports",
  },
  "inspection-report": {
    labelKey: "formatInspectionReport",
    icon: CheckSquare,
    badgeColor: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    category: "reports",
  },
  "progress-report": {
    labelKey: "formatProgressReport",
    icon: TrendingUp,
    badgeColor: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
    category: "reports",
  },
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function TemplatesPage() {
  const t = useTranslations("templates");
  const tc = useTranslations("common");
  const [templateList, setTemplateList] = useState<TemplateInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateInfo | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [customName, setCustomName] = useState("");
  const [previewTemplate, setPreviewTemplate] = useState<{ name: string; isGlobal: boolean } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const response = await templates.list();
      setTemplateList(response.templates);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load templates");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadFile(file);
      setCustomName(file.name.replace(/\.docx$/i, ""));
      setUploadOpen(true);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.name.endsWith(".docx")) {
      setUploadFile(file);
      setCustomName(file.name.replace(/\.docx$/i, ""));
      setUploadOpen(true);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleUpload = async () => {
    if (!uploadFile) return;

    setUploading(true);
    try {
      await templates.upload(uploadFile, customName || undefined);
      await loadTemplates();
      setUploadOpen(false);
      setUploadFile(null);
      setCustomName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedTemplate) return;

    setDeleting(true);
    try {
      await templates.delete(selectedTemplate.name);
      await loadTemplates();
      setDeleteOpen(false);
      setSelectedTemplate(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  const userTemplates = templateList.filter((t) => !t.is_global);
  const globalTemplates = templateList.filter((t) => t.is_global);

  // Group global templates by category
  const groupedGlobalTemplates = useMemo(() => {
    const grouped: Record<string, TemplateInfo[]> = {
      instructional: [],
      reports: [],
      other: [],
    };

    globalTemplates.forEach((template) => {
      const format = template.document_format;
      if (format && FORMAT_METADATA[format]) {
        const category = FORMAT_METADATA[format].category;
        grouped[category].push(template);
      } else {
        grouped.other.push(template);
      }
    });

    return grouped;
  }, [globalTemplates]);

  return (
    <div
      className="relative min-h-[calc(100vh-4rem)]"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/20 rounded-3xl blur-2xl animate-pulse" />
            <div className="relative bg-card border-2 border-dashed border-primary rounded-2xl p-16 text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Upload className="h-10 w-10 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">{t("dropToUpload")}</h3>
              <p className="text-muted-foreground">{t("dropHint")}</p>
            </div>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-2xl border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-background to-primary/5 mb-8">
        {/* Decorative background */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-gradient-to-bl from-primary/10 via-primary/5 to-transparent rounded-full blur-3xl" />
          <div className="absolute -bottom-12 -left-12 w-64 h-64 bg-gradient-to-tr from-primary/5 to-transparent rounded-full blur-2xl" />
          {/* Document pattern */}
          <div className="absolute top-8 right-12 opacity-[0.03]">
            <FileText className="w-64 h-64" strokeWidth={0.5} />
          </div>
        </div>

        <div className="relative p-8 lg:p-10">
          <div className="flex flex-col lg:flex-row lg:items-center gap-6">
            <div className="flex items-start gap-4 flex-1">
              <SidebarToggle className="mt-1 shrink-0" />
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10">
                    <File className="h-5 w-5 text-primary" />
                  </div>
                  <h1 className="font-display text-3xl tracking-tight">{t("title")}</h1>
                  <AlphaBadge />
                </div>
                <p className="text-muted-foreground max-w-xl leading-relaxed">
                  {t("description")}
                </p>
                {/* Quick stats */}
                {!loading && (
                  <div className="flex items-center gap-4 pt-2">
                    <div className="flex items-center gap-2 text-sm">
                      <div className="flex h-6 w-6 items-center justify-center rounded-md bg-muted">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <span className="text-muted-foreground">{userTemplates.length} {t("custom")}</span>
                    </div>
                    <div className="w-px h-4 bg-border" />
                    <div className="flex items-center gap-2 text-sm">
                      <div className="flex h-6 w-6 items-center justify-center rounded-md bg-muted">
                        <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <span className="text-muted-foreground">{globalTemplates.length} {t("system")}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Upload CTA */}
            <div className="lg:self-center">
              <Button
                data-guide-id="upload-template-btn"
                onClick={() => fileInputRef.current?.click()}
                size="lg"
                className="gap-2 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all"
              >
                <Plus className="h-4 w-4" />
                {t("upload")}
              </Button>
            </div>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".docx"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* Error message */}
      {error && (
        <div className="rounded-xl border border-destructive/50 bg-destructive/5 px-5 py-4 mb-8 flex items-center gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
            <X className="h-5 w-5 text-destructive" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-destructive">{tc("error")}</p>
            <p className="text-sm text-destructive/80">{error}</p>
          </div>
          <button
            onClick={() => setError(null)}
            className="p-2 rounded-lg hover:bg-destructive/10 transition-colors"
          >
            <X className="h-4 w-4 text-destructive" />
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-24">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse" />
            <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-card border">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
            </div>
          </div>
          <p className="mt-6 text-muted-foreground font-medium">{t("loading")}</p>
        </div>
      )}

      {/* Templates Sections */}
      {!loading && (
        <div className="space-y-10">
          {/* User Templates Section */}
          <section>
            <div className="flex items-center gap-4 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <h2 className="font-display text-xl tracking-tight">{t("yourTemplates")}</h2>
                <p className="text-sm text-muted-foreground">{t("yourTemplatesDesc")}</p>
              </div>
              <Badge variant="secondary">
                {userTemplates.length}
              </Badge>
            </div>

            {userTemplates.length === 0 ? (
              <div
                className={cn(
                  "group relative overflow-hidden rounded-2xl border-2 border-dashed cursor-pointer",
                  "transition-all duration-300",
                  "hover:border-primary/50 hover:bg-primary/5"
                )}
                onClick={() => fileInputRef.current?.click()}
              >
                {/* Background pattern */}
                <div className="absolute inset-0 opacity-[0.02] group-hover:opacity-[0.04] transition-opacity">
                  <div className="absolute inset-0" style={{
                    backgroundImage: `repeating-linear-gradient(
                      45deg,
                      currentColor,
                      currentColor 1px,
                      transparent 1px,
                      transparent 12px
                    )`
                  }} />
                </div>

                <div className="relative flex flex-col items-center justify-center py-16 px-6 text-center">
                  <div className="relative mb-6">
                    <div className="absolute inset-0 bg-primary/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-muted group-hover:bg-primary/10 transition-colors">
                      <Upload className="h-7 w-7 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{t("noCustomTemplates")}</h3>
                  <p className="text-muted-foreground max-w-sm">
                    {t("clickToUpload")}
                  </p>
                  <div className="mt-6 flex items-center gap-2 text-sm text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                    <span>{t("uploadFirst")}</span>
                    <ArrowUpRight className="h-4 w-4" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {userTemplates.map((template, idx) => (
                  <TemplateCard
                    key={template.name}
                    template={template}
                    index={idx}
                    t={t}
                    onPreview={() => setPreviewTemplate({ name: template.name, isGlobal: false })}
                    onDownload={() => window.open(templates.download(template.name))}
                    onDelete={() => {
                      setSelectedTemplate(template);
                      setDeleteOpen(true);
                    }}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Divider */}
          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t" />
            </div>
            <div className="relative flex justify-center">
              <div className="bg-background px-4 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          </div>

          {/* Global Templates Section */}
          <section>
            <div className="flex items-center gap-4 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-muted to-muted/50 border">
                <Globe className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <h2 className="font-display text-xl tracking-tight">{t("defaultTemplates")}</h2>
                <p className="text-sm text-muted-foreground">{t("defaultTemplatesDesc")}</p>
              </div>
              <Badge variant="secondary">
                {globalTemplates.length}
              </Badge>
            </div>

            {globalTemplates.length === 0 ? (
              <div className="rounded-xl border border-dashed bg-muted/30 py-12 text-center">
                <p className="text-muted-foreground">{t("noDefaultTemplates")}</p>
              </div>
            ) : (
              <div className="space-y-8">
                {/* Instructional Templates Category */}
                {groupedGlobalTemplates.instructional.length > 0 && (
                  <TemplateCategorySection
                    category={FORMAT_CATEGORIES.instructional}
                    templates={groupedGlobalTemplates.instructional}
                    t={t}
                    onPreview={(name) => setPreviewTemplate({ name, isGlobal: true })}
                    onDownload={(name) => window.open(templates.download(name))}
                  />
                )}

                {/* Reports Templates Category */}
                {groupedGlobalTemplates.reports.length > 0 && (
                  <TemplateCategorySection
                    category={FORMAT_CATEGORIES.reports}
                    templates={groupedGlobalTemplates.reports}
                    t={t}
                    onPreview={(name) => setPreviewTemplate({ name, isGlobal: true })}
                    onDownload={(name) => window.open(templates.download(name))}
                  />
                )}

                {/* Other Templates (uncategorized) */}
                {groupedGlobalTemplates.other.length > 0 && (
                  <div>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <h3 className="font-medium text-muted-foreground">{t("categoryOther")}</h3>
                      <Badge variant="outline" className="ml-auto">
                        {groupedGlobalTemplates.other.length}
                      </Badge>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {groupedGlobalTemplates.other.map((template, idx) => (
                        <TemplateCard
                          key={template.name}
                          template={template}
                          index={idx}
                          t={t}
                          onPreview={() => setPreviewTemplate({ name: template.name, isGlobal: true })}
                          onDownload={() => window.open(templates.download(template.name))}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <Upload className="h-4 w-4 text-primary" />
              </div>
              {t("uploadDialogTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("uploadDialogDesc")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-4">
            {uploadFile && (
              <div className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-muted/80 to-muted/40 border">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{uploadFile.name}</p>
                  <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <HardDrive className="h-3 w-3" />
                      {formatBytes(uploadFile.size)}
                    </span>
                  </div>
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                  <Check className="h-4 w-4 text-primary" />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="template-name" className="text-sm font-medium">
                {t("templateName")}
              </Label>
              <Input
                id="template-name"
                placeholder="e.g., company-brand"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                className="h-11"
              />
              <p className="text-xs text-muted-foreground">
                {t("templateNameHint")}
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setUploadOpen(false);
                setUploadFile(null);
                setCustomName("");
              }}
            >
              {tc("cancel")}
            </Button>
            <Button
              onClick={handleUpload}
              disabled={uploading || !uploadFile}
              className="gap-2"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("uploading")}
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  {tc("upload")}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-destructive/10">
                <Trash2 className="h-4 w-4 text-destructive" />
              </div>
              {t("deleteDialogTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("deleteDialogDesc", { name: selectedTemplate?.name || "" })}
            </DialogDescription>
          </DialogHeader>

          {selectedTemplate && (
            <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/50 border my-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
                <FileText className="h-5 w-5 text-destructive" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{selectedTemplate.name}</p>
                <p className="text-sm text-muted-foreground">
                  {formatBytes(selectedTemplate.size_bytes)}
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
              className="gap-2"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("deleting")}
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  {tc("delete")}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Template Preview Dialog */}
      <TemplatePreviewDialog
        open={!!previewTemplate}
        onOpenChange={(open) => !open && setPreviewTemplate(null)}
        templateName={previewTemplate?.name || ""}
        isGlobal={previewTemplate?.isGlobal}
      />
    </div>
  );
}

// Category section component for grouped templates
interface TemplateCategorySectionProps {
  category: typeof FORMAT_CATEGORIES[keyof typeof FORMAT_CATEGORIES];
  templates: TemplateInfo[];
  t: ReturnType<typeof useTranslations>;
  onPreview: (name: string) => void;
  onDownload: (name: string) => void;
}

function TemplateCategorySection({ category, templates, t, onPreview, onDownload }: TemplateCategorySectionProps) {
  const CategoryIcon = category.icon;

  return (
    <div className="space-y-4">
      {/* Category Header */}
      <div className={cn(
        "flex items-center gap-3 p-3 rounded-xl border",
        `bg-gradient-to-r ${category.color}`,
        category.borderColor
      )}>
        <div className={cn(
          "flex h-9 w-9 items-center justify-center rounded-lg",
          "bg-background/80 backdrop-blur-sm border",
          category.borderColor
        )}>
          <CategoryIcon className={cn("h-4.5 w-4.5", category.textColor)} />
        </div>
        <div className="flex-1">
          <h3 className={cn("font-semibold", category.textColor)}>
            {t(category.labelKey)}
          </h3>
          <p className="text-xs text-muted-foreground">
            {t(category.descKey)}
          </p>
        </div>
        <Badge variant="outline" className={cn("border", category.borderColor, category.textColor)}>
          {templates.length}
        </Badge>
      </div>

      {/* Templates Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 pl-3">
        {templates.map((template, idx) => (
          <TemplateCard
            key={template.name}
            template={template}
            index={idx}
            t={t}
            onPreview={() => onPreview(template.name)}
            onDownload={() => onDownload(template.name)}
          />
        ))}
      </div>
    </div>
  );
}

interface TemplateCardProps {
  template: TemplateInfo;
  index: number;
  t: ReturnType<typeof useTranslations>;
  onPreview: () => void;
  onDownload: () => void;
  onDelete?: () => void;
}

function TemplateCard({ template, index, t, onPreview, onDownload, onDelete }: TemplateCardProps) {
  const tc = useTranslations("common");
  const formatMeta = template.document_format ? FORMAT_METADATA[template.document_format] : null;
  const FormatIcon = formatMeta?.icon || FileText;

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border bg-card",
        "transition-all duration-300",
        "hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-0.5 hover:border-primary/20",
        formatMeta ? `border-l-2 ${formatMeta.badgeColor.replace('bg-', 'border-l-').replace('/10', '')}` : "border-primary/10"
      )}
      style={{
        animationDelay: `${index * 50}ms`,
        animation: "fadeInUp 0.4s ease-out forwards",
        opacity: 0,
      }}
    >
      {/* Top accent line */}
      <div className="absolute inset-x-0 top-0 h-0.5 bg-primary opacity-0 group-hover:opacity-100 transition-opacity" />

      <div className="relative p-5">
        {/* Format Badge - Top Right */}
        {formatMeta && (
          <div className={cn(
            "absolute top-3 right-3 flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium border",
            formatMeta.badgeColor
          )}>
            <FormatIcon className="h-3 w-3" />
            <span>{t(formatMeta.labelKey)}</span>
          </div>
        )}

        <div className="flex items-start gap-4">
          {/* Icon with badge */}
          <div className="relative shrink-0">
            <div className={cn(
              "flex h-12 w-12 items-center justify-center rounded-xl",
              "bg-gradient-to-br border transition-all",
              "group-hover:scale-105 group-hover:shadow-md",
              formatMeta
                ? `${formatMeta.badgeColor} border-transparent`
                : template.is_global
                  ? "from-muted to-muted/50 border-border"
                  : "from-primary/20 to-primary/5 border-primary/20"
            )}>
              <FormatIcon className={cn(
                "h-6 w-6",
                formatMeta ? "" : template.is_global ? "text-muted-foreground" : "text-primary"
              )} />
            </div>
            {template.is_global && (
              <div className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30">
                <Sparkles className="h-2.5 w-2.5" />
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 pt-0.5">
            <h3 className="font-semibold truncate group-hover:text-primary transition-colors pr-20">
              {template.name}
            </h3>
            <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <HardDrive className="h-3 w-3" />
                {formatBytes(template.size_bytes)}
              </span>
              {template.uploaded_at && (
                <>
                  <span className="w-1 h-1 rounded-full bg-border" />
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3 w-3" />
                    {formatDate(template.uploaded_at)}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-5 pt-4 border-t">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-2 h-9"
            onClick={onPreview}
          >
            <Eye className="h-3.5 w-3.5" />
            {tc("preview")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0 text-muted-foreground hover:text-primary"
            onClick={onDownload}
          >
            <Download className="h-4 w-4" />
          </Button>
          {onDelete && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
