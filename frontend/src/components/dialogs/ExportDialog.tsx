"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { templates, TemplateInfo } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  Download,
  Loader2,
  Globe,
  User,
  LayoutTemplate,
  Sparkles,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TemplatePreviewDialog } from "./TemplatePreviewDialog";

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  languages: string[];
  onExport: (options: ExportOptions) => Promise<void>;
  defaultLanguage?: string;
  showFormat?: boolean;
  /** Document format (step-manual, quick-guide, reference, summary) - auto-selects matching template */
  documentFormat?: string;
}

export interface ExportOptions {
  format: "pdf" | "word" | "html" | "chunks" | "markdown";
  language: string;
  templateName?: string;
}

const FORMAT_OPTIONS = [
  {
    value: "pdf",
    label: "PDF",
    description: "Print-ready document",
    icon: "📄",
  },
  {
    value: "word",
    label: "Word",
    description: "Editable .docx file",
    icon: "📝",
    supportsTemplate: true,
  },
  {
    value: "markdown",
    label: "Markdown",
    description: "Portable .md + images",
    icon: "📋",
  },
  {
    value: "html",
    label: "HTML",
    description: "Web-ready format",
    icon: "🌐",
  },
  {
    value: "chunks",
    label: "Chunks",
    description: "RAG pipeline format",
    icon: "🔗",
  },
] as const;

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  es: "Spanish",
  ca: "Catalan",
  fr: "French",
  de: "German",
  it: "Italian",
  pt: "Portuguese",
  zh: "Chinese",
  ja: "Japanese",
  ko: "Korean",
};

// Map document formats to their template names
const FORMAT_TEMPLATE_MAP: Record<string, string> = {
  // Instructional formats
  "step-manual": "step-manual",
  "quick-guide": "quick-guide",
  "reference": "reference",
  "summary": "summary",
  // Report formats
  "incident-report": "incident-report",
  "inspection-report": "inspection-report",
  "progress-report": "progress-report",
};

// Human-readable format names
const FORMAT_DISPLAY_NAMES: Record<string, string> = {
  // Instructional formats
  "step-manual": "Step-by-step Manual",
  "quick-guide": "Quick Guide",
  "reference": "Reference Document",
  "summary": "Executive Summary",
  // Report formats
  "incident-report": "Incident Report",
  "inspection-report": "Inspection Report",
  "progress-report": "Progress Report",
};

