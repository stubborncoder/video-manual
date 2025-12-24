"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { docs, ManualSummary } from "@/lib/api";
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
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import {
  Copy,
  Loader2,
  FileText,
  ListOrdered,
  BookOpen,
  FileSearch,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CloneManualDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  manual: ManualSummary;
  onSuccess: (newManual: ManualSummary) => void;
}

const DOCUMENT_FORMATS = [
  {
    value: "step-manual",
    label: "Step-by-step Manual",
    description: "Numbered steps with one action each",
    icon: ListOrdered,
  },
  {
    value: "quick-guide",
    label: "Quick Guide",
    description: "Concise overview for quick reference",
    icon: FileText,
  },
  {
    value: "reference",
    label: "Reference Document",
    description: "Technical reference organized by topic",
    icon: BookOpen,
  },
  {
    value: "summary",
    label: "Executive Summary",
    description: "High-level overview for stakeholders",
    icon: FileSearch,
  },
] as const;

export function CloneManualDialog({
  open,
  onOpenChange,
  manual,
  onSuccess,
}: CloneManualDialogProps) {
  const t = useTranslations("clone");
  const tc = useTranslations("common");
  const [targetFormat, setTargetFormat] = useState<string>("");
  const [customTitle, setCustomTitle] = useState("");
  const [reformatContent, setReformatContent] = useState(false);
  const [cloning, setCloning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Current format of the source manual
  const sourceFormat = manual.document_format || "step-manual";

  // Available formats (exclude current format)
  const availableFormats = DOCUMENT_FORMATS.filter(
    (f) => f.value !== sourceFormat
  );

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      // Default to first available format
      setTargetFormat(availableFormats[0]?.value || "");
      setCustomTitle("");
      setReformatContent(false);
      setError(null);
    }
  }, [open, sourceFormat]);

  async function handleClone() {
    if (!targetFormat) {
      setError("Please select a target format");
      return;
    }

    setCloning(true);
    setError(null);

    try {
      const newManual = await docs.clone(
        manual.id,
        targetFormat,
        customTitle || undefined,
        reformatContent
      );
      onSuccess(newManual);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Clone failed");
    } finally {
      setCloning(false);
    }
  }

  const selectedFormat = DOCUMENT_FORMATS.find((f) => f.value === targetFormat);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            <Copy className="h-5 w-5 text-primary" />
            {t("title")}
          </DialogTitle>
          <DialogDescription>
            {t("description")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4 overflow-y-auto flex-1">
          {/* Current Format */}
          <div className="rounded-lg bg-muted/50 p-3">
            <span className="text-xs font-medium text-muted-foreground">
              Current format:
            </span>
            <span className="ml-2 font-medium">
              {DOCUMENT_FORMATS.find((f) => f.value === sourceFormat)?.label ||
                sourceFormat}
            </span>
          </div>

          {/* Target Format Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">{t("targetFormat")}</Label>
            <RadioGroup
              value={targetFormat}
              onValueChange={setTargetFormat}
              className="grid gap-3"
            >
              {availableFormats.map((format) => {
                const Icon = format.icon;
                return (
                  <Label
                    key={format.value}
                    htmlFor={format.value}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all",
                      targetFormat === format.value
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/30 hover:bg-muted/50"
                    )}
                  >
                    <RadioGroupItem
                      value={format.value}
                      id={format.value}
                      className="sr-only"
                    />
                    <div
                      className={cn(
                        "flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center",
                        targetFormat === format.value
                          ? "bg-primary/20"
                          : "bg-muted"
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-5 w-5",
                          targetFormat === format.value
                            ? "text-primary"
                            : "text-muted-foreground"
                        )}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span
                        className={cn(
                          "font-medium",
                          targetFormat === format.value && "text-primary"
                        )}
                      >
                        {format.label}
                      </span>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {format.description}
                      </p>
                    </div>
                    <div
                      className={cn(
                        "w-4 h-4 rounded-full border-2 flex-shrink-0 transition-all",
                        targetFormat === format.value
                          ? "border-primary bg-primary"
                          : "border-muted-foreground/30"
                      )}
                    >
                      {targetFormat === format.value && (
                        <svg
                          className="w-full h-full text-primary-foreground"
                          viewBox="0 0 16 16"
                        >
                          <path
                            fill="currentColor"
                            d="M6.5 10.5L4 8l-.7.7 3.2 3.2 6.5-6.5-.7-.7z"
                          />
                        </svg>
                      )}
                    </div>
                  </Label>
                );
              })}
            </RadioGroup>
          </div>

          {/* Custom Title */}
          <div className="space-y-2">
            <Label htmlFor="title" className="text-sm font-medium">
              Title (optional)
            </Label>
            <Input
              id="title"
              placeholder={`${manual.title} (${selectedFormat?.label || ""})`}
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Leave empty to auto-generate from original title
            </p>
          </div>

          {/* AI Reformat Toggle */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label
                htmlFor="reformat"
                className="text-sm font-medium flex items-center gap-2"
              >
                <Sparkles className="h-4 w-4 text-amber-500" />
                AI Content Reformatting
              </Label>
              <p className="text-xs text-muted-foreground">
                Use AI to adapt the content style to the new format
              </p>
            </div>
            <Switch
              id="reformat"
              checked={reformatContent}
              onCheckedChange={setReformatContent}
            />
          </div>

          {reformatContent && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm text-amber-800">
                <strong>Note:</strong> AI reformatting will restructure the
                content to match the target format style. This may take a few
                moments for large manuals.
              </p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
        </div>

        {/* Processing State */}
        {cloning && (
          <div className="rounded-lg border bg-muted/50 p-4 flex items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-primary shrink-0" />
            <div>
              <p className="font-medium text-sm">
                {reformatContent ? "Reformatting Content..." : "Cloning Manual..."}
              </p>
              <p className="text-xs text-muted-foreground">
                {reformatContent
                  ? "AI is adapting the content. This may take a moment."
                  : "Copying screenshots and content..."}
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="shrink-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={cloning}
          >
            {tc("cancel")}
          </Button>
          <Button onClick={handleClone} disabled={cloning || !targetFormat}>
            {cloning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("cloning")}
              </>
            ) : (
              <>
                <Copy className="mr-2 h-4 w-4" />
                {t("title")}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
