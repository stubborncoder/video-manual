"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { templates, TemplateInfo } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
} from "lucide-react";
import { SidebarToggle } from "@/components/layout/SidebarToggle";
import { cn } from "@/lib/utils";
import { TemplatePreviewDialog } from "@/components/dialogs/TemplatePreviewDialog";

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

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex gap-3">
          <SidebarToggle className="mt-1.5 shrink-0" />
          <div>
            <h1 className="font-display text-3xl tracking-tight">{t("title")}</h1>
            <p className="text-muted-foreground mt-1">
              {t("description")}
            </p>
          </div>
        </div>
        <Button onClick={() => fileInputRef.current?.click()} className="gap-2">
          <Plus className="h-4 w-4" />
          {t("upload")}
        </Button>
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
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
          <button
            onClick={() => setError(null)}
            className="float-right hover:opacity-70"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Templates Grid */}
      {!loading && (
        <div className="space-y-8">
          {/* User Templates */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary/10">
                <User className="h-4 w-4 text-primary" />
              </div>
              <h2 className="font-display text-xl">{t("yourTemplates")}</h2>
              <Badge variant="secondary" className="ml-auto">
                {userTemplates.length}
              </Badge>
            </div>

            {userTemplates.length === 0 ? (
              <Card
                className="border-dashed cursor-pointer transition-all hover:border-primary/50 hover:bg-primary/5"
                onClick={() => fileInputRef.current?.click()}
              >
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="rounded-2xl bg-muted p-4 mb-4 transition-colors group-hover:bg-primary/10">
                    <Upload className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground">
                    {t("noCustomTemplates")}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t("clickToUpload")}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {userTemplates.map((template) => (
                  <TemplateCard
                    key={template.name}
                    template={template}
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

          {/* Global Templates */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary/10">
                <Globe className="h-4 w-4 text-primary" />
              </div>
              <h2 className="font-display text-xl">{t("defaultTemplates")}</h2>
              <Badge variant="secondary" className="ml-auto">
                {globalTemplates.length}
              </Badge>
            </div>

            {globalTemplates.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex items-center justify-center py-8 text-muted-foreground">
                  {t("noDefaultTemplates")}
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {globalTemplates.map((template) => (
                  <TemplateCard
                    key={template.name}
                    template={template}
                    onPreview={() => setPreviewTemplate({ name: template.name, isGlobal: true })}
                    onDownload={() => window.open(templates.download(template.name))}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-xl">{t("uploadDialogTitle")}</DialogTitle>
            <DialogDescription>
              {t("uploadDialogDesc")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {uploadFile && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                <FileText className="h-8 w-8 text-primary" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{uploadFile.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatBytes(uploadFile.size)}
                  </p>
                </div>
                <Check className="h-5 w-5 text-green-500" />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="template-name">{t("templateName")}</Label>
              <Input
                id="template-name"
                placeholder="e.g., company-brand"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {t("templateNameHint")}
              </p>
            </div>
          </div>

          <DialogFooter>
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
            <Button onClick={handleUpload} disabled={uploading || !uploadFile}>
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("uploading")}
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  {tc("upload")}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-xl">{t("deleteDialogTitle")}</DialogTitle>
            <DialogDescription>
              {t("deleteDialogDesc", { name: selectedTemplate?.name || "" })}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("deleting")}
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
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

interface TemplateCardProps {
  template: TemplateInfo;
  onPreview: () => void;
  onDownload: () => void;
  onDelete?: () => void;
}

function TemplateCard({ template, onPreview, onDownload, onDelete }: TemplateCardProps) {
  const tc = useTranslations("common");
  return (
    <Card className="group relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 hover:border-primary/30">
      {/* Gradient accent on hover */}
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary/0 via-primary to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity" />

      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className="flex-shrink-0">
            <div className="relative">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              {template.is_global && (
                <div className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Sparkles className="h-3 w-3" />
                </div>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold truncate">{template.name}</h3>
            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
              <span>{formatBytes(template.size_bytes)}</span>
              {template.uploaded_at && (
                <>
                  <span className="text-border">•</span>
                  <span>{formatDate(template.uploaded_at)}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-4 pt-4 border-t">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={onPreview}
          >
            <Eye className="mr-2 h-3.5 w-3.5" />
            {tc("preview")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground"
            onClick={onDownload}
          >
            <Download className="h-4 w-4" />
          </Button>
          {onDelete && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
