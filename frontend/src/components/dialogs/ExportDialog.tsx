"use client";

import { useState, useEffect } from "react";
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
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  languages: string[];
  onExport: (options: ExportOptions) => Promise<void>;
  defaultLanguage?: string;
  showFormat?: boolean;
}

export interface ExportOptions {
  format: "pdf" | "word" | "html";
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
    value: "html",
    label: "HTML",
    description: "Web-ready format",
    icon: "🌐",
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

export function ExportDialog({
  open,
  onOpenChange,
  title,
  languages,
  onExport,
  defaultLanguage,
  showFormat = true,
}: ExportDialogProps) {
  // When showFormat is false, we're doing Word-only export
  const defaultFormat = showFormat ? "pdf" : "word";
  const [format, setFormat] = useState<"pdf" | "word" | "html">(defaultFormat);
  const [language, setLanguage] = useState(defaultLanguage || languages[0] || "en");
  const [templateName, setTemplateName] = useState<string>("");
  const [templateList, setTemplateList] = useState<TemplateInfo[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [exporting, setExporting] = useState(false);

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
      setTemplateName("");
    }
  }, [open, defaultLanguage, languages, defaultFormat]);

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
      await onExport({
        format,
        language,
        templateName: format === "word" && templateName ? templateName : undefined,
      });
      onOpenChange(false);
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setExporting(false);
    }
  }

  const selectedFormat = FORMAT_OPTIONS.find((f) => f.value === format);
  const userTemplates = templateList.filter((t) => !t.is_global);
  const globalTemplates = templateList.filter((t) => t.is_global);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            Export {title}
          </DialogTitle>
          <DialogDescription>
            Choose your export format and options
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Format Selection */}
          {showFormat && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">Format</Label>
              <RadioGroup
                value={format}
                onValueChange={(v) => setFormat(v as typeof format)}
                className="grid grid-cols-3 gap-3"
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
              <Label htmlFor="language">Language</Label>
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
                  Word Template
                </Label>
                {loadingTemplates && (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>

              {!loadingTemplates && templateList.length === 0 ? (
                <div className="rounded-lg border border-dashed p-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    No templates available
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Default formatting will be used
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* No template option */}
                  <TemplateOption
                    selected={templateName === ""}
                    onClick={() => setTemplateName("")}
                    name="Default"
                    description="Use standard formatting"
                    isDefault
                  />

                  {/* User templates */}
                  {userTemplates.length > 0 && (
                    <div className="pt-2">
                      <div className="flex items-center gap-2 mb-2">
                        <User className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Your Templates
                        </span>
                      </div>
                      {userTemplates.map((t) => (
                        <TemplateOption
                          key={t.name}
                          selected={templateName === t.name}
                          onClick={() => setTemplateName(t.name)}
                          name={t.name}
                          description={formatBytes(t.size_bytes)}
                        />
                      ))}
                    </div>
                  )}

                  {/* Global templates */}
                  {globalTemplates.length > 0 && (
                    <div className="pt-2">
                      <div className="flex items-center gap-2 mb-2">
                        <Globe className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Default Templates
                        </span>
                      </div>
                      {globalTemplates.map((t) => (
                        <TemplateOption
                          key={t.name}
                          selected={templateName === t.name}
                          onClick={() => setTemplateName(t.name)}
                          name={t.name}
                          description={formatBytes(t.size_bytes)}
                          isGlobal
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={exporting}>
            {exporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Export as {selectedFormat?.label}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface TemplateOptionProps {
  selected: boolean;
  onClick: () => void;
  name: string;
  description: string;
  isDefault?: boolean;
  isGlobal?: boolean;
}

function TemplateOption({
  selected,
  onClick,
  name,
  description,
  isDefault,
  isGlobal,
}: TemplateOptionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left",
        selected
          ? "border-primary bg-primary/5 ring-1 ring-primary/20"
          : "border-border hover:border-primary/30 hover:bg-muted/30"
      )}
    >
      <div
        className={cn(
          "flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center",
          selected ? "bg-primary/20" : "bg-muted"
        )}
      >
        {isDefault ? (
          <FileText className={cn("h-5 w-5", selected ? "text-primary" : "text-muted-foreground")} />
        ) : (
          <LayoutTemplate className={cn("h-5 w-5", selected ? "text-primary" : "text-muted-foreground")} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn("font-medium truncate", selected && "text-primary")}>
            {name}
          </span>
          {isGlobal && (
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
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}