export function ExportDialog({
  open,
  onOpenChange,
  title,
  languages,
  onExport,
  defaultLanguage,
  showFormat = true,
  documentFormat,
}: ExportDialogProps) {
  const t = useTranslations("export");
  const tc = useTranslations("common");
  // When showFormat is false, we're doing Word-only export
  const defaultFormat = showFormat ? "pdf" : "word";
  const [format, setFormat] = useState<"pdf" | "word" | "html" | "chunks" | "markdown">(defaultFormat);
  const [language, setLanguage] = useState(defaultLanguage || languages[0] || "en");
  const [templateName, setTemplateName] = useState<string>("");
  const [templateList, setTemplateList] = useState<TemplateInfo[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<{ name: string; isGlobal: boolean } | null>(null);

  // Get the auto-selected template based on document format
  const autoSelectedTemplate = documentFormat ? FORMAT_TEMPLATE_MAP[documentFormat] : null;

  // Load templates when dialog opens and format is Word
  useEffect(() => {
    if (open && format === "word") {
      loadTemplates();
    }
  }, [open, format]);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setFormat(defaultFormat);
      setLanguage(defaultLanguage || languages[0] || "en");
      // Auto-select template based on document format
      setTemplateName(autoSelectedTemplate || "");
    }
  }, [open, defaultLanguage, languages, defaultFormat, autoSelectedTemplate]);

  async function loadTemplates() {
    setLoadingTemplates(true);
    try {
      const response = await templates.list();
      setTemplateList(response.templates);
    } catch (err) {
      console.error("Failed to load templates:", err);
    } finally {
      setLoadingTemplates(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      // For Word export, use the user's selected template (which defaults to autoSelectedTemplate)
      const effectiveTemplate = format === "word"
        ? (templateName || undefined)
        : undefined;

      await onExport({
        format,
        language,
        templateName: effectiveTemplate,
      });
      onOpenChange(false);
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setExporting(false);
    }
  }

  const selectedFormat = FORMAT_OPTIONS.find((f) => f.value === format);

  // Filter templates by document format
  // When a format filter is set, only show templates that explicitly match that format
  // Templates without a format only show when there's no format filter (generic export)
  const matchingUserTemplates = templateList.filter((t) => {
    if (t.is_global) return false;
    if (!autoSelectedTemplate) {
      // No format filter - show all user templates
      return true;
    }
    // Format filter is set - only show if template format matches exactly
    return t.document_format === autoSelectedTemplate;
  });
  const matchingGlobalTemplates = templateList.filter((t) => {
    if (!t.is_global) return false;
    if (!autoSelectedTemplate) {
      // No format filter - show all global templates
      return true;
    }
    // Format filter is set - show if format matches or name matches (for built-in templates)
    return t.document_format === autoSelectedTemplate || t.name === autoSelectedTemplate;
  });

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            {t("title")} {title}
          </DialogTitle>
          <DialogDescription>
            {t("selectFormat")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Format Selection */}
          {showFormat && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">{t("format")}</Label>
              <RadioGroup
                value={format}
                onValueChange={(v) => setFormat(v as typeof format)}
                className="grid grid-cols-5 gap-3"
              >
                {FORMAT_OPTIONS.map((option) => (
                  <Label
                    key={option.value}
                    htmlFor={option.value}
                    className={cn(
                      "flex flex-col items-center justify-center p-4 rounded-lg border-2 cursor-pointer transition-all",
                      format === option.value
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/30 hover:bg-muted/50"
                    )}
                  >
                    <RadioGroupItem
                      value={option.value}
                      id={option.value}
                      className="sr-only"
                    />
                    <span className="text-2xl mb-1">{option.icon}</span>
                    <span className="font-medium text-sm">{option.label}</span>
                    <span className="text-xs text-muted-foreground mt-0.5">
                      {option.description}
                    </span>
                  </Label>
                ))}
              </RadioGroup>
            </div>
          )}

          {/* Language Selection */}
          {languages.length > 1 && (
            <div className="space-y-2">
              <Label htmlFor="language">{t("language")}</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger id="language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {languages.map((lang) => (
                    <SelectItem key={lang} value={lang}>
                      {LANGUAGE_NAMES[lang] || lang.toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Template Selection (Word only) */}
          {format === "word" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <LayoutTemplate className="h-4 w-4 text-primary" />
                  {t("template")}
                </Label>
                {loadingTemplates && (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>

              {!loadingTemplates && templateList.length === 0 ? (
                <div className="rounded-lg border border-dashed p-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    {t("noTemplate")}
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                  {/* User templates */}
                  {matchingUserTemplates.length > 0 && (
                    <div className="pt-2">
                      <div className="flex items-center gap-2 mb-2">
                        <User className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Your Templates
                        </span>
                      </div>
                      {matchingUserTemplates.map((t) => (
                        <TemplateOption
                          key={t.name}
                          selected={templateName === t.name}
                          onClick={() => setTemplateName(t.name)}
                          onPreview={() => setPreviewTemplate({ name: t.name, isGlobal: false })}
                          name={t.name}
                          description={formatBytes(t.size_bytes)}
                        />
                      ))}
                    </div>
                  )}

                  {/* Global templates - show without header if only one */}
                  {matchingGlobalTemplates.map((t) => (
                    <TemplateOption
                      key={t.name}
                      selected={templateName === t.name}
                      onClick={() => setTemplateName(t.name)}
                      onPreview={() => setPreviewTemplate({ name: t.name, isGlobal: true })}
                      name={FORMAT_DISPLAY_NAMES[t.document_format || ""] || t.name}
                      description="Built-in template"
                      isGlobal
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tc("cancel")}
          </Button>
          <Button onClick={handleExport} disabled={exporting}>
            {exporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("exporting")}
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                {tc("export")} {selectedFormat?.label}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Template Preview Dialog - rendered outside main dialog */}
    <TemplatePreviewDialog
      open={!!previewTemplate}
      onOpenChange={(open) => !open && setPreviewTemplate(null)}
      templateName={previewTemplate?.name || ""}
      isGlobal={previewTemplate?.isGlobal}
    />
    </>
  );
}

interface TemplateOptionProps {
  selected: boolean;
  onClick: () => void;
  onPreview: () => void;
  name: string;
  description: string;
  isDefault?: boolean;
  isGlobal?: boolean;
  isRecommended?: boolean;
}

function TemplateOption({
  selected,
  onClick,
  onPreview,
  name,
  description,
  isDefault,
  isGlobal,
  isRecommended,
}: TemplateOptionProps) {
  return (
    <div
      className={cn(
        "w-full flex items-center gap-3 p-3 rounded-lg border transition-all",
        selected
          ? "border-primary bg-primary/5 ring-1 ring-primary/20"
          : isRecommended
          ? "border-amber-300 bg-amber-50/50 hover:border-amber-400"
          : "border-border hover:border-primary/30 hover:bg-muted/30"
      )}
    >
      <button
        type="button"
        onClick={onClick}
        className="flex items-center gap-3 flex-1 min-w-0 text-left"
      >
        <div
          className={cn(
            "flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center",
            selected ? "bg-primary/20" : isRecommended ? "bg-amber-100" : "bg-muted"
          )}
        >
          {isDefault ? (
            <FileText className={cn("h-5 w-5", selected ? "text-primary" : "text-muted-foreground")} />
          ) : (
            <LayoutTemplate className={cn("h-5 w-5", selected ? "text-primary" : isRecommended ? "text-amber-600" : "text-muted-foreground")} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn("font-medium truncate", selected && "text-primary")}>
              {name}
            </span>
            {isRecommended && (
              <span className="text-[10px] font-medium text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded">
                Recommended
              </span>
            )}
            {isGlobal && !isRecommended && (
              <Sparkles className="h-3 w-3 text-amber-500" />
            )}
          </div>
          <span className="text-xs text-muted-foreground">{description}</span>
        </div>
        <div
          className={cn(
            "w-4 h-4 rounded-full border-2 flex-shrink-0 transition-all",
            selected
              ? "border-primary bg-primary"
              : "border-muted-foreground/30"
          )}
        >
          {selected && (
            <svg className="w-full h-full text-primary-foreground" viewBox="0 0 16 16">
              <path
                fill="currentColor"
                d="M6.5 10.5L4 8l-.7.7 3.2 3.2 6.5-6.5-.7-.7z"
              />
            </svg>
          )}
        </div>
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onPreview();
        }}
        className="p-2 rounded-md hover:bg-muted transition-colors shrink-0"
        title="Preview template"
      >
        <Eye className="h-4 w-4 text-muted-foreground" />
      </button>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}
