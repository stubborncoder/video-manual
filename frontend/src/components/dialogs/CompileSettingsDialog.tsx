"use client";

import { Fragment, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2, Check, X, AlertCircle, CheckCircle2 } from "lucide-react";
import { projects } from "@/lib/api";
import type { CompileInfo, CompileSettings } from "@/lib/types";

interface CompileSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
  onStartCompile: (settings: CompileSettings) => void;
}

export function CompileSettingsDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
  onStartCompile,
}: CompileSettingsDialogProps) {
  const t = useTranslations("compile");
  const tc = useTranslations("common");
  const [loading, setLoading] = useState(true);
  const [compileInfo, setCompileInfo] = useState<CompileInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Settings state
  const [selectedLanguage, setSelectedLanguage] = useState<string>("");
  const [includeToc, setIncludeToc] = useState(true);
  const [includeChapterCovers, setIncludeChapterCovers] = useState(true);

  // Fetch compile info when dialog opens
  useEffect(() => {
    if (open && projectId) {
      setLoading(true);
      setError(null);
      projects
        .getCompileInfo(projectId)
        .then((info) => {
          setCompileInfo(info);
          // Default to first ready language, or first available language
          if (info.ready_languages.length > 0) {
            setSelectedLanguage(info.ready_languages[0]);
          } else if (info.all_languages.length > 0) {
            setSelectedLanguage(info.all_languages[0]);
          }
        })
        .catch((e) => {
          setError(e.message || "Failed to load compile info");
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [open, projectId]);

  // Check if selected language is valid (all manuals have it)
  const isLanguageReady = compileInfo?.ready_languages.includes(selectedLanguage) ?? false;

  // Get list of manuals missing the selected language
  const missingManuals: { chapterTitle: string; manualTitle: string }[] = [];
  if (compileInfo && selectedLanguage) {
    for (const chapter of compileInfo.chapters) {
      for (const manual of chapter.manuals) {
        if (!manual.available_languages.includes(selectedLanguage)) {
          missingManuals.push({
            chapterTitle: chapter.title,
            manualTitle: manual.title,
          });
        }
      }
    }
  }

  const canCompile = isLanguageReady && !loading && !error;

  const handleStartCompile = () => {
    onStartCompile({
      language: selectedLanguage,
      includeToc,
      includeChapterCovers,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("title")}: {projectName}</DialogTitle>
          <DialogDescription>
            {t("description")}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 text-destructive py-4">
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
          </div>
        ) : compileInfo ? (
          <div className="space-y-6">
            {/* Language Selection */}
            <div className="space-y-2">
              <Label>Select Language</Label>
              <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a language" />
                </SelectTrigger>
                <SelectContent>
                  {compileInfo.all_languages.map((lang) => {
                    const isReady = compileInfo.ready_languages.includes(lang);
                    const manualCount = compileInfo.chapters.reduce(
                      (acc, ch) =>
                        acc +
                        ch.manuals.filter((m) => m.available_languages.includes(lang)).length,
                      0
                    );
                    return (
                      <SelectItem key={lang} value={lang}>
                        <span className="flex items-center gap-2">
                          {lang.toUpperCase()}
                          <span className="text-muted-foreground text-sm">
                            ({manualCount}/{compileInfo.total_manuals} manuals)
                          </span>
                          {isReady && <Check className="h-4 w-4 text-green-500" />}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Coverage Table */}
            <div className="space-y-2">
              <Label>Manual Language Coverage</Label>
              <div className="border rounded-md overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-2 font-medium">Chapter / Manual</th>
                      {compileInfo.all_languages.map((lang) => (
                        <th key={lang} className="text-center p-2 font-medium w-12">
                          {lang.toUpperCase()}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {compileInfo.chapters.map((chapter) => (
                      <Fragment key={`chapter-${chapter.id}`}>
                        <tr className="bg-muted/30">
                          <td colSpan={compileInfo.all_languages.length + 1} className="p-2 font-medium">
                            {chapter.title}
                          </td>
                        </tr>
                        {chapter.manuals.map((manual) => (
                          <tr key={`manual-${manual.id}`} className="border-t">
                            <td className="p-2 pl-6">{manual.title}</td>
                            {compileInfo.all_languages.map((lang) => {
                              const hasLang = manual.available_languages.includes(lang);
                              const isSelected = lang === selectedLanguage;
                              return (
                                <td
                                  key={lang}
                                  className={`text-center p-2 ${
                                    isSelected && !hasLang ? "bg-destructive/10" : ""
                                  }`}
                                >
                                  {hasLang ? (
                                    <Check className="h-4 w-4 text-green-500 mx-auto" />
                                  ) : (
                                    <X className="h-4 w-4 text-muted-foreground mx-auto" />
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Validation Status */}
            {selectedLanguage && (
              <div
                className={`p-3 rounded-md ${
                  isLanguageReady
                    ? "bg-green-500/10 border border-green-500/20"
                    : "bg-destructive/10 border border-destructive/20"
                }`}
              >
                {isLanguageReady ? (
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                    <CheckCircle2 className="h-5 w-5" />
                    <span>
                      Ready to compile: All {compileInfo.total_manuals} manuals have{" "}
                      {selectedLanguage.toUpperCase()} content
                    </span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-destructive">
                      <AlertCircle className="h-5 w-5" />
                      <span>
                        Cannot compile in {selectedLanguage.toUpperCase()}: Missing translations
                      </span>
                    </div>
                    <ul className="text-sm text-muted-foreground pl-7 space-y-1">
                      {missingManuals.map((m, i) => (
                        <li key={i}>
                          &quot;{m.manualTitle}&quot; needs {selectedLanguage.toUpperCase()} translation
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Options */}
            <div className="space-y-3">
              <Label>Options</Label>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="include-toc"
                    checked={includeToc}
                    onCheckedChange={(checked) => setIncludeToc(checked === true)}
                  />
                  <Label htmlFor="include-toc" className="font-normal">
                    {t("includeTableOfContents")}
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="include-chapter-covers"
                    checked={includeChapterCovers}
                    onCheckedChange={(checked) => setIncludeChapterCovers(checked === true)}
                  />
                  <Label htmlFor="include-chapter-covers" className="font-normal">
                    {t("includePageNumbers")}
                  </Label>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tc("cancel")}
          </Button>
          <Button onClick={handleStartCompile} disabled={!canCompile}>
            {t("compiling")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
