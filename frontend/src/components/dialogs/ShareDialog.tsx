"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { docShare, projectShare, ShareInfo, ProjectShareInfo } from "@/lib/api";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Link2,
  Loader2,
  Copy,
  Check,
  Trash2,
  Globe,
  ExternalLink,
  LinkIcon,
  AlertCircle,
  FolderOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ShareDialogBaseProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  languages: string[];
  defaultLanguage?: string;
  onShareChange?: (isShared: boolean) => void;
}

interface DocShareDialogProps extends ShareDialogBaseProps {
  docId: string;
  docTitle: string;
  projectId?: never;
  projectTitle?: never;
}

interface ProjectShareDialogProps extends ShareDialogBaseProps {
  projectId: string;
  projectTitle: string;
  docId?: never;
  docTitle?: never;
}

type ShareDialogProps = DocShareDialogProps | ProjectShareDialogProps;

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

export function ShareDialog(props: ShareDialogProps) {
  const {
    open,
    onOpenChange,
    languages,
    defaultLanguage,
    onShareChange,
  } = props;

  // Determine if this is a project or doc share
  const isProject = "projectId" in props && !!props.projectId;
  const itemId = isProject ? props.projectId! : props.docId!;
  const itemTitle = isProject ? props.projectTitle! : props.docTitle!;

  const t = useTranslations("share");
  const tc = useTranslations("common");

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState(
    defaultLanguage || languages[0] || "en"
  );
  const [shareInfo, setShareInfo] = useState<ShareInfo | ProjectShareInfo | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCompiled, setIsCompiled] = useState(true); // For projects: check if compiled

  // Load share status when dialog opens
  useEffect(() => {
    if (open && itemId) {
      loadShareStatus();
    }
  }, [open, itemId, isProject]);

  // Reset copied state after delay
  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [copied]);

  const loadShareStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (isProject) {
        const status = await projectShare.getStatus(itemId);
        setShareInfo(status.share_info);
        setIsCompiled(status.is_compiled);
        if (status.share_info) {
          setSelectedLanguage(status.share_info.language);
        }
      } else {
        const status = await docShare.getStatus(itemId);
        setShareInfo(status.share_info);
        if (status.share_info) {
          setSelectedLanguage(status.share_info.language);
        }
      }
    } catch (err) {
      console.error("Failed to load share status:", err);
      setError(t("loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [itemId, isProject, t]);

  async function handleCreateShare() {
    setCreating(true);
    setError(null);
    try {
      const info = isProject
        ? await projectShare.create(itemId, selectedLanguage)
        : await docShare.create(itemId, selectedLanguage);
      setShareInfo(info);
      onShareChange?.(true);
      toast.success(t("shareCreated"), {
        description: t("shareCreatedDesc"),
      });
    } catch (err: unknown) {
      console.error("Failed to create share:", err);
      // Check if this is a "not compiled" error for projects
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (isProject && errorMessage.includes("not compiled")) {
        setError(t("projectNotCompiled"));
        setIsCompiled(false);
      } else {
        setError(t("createFailed"));
      }
      toast.error(tc("error"), {
        description: isProject && errorMessage.includes("not compiled")
          ? t("projectNotCompiled")
          : t("createFailed"),
      });
    } finally {
      setCreating(false);
    }
  }

  async function handleRevokeShare() {
    setRevoking(true);
    setError(null);
    try {
      if (isProject) {
        await projectShare.revoke(itemId);
      } else {
        await docShare.revoke(itemId);
      }
      setShareInfo(null);
      setShowRevokeConfirm(false);
      onShareChange?.(false);
      toast.success(t("shareRevoked"), {
        description: t("shareRevokedDesc"),
      });
    } catch (err) {
      console.error("Failed to revoke share:", err);
      setError(t("revokeFailed"));
      toast.error(tc("error"), {
        description: t("revokeFailed"),
      });
    } finally {
      setRevoking(false);
    }
  }

  function getShareUrl(): string {
    if (!shareInfo) return "";
    // Build full URL using window.location.origin
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    // Projects use /share/project/{token}, docs use /share/{token}
    return isProject
      ? `${origin}/share/project/${shareInfo.token}`
      : `${origin}/share/${shareInfo.token}`;
  }

  async function handleCopyLink() {
    const url = getShareUrl();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success(t("linkCopied"), {
        description: t("linkCopiedDesc"),
      });
    } catch (err) {
      console.error("Failed to copy:", err);
      toast.error(tc("error"), {
        description: t("copyFailed"),
      });
    }
  }

  function handleOpenLink() {
    const url = getShareUrl();
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display text-xl">
              {isProject ? (
                <FolderOpen className="h-5 w-5 text-primary" />
              ) : (
                <Link2 className="h-5 w-5 text-primary" />
              )}
              {isProject ? t("projectTitle") : t("title")}
            </DialogTitle>
            <DialogDescription>
              {shareInfo
                ? isProject
                  ? t("projectDescriptionShared")
                  : t("descriptionShared")
                : isProject
                  ? t("projectDescription")
                  : t("description")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : shareInfo ? (
              /* Shared state - show link */
              <div className="space-y-4">
                {/* Share URL display */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Globe className="h-4 w-4 text-emerald-500" />
                    {t("publicLink")}
                  </Label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        readOnly
                        value={getShareUrl()}
                        className={cn(
                          "w-full rounded-lg border bg-muted/50 px-3 py-2.5 pr-20",
                          "text-sm font-mono text-foreground/90",
                          "focus:outline-none focus:ring-2 focus:ring-primary/20",
                          "transition-all duration-200"
                        )}
                        onClick={(e) => (e.target as HTMLInputElement).select()}
                      />
                      <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={handleCopyLink}
                          className={cn(
                            "h-7 px-2 transition-all duration-200",
                            copied && "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30"
                          )}
                        >
                          {copied ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={handleOpenLink}
                          className="h-7 px-2"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Share info */}
                <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t("language")}</span>
                    <span className="font-medium">
                      {LANGUAGE_NAMES[shareInfo.language] || shareInfo.language.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t("createdAt")}</span>
                    <span className="font-medium">
                      {new Date(shareInfo.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t("expires")}</span>
                    <span className="font-medium text-emerald-600 dark:text-emerald-400">
                      {t("never")}
                    </span>
                  </div>
                </div>

                {/* Revoke button */}
                <Button
                  variant="outline"
                  className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
                  onClick={() => setShowRevokeConfirm(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t("revokeShare")}
                </Button>
              </div>
            ) : (
              /* Not shared - show create form */
              <div className="space-y-4">
                {/* Not compiled warning for projects */}
                {isProject && !isCompiled && (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
                    <div className="flex gap-3">
                      <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                          {t("projectNotCompiledTitle")}
                        </p>
                        <p className="text-xs text-amber-600/80 dark:text-amber-400/80">
                          {t("projectNotCompiledDesc")}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Language selector */}
                {languages.length > 1 && (isProject ? isCompiled : true) && (
                  <div className="space-y-2">
                    <Label htmlFor="share-language" className="text-sm font-medium">
                      {t("selectLanguage")}
                    </Label>
                    <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                      <SelectTrigger id="share-language">
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
                    <p className="text-xs text-muted-foreground">
                      {t("languageHint")}
                    </p>
                  </div>
                )}

                {/* Info box - show only when can share */}
                {(!isProject || isCompiled) && (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                    <div className="flex gap-3">
                      <LinkIcon className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="text-sm font-medium">
                          {isProject ? t("projectInfoTitle") : t("infoTitle")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {isProject ? t("projectInfoDescription") : t("infoDescription")}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3">
                    <p className="text-sm text-destructive">{error}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {tc("close")}
            </Button>
            {!loading && !shareInfo && (!isProject || isCompiled) && (
              <Button onClick={handleCreateShare} disabled={creating}>
                {creating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("creating")}
                  </>
                ) : (
                  <>
                    <Link2 className="mr-2 h-4 w-4" />
                    {isProject ? t("createProjectShare") : t("createShare")}
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke confirmation dialog */}
      <AlertDialog open={showRevokeConfirm} onOpenChange={setShowRevokeConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("revokeConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("revokeConfirmDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revoking}>
              {tc("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevokeShare}
              disabled={revoking}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {revoking ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("revoking")}
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t("revokeShare")}
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
