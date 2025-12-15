"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
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
  ArrowLeft,
  FileText,
  Code,
  Loader2,
  List,
  Download,
  FileDown,
  Pencil,
  Check,
  X,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import { Input } from "@/components/ui/input";

import { manuals, type ManualDetail } from "@/lib/api";
import { transformSemanticTagsForPreview } from "@/lib/tag-utils";
import { useUndoRedo } from "@/hooks/useUndoRedo";
import { useAutoSave } from "@/hooks/useAutoSave";
import { useKeyboardShortcuts, createEditorShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useTextSelection } from "@/hooks/useTextSelection";
import { useEditorCopilot, type PendingDocumentChange } from "@/hooks/useEditorCopilot";
import { EditorStatusBar } from "@/components/editor/EditorStatusBar";
import { VersionHistoryDialog } from "@/components/editor/VersionHistoryDialog";
import { CopilotPanel } from "@/components/editor/CopilotPanel";
import { PendingChangesOverlay } from "@/components/editor/PendingChangesOverlay";
import { SelectionHighlightOverlay } from "@/components/editor/SelectionHighlightOverlay";
import { LineNumberedTextarea } from "@/components/editor/LineNumberedTextarea";
import { SemanticTagHighlighter } from "@/components/editor/SemanticTagHighlighter";
import { ImageLightbox } from "@/components/editor/ImageLightbox";
import { VideoDrawer } from "@/components/editor/VideoDrawer";
import { AddVideoDialog } from "@/components/editor/AddVideoDialog";
import { ImageContextMenu } from "@/components/editor/ImageContextMenu";
import { ImagePlaceholder } from "@/components/editor/ImagePlaceholder";
import { PreviewContextMenu } from "@/components/editor/PreviewContextMenu";
import type { ImageContext } from "@/components/editor/ImageContextChip";

// Active image state for lightbox
interface ActiveImageState {
  url: string;
  name: string;
  caption: string;
  timestamp?: number;
  markdownRef: string; // Original markdown reference e.g., "![caption](filename.png)"
}

export default function ManualEditorPage() {
  const t = useTranslations("editManual");
  const tCommon = useTranslations("common");
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  const manualId = params.id as string;
  const language = searchParams.get("lang") || "en";

  // Document state
  const [loading, setLoading] = useState(true);
  const [manual, setManual] = useState<ManualDetail | null>(null);
  const [originalContent, setOriginalContent] = useState("");
  const [availableLanguages, setAvailableLanguages] = useState<string[]>([]);

  // UI state
  const [activeTab, setActiveTab] = useState<"preview" | "markdown">("preview");
  const [showCopilot, setShowCopilot] = useState(true);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showLineNumbers, setShowLineNumbers] = useState(false);

  // Title editing state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editingTitle, setEditingTitle] = useState("");
  const [savingTitle, setSavingTitle] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Image lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [activeImage, setActiveImage] = useState<ActiveImageState | null>(null);
  const [videoDrawerOpen, setVideoDrawerOpen] = useState(false);
  const [addVideoDialogOpen, setAddVideoDialogOpen] = useState(false);
  const [selectedFrameTimestamp, setSelectedFrameTimestamp] = useState(0);
  const [selectedVideoId, setSelectedVideoId] = useState<string>("primary");

  // Direct action state (for context menu shortcuts)
  const [directAction, setDirectAction] = useState<"annotate" | "caption" | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Image placeholder state (for selecting frame to replace placeholder)
  const [activePlaceholder, setActivePlaceholder] = useState<{
    description: string;
    suggestedTimestamp: number;
    markdownLine: string;
  } | null>(null);

  // Direct screenshot insertion state (for context menu "Insert Screenshot")
  const [isDirectInsertMode, setIsDirectInsertMode] = useState(false);
  const [directInsertLine, setDirectInsertLine] = useState<number | null>(null);

  // Image context for AI chat (similar to text selection)
  const [imageContext, setImageContext] = useState<ImageContext | null>(null);

  // Cache buster for images - incremented when images are replaced
  const [imageCacheBuster, setImageCacheBuster] = useState(Date.now());

  // Track if images have been changed (for save button state)
  const [hasImageChanges, setHasImageChanges] = useState(false);

  // Refs for document preview
  const previewRef = useRef<HTMLDivElement>(null);          // Inner content for text selection
  const previewContainerRef = useRef<HTMLDivElement>(null); // Scrollable container for overlay positioning

  // Use undo/redo hook
  const {
    currentContent,
    canUndo,
    canRedo,
    hasUnsavedChanges,
    unsavedChangesCount,
    isInitialized,
    recordChange,
    undo,
    redo,
    markAsSaved,
  } = useUndoRedo(manualId, originalContent);

  // Use text selection hook
  const { selection, clearSelection, hasSelection } = useTextSelection({
    containerRef: previewRef,
    enabled: activeTab === "preview",
    minLength: 3,
  });

  // Handle applying a change to the document
  // Use ref to avoid stale closure with currentContent
  const currentContentRef = useRef(currentContent);
  useEffect(() => {
    currentContentRef.current = currentContent;
  }, [currentContent]);

  // Track applied changes to prevent double-application during rapid updates
  const appliedChangesRef = useRef<Set<string>>(new Set());

  const handleApplyChange = useCallback(
    (change: PendingDocumentChange) => {
      // Prevent double-application (can happen with rapid state updates)
      if (appliedChangesRef.current.has(change.id)) {
        return;
      }
      appliedChangesRef.current.add(change.id);

      // Use ref to get latest content (avoid stale closure)
      const content = currentContentRef.current;
      const lines = content.split("\n");

      // Safeguard: Protect existing images from being deleted or modified
      // Images are markdown references like ![caption](filename.png)
      const imageLinePattern = /^!\[.*\]\(.*\)$/;
      const isImageLine = (line: string) => imageLinePattern.test(line.trim());

      if (change.type === "text_replace" || change.type === "text_delete") {
        if (change.startLine && change.endLine) {
          // Check if any line in the range is an existing image
          for (let i = change.startLine - 1; i < change.endLine && i < lines.length; i++) {
            if (isImageLine(lines[i])) {
              toast.error("Cannot modify existing images", {
                description: `Line ${i + 1} contains an image. Use the image tools to modify images.`,
              });
              appliedChangesRef.current.delete(change.id);
              return;
            }
          }
        }
      }

      // Note: We allow new images to be inserted (text_insert with image syntax)
      // This enables future features like inserting images from video at specific points

      let newLines: string[];

      switch (change.type) {
        case "text_replace":
          if (change.startLine && change.endLine && change.newContent !== undefined) {
            // Replace lines (1-indexed to 0-indexed)
            const before = lines.slice(0, change.startLine - 1);
            const after = lines.slice(change.endLine);
            const newContentLines = change.newContent.split("\n");
            newLines = [...before, ...newContentLines, ...after];
          } else {
            appliedChangesRef.current.delete(change.id);
            return;
          }
          break;

        case "text_insert":
        case "image_placeholder":
          if (change.afterLine !== undefined && change.newContent !== undefined) {
            // Insert after line (1-indexed, 0 means at beginning)
            const insertIndex = change.afterLine;
            const newContentLines = change.newContent.split("\n");
            newLines = [
              ...lines.slice(0, insertIndex),
              ...newContentLines,
              ...lines.slice(insertIndex),
            ];
          } else {
            appliedChangesRef.current.delete(change.id);
            return;
          }
          break;

        case "text_delete":
          if (change.startLine && change.endLine) {
            // Delete lines (1-indexed to 0-indexed)
            const before = lines.slice(0, change.startLine - 1);
            const after = lines.slice(change.endLine);
            newLines = [...before, ...after];
          } else {
            appliedChangesRef.current.delete(change.id);
            return;
          }
          break;

        case "caption_update":
          // TODO: Handle caption updates for images
          toast.info("Caption update applied");
          return;

        default:
          appliedChangesRef.current.delete(change.id);
          return;
      }

      const newContent = newLines.join("\n");
      recordChange(newContent, `Applied: ${change.reason || change.type}`);

      // Update the ref immediately so subsequent changes see the updated content
      currentContentRef.current = newContent;

      toast.success(t("changeApplied"));
    },
    [recordChange, t]
  );

  // Use editor copilot hook
  const {
    messages,
    pendingChanges,
    isConnected,
    isGenerating,
    sendMessage,
    stopGeneration,
    acceptChange,
    rejectChange,
    clearChat,
  } = useEditorCopilot({
    manualId,
    language,
    documentContent: currentContent,
    onChangeAccepted: handleApplyChange,
  });

  // Save callback for auto-save
  const handleSaveContent = useCallback(
    async (content: string) => {
      await manuals.updateContent(manualId, content, language);
      setOriginalContent(content);
      markAsSaved();
    },
    [manualId, language, markAsSaved]
  );

  // Use auto-save hook
  const {
    lastSavedAt,
    isSaving,
    lastError,
    saveNow,
  } = useAutoSave(currentContent, originalContent, {
    interval: 120000, // 2 minutes
    onSave: handleSaveContent,
    enabled: true,
  });

  // Manual save handler
  const handleSave = useCallback(async () => {
    // Allow save if there are content changes OR image changes
    if ((!hasUnsavedChanges && !hasImageChanges) || isSaving) return;

    // If only image changes (no content changes), we don't need to call save API
    // because the image replacement endpoint already created the version snapshot
    if (hasImageChanges && !hasUnsavedChanges) {
      setHasImageChanges(false);
      toast.success("Changes saved");
      return;
    }

    // Save content changes
    const result = await saveNow();
    if (result.success) {
      setHasImageChanges(false); // Reset image changes flag
      toast.success(t("manualSaved"));
    } else {
      toast.error(t("saveFailed"), {
        description: result.error?.message || "An unknown error occurred"
      });
    }
  }, [hasUnsavedChanges, hasImageChanges, isSaving, saveNow, t]);

  // Handle undo with toast
  const handleUndo = useCallback(() => {
    const command = undo();
    if (command) {
      toast.info("Undone", { duration: 1500 });
    }
  }, [undo]);

  // Handle redo with toast
  const handleRedo = useCallback(() => {
    const command = redo();
    if (command) {
      toast.info("Redone", { duration: 1500 });
    }
  }, [redo]);

  // Keyboard shortcuts
  const shortcuts = useMemo(
    () =>
      createEditorShortcuts({
        onUndo: handleUndo,
        onRedo: handleRedo,
        onSave: handleSave,
      }),
    [handleUndo, handleRedo, handleSave]
  );

  useKeyboardShortcuts({
    shortcuts,
    enabled: isInitialized && !loading,
  });

  // Load manual content
  useEffect(() => {
    loadManual();
  }, [manualId, language]);

  async function loadManual() {
    setLoading(true);
    try {
      const [manualData, languagesData] = await Promise.all([
        manuals.get(manualId, language),
        manuals.getLanguages(manualId),
      ]);

      setManual(manualData);
      setOriginalContent(manualData.content);
      setAvailableLanguages(languagesData.languages);

      // If current language isn't in available languages, redirect to first available
      if (languagesData.languages.length > 0 && !languagesData.languages.includes(language)) {
        const firstLang = languagesData.languages[0];
        router.replace(`/dashboard/manuals/${manualId}/edit?lang=${firstLang}`);
        return;
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to load manual";
      toast.error(t("loadFailed"), { description: message });
      router.push("/dashboard/manuals");
    } finally {
      setLoading(false);
    }
  }

  // Handle content changes from textarea
  const handleContentChange = useCallback(
    (newContent: string) => {
      recordChange(newContent, "Edit content");
    },
    [recordChange]
  );

  // Handle language change
  function handleLanguageChange(newLang: string) {
    if (hasUnsavedChanges) {
      setPendingNavigation(`/dashboard/manuals/${manualId}/edit?lang=${newLang}`);
      setShowUnsavedDialog(true);
    } else {
      router.push(`/dashboard/manuals/${manualId}/edit?lang=${newLang}`);
    }
  }

  // Build URL with preserved filter params
  const manualsListUrl = useMemo(() => {
    const filterParams = new URLSearchParams();
    const project = searchParams.get("project");
    const tags = searchParams.get("tags");
    if (project) filterParams.set("project", project);
    if (tags) filterParams.set("tags", tags);
    const queryString = filterParams.toString();
    return queryString ? `/dashboard/manuals?${queryString}` : "/dashboard/manuals";
  }, [searchParams]);

  // Handle back navigation
  function handleBack() {
    if (hasUnsavedChanges) {
      setPendingNavigation(manualsListUrl);
      setShowUnsavedDialog(true);
    } else {
      router.push(manualsListUrl);
    }
  }

  // Proceed with navigation after unsaved warning
  function proceedWithNavigation() {
    if (pendingNavigation) {
      router.push(pendingNavigation);
    }
    setShowUnsavedDialog(false);
    setPendingNavigation(null);
  }

  // Handle version restored
  const handleVersionRestored = useCallback(() => {
    loadManual();
  }, [manualId, language]);

  // Handle export
  const handleExport = useCallback(async (format: "pdf" | "word" | "html" | "chunks") => {
    try {
      const result = await manuals.export(manualId, format, language);

      // Trigger automatic download
      const link = document.createElement('a');
      link.href = result.download_url;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success(t("exportedAs", { format: format.toUpperCase() }), {
        description: `${result.filename} (${(result.size_bytes / 1024).toFixed(1)} KB)`
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Export failed";
      toast.error(t("exportFailed"), { description: message });
    }
  }, [manualId, language, t]);

  // Title editing handlers
  const startEditingTitle = useCallback(() => {
    setEditingTitle(manual?.title || manualId);
    setIsEditingTitle(true);
    // Focus input after state update
    setTimeout(() => titleInputRef.current?.focus(), 0);
  }, [manual?.title, manualId]);

  const cancelEditingTitle = useCallback(() => {
    setIsEditingTitle(false);
    setEditingTitle("");
  }, []);

  const saveTitle = useCallback(async () => {
    const trimmedTitle = editingTitle.trim();
    if (!trimmedTitle || trimmedTitle === manual?.title) {
      cancelEditingTitle();
      return;
    }

    setSavingTitle(true);
    try {
      await manuals.updateTitle(manualId, trimmedTitle);
      // Update local state
      setManual((prev) => prev ? { ...prev, title: trimmedTitle } : prev);
      setIsEditingTitle(false);
      toast.success(t("titleUpdated"));
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to update title";
      toast.error(t("failedToSaveTitle"), { description: message });
    } finally {
      setSavingTitle(false);
    }
  }, [editingTitle, manual?.title, manualId, cancelEditingTitle, t]);

  const handleTitleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      saveTitle();
    } else if (e.key === "Escape") {
      cancelEditingTitle();
    }
  }, [saveTitle, cancelEditingTitle]);

  // Handle chat message send
  const handleSendMessage = useCallback(
    (content: string, sel: typeof selection, imgContext?: ImageContext) => {
      sendMessage(content, sel, imgContext);
    },
    [sendMessage]
  );

  // Handle image click - open lightbox or perform direct action
  const handleImageClick = useCallback(
    (imageUrl: string, imageName: string, caption: string, action?: "annotate" | "caption" | "full") => {
      // Build the markdown reference for this image
      const markdownRef = `![${caption}](${imageName})`;

      // Extract timestamp from filename (e.g., "figure_01_t8s.png" -> 8)
      const timestampMatch = imageName.match(/_t(\d+)s\./);
      const timestamp = timestampMatch ? parseInt(timestampMatch[1], 10) : undefined;

      setActiveImage({
        url: imageUrl,
        name: imageName,
        caption: caption || "",
        timestamp,
        markdownRef,
      });

      // Set direct action if specified
      setDirectAction(action === "annotate" ? "annotate" : action === "caption" ? "caption" : null);
      setLightboxOpen(true);
    },
    []
  );

  // Handle direct upload from context menu
  const handleDirectUpload = useCallback(
    (imageUrl: string, imageName: string, caption: string) => {
      // Set up the active image
      const markdownRef = `![${caption}](${imageName})`;
      const timestampMatch = imageName.match(/_t(\d+)s\./);
      const timestamp = timestampMatch ? parseInt(timestampMatch[1], 10) : undefined;

      setActiveImage({
        url: imageUrl,
        name: imageName,
        caption: caption || "",
        timestamp,
        markdownRef,
      });

      // Trigger file input
      fileInputRef.current?.click();
    },
    []
  );

  // Handle file input change for direct upload
  const handleDirectFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !activeImage) return;

      try {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch(`/api/manuals/${manualId}/screenshots/${activeImage.name}/replace`, {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          throw new Error("Failed to upload image");
        }

        // Force refresh all images
        const newCacheBuster = Date.now();
        setImageCacheBuster(newCacheBuster);
        setHasImageChanges(true);
        toast.success("Image replaced");
      } catch {
        toast.error("Failed to upload image");
      }

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setActiveImage(null);
    },
    [activeImage, manualId]
  );

  // Handle direct video replacement from context menu
  const handleDirectVideoReplace = useCallback(
    (imageUrl: string, imageName: string, caption: string) => {
      // Set up the active image
      const markdownRef = `![${caption}](${imageName})`;
      const timestampMatch = imageName.match(/_t(\d+)s\./);
      const timestamp = timestampMatch ? parseInt(timestampMatch[1], 10) : undefined;

      setActiveImage({
        url: imageUrl,
        name: imageName,
        caption: caption || "",
        timestamp,
        markdownRef,
      });

      // Open video drawer
      setSelectedFrameTimestamp(timestamp || 0);
      setVideoDrawerOpen(true);
    },
    []
  );

  // Handle Ask AI about image from context menu
  const handleAskAIAboutImage = useCallback(
    (imageUrl: string, imageName: string) => {
      // Set image context (similar to text selection) - user will type their own question
      setImageContext({ url: imageUrl, name: imageName });
    },
    []
  );

  // Clear image context
  const clearImageContext = useCallback(() => {
    setImageContext(null);
  }, []);

  // Handle caption change from lightbox
  const handleCaptionChange = useCallback(
    (newCaption: string) => {
      if (!activeImage) return;

      // Find and replace the markdown image reference with the new caption
      const oldMarkdownPattern = new RegExp(
        `!\\[([^\\]]*)\\]\\(${activeImage.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)`,
        'g'
      );
      const newMarkdownRef = `![${newCaption}](${activeImage.name})`;

      const newContent = currentContentRef.current.replace(oldMarkdownPattern, newMarkdownRef);

      if (newContent !== currentContentRef.current) {
        recordChange(newContent, `Update caption: "${newCaption}"`);
        setActiveImage((prev) => prev ? { ...prev, caption: newCaption, markdownRef: newMarkdownRef } : null);
        toast.success(t("captionUpdated"));
      }
    },
    [activeImage, recordChange, t]
  );

  // Handle image replacement (from video or upload)
  const handleImageReplace = useCallback(
    async (source: "video" | "upload", data: { timestamp?: number; file?: File; videoId?: string }) => {
      if (!activeImage) return;

      try {
        if (source === "upload" && data.file) {
          // Upload the file to replace the screenshot
          const formData = new FormData();
          formData.append("file", data.file);

          const response = await fetch(`/api/manuals/${manualId}/screenshots/${activeImage.name}/replace`, {
            method: "POST",
            body: formData,
          });

          if (!response.ok) {
            throw new Error("Failed to upload image");
          }

          // Force refresh all images by updating cache buster
          const newCacheBuster = Date.now();
          setImageCacheBuster(newCacheBuster);
          setActiveImage((prev) => prev ? { ...prev, url: `${activeImage.url.split('?')[0]}?t=${newCacheBuster}` } : null);
          setHasImageChanges(true);
          toast.success(t("imageReplaced"));
        } else if (source === "video" && data.timestamp !== undefined) {
          // Replace with frame from video (supports both primary and additional videos)
          const videoId = data.videoId || "primary";
          const response = await fetch(
            `/api/manuals/${manualId}/screenshots/${activeImage.name}/from-frame?timestamp=${data.timestamp}&video_id=${videoId}`,
            { method: "POST" }
          );

          if (!response.ok) {
            throw new Error("Failed to extract frame");
          }

          // Force refresh all images by updating cache buster
          const newCacheBuster = Date.now();
          setImageCacheBuster(newCacheBuster);
          setActiveImage((prev) => prev ? { ...prev, url: `${activeImage.url.split('?')[0]}?t=${newCacheBuster}` } : null);
          setHasImageChanges(true);
          toast.success(t("imageReplacedFromFrame"));
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to replace image";
        toast.error(t("replaceFailed"), { description: message });
      }
    },
    [activeImage, manualId, t]
  );

  // Handle image deletion
  const handleImageDelete = useCallback(() => {
    if (!activeImage) return;

    // Find and remove the markdown image reference
    const imagePattern = new RegExp(
      `!\\[([^\\]]*)\\]\\(${activeImage.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)\\n?`,
      'g'
    );

    const newContent = currentContentRef.current.replace(imagePattern, '');

    if (newContent !== currentContentRef.current) {
      recordChange(newContent, `Delete image: ${activeImage.name}`);
      toast.success(t("imageDeleted"));
    }

    // Close lightbox
    setLightboxOpen(false);
    setActiveImage(null);

    // TODO: Also delete the file from the server
    // fetch(`/api/manuals/${manualId}/screenshots/${activeImage.name}`, { method: "DELETE" });
  }, [activeImage, recordChange, t]);

  // Handle opening video drawer for frame selection
  const handleOpenVideoDrawer = useCallback(() => {
    if (!manual?.source_video?.exists) {
      toast.error(t("sourceVideoNotAvailable"));
      return;
    }
    setSelectedFrameTimestamp(activeImage?.timestamp || 0);
    // Keep lightbox open, video drawer will appear on top
    setVideoDrawerOpen(true);
  }, [manual?.source_video, activeImage?.timestamp, t]);

  // Handle frame selection in video drawer
  const handleFrameSelect = useCallback((timestamp: number) => {
    setSelectedFrameTimestamp(timestamp);
  }, []);

  // Handle confirming frame selection from video drawer
  const handleConfirmFrame = useCallback(
    async (timestamp: number, videoId?: string) => {
      if (!activeImage) return;

      // Use the video frame replacement (with optional videoId for additional videos)
      await handleImageReplace("video", { timestamp, videoId });

      // Close the video drawer
      setVideoDrawerOpen(false);
    },
    [activeImage, handleImageReplace]
  );

  // Handle opening add video dialog (closes video drawer first)
  const handleOpenAddVideoDialog = useCallback(() => {
    setVideoDrawerOpen(false);
    setAddVideoDialogOpen(true);
  }, []);

  // Handle video upload success - reopen video drawer to show the new video
  const handleVideoUploadSuccess = useCallback(() => {
    toast.success("Video uploaded successfully");
    // Reopen the video drawer so user can select the new video
    setVideoDrawerOpen(true);
  }, []);

  // Handle clicking "Select Frame" on a placeholder
  const handlePlaceholderSelectFrame = useCallback(
    (description: string, suggestedTimestamp: number, markdownLine: string) => {
      if (!manual?.source_video?.exists) {
        toast.error(t("sourceVideoNotAvailable"));
        return;
      }
      setActivePlaceholder({ description, suggestedTimestamp, markdownLine });
      setSelectedFrameTimestamp(suggestedTimestamp);
      setVideoDrawerOpen(true);
    },
    [manual?.source_video?.exists, t]
  );

  // Handle confirming frame selection for a placeholder
  const handlePlaceholderFrameConfirm = useCallback(
    async (timestamp: number, videoId?: string) => {
      if (!activePlaceholder) return;

      try {
        // Extract frame from video and save as new screenshot
        const vid = videoId || "primary";
        const response = await fetch(
          `/api/manuals/${manualId}/screenshots/extract?timestamp=${timestamp}&video_id=${vid}`,
          { method: "POST" }
        );

        if (!response.ok) {
          throw new Error("Failed to extract frame");
        }

        const result = await response.json();
        const newImageFilename = result.filename; // e.g., "figure_05_t45s.png"

        // Replace the placeholder line with the actual image markdown
        const newImageMarkdown = `![${activePlaceholder.description}](${newImageFilename})`;
        const newContent = currentContentRef.current.replace(
          activePlaceholder.markdownLine,
          newImageMarkdown
        );

        if (newContent !== currentContentRef.current) {
          recordChange(newContent, `Add screenshot: ${activePlaceholder.description}`);
          currentContentRef.current = newContent;
          toast.success(t("imageInserted"));
        }

        // Close video drawer and clear placeholder state
        setVideoDrawerOpen(false);
        setActivePlaceholder(null);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to insert image";
        toast.error(t("insertFailed"), { description: message });
      }
    },
    [activePlaceholder, manualId, recordChange, t]
  );

  // Handle direct screenshot insertion from context menu
  const handleDirectInsertScreenshot = useCallback(
    (afterLine: number | null) => {
      if (!manual?.source_video?.exists) {
        toast.error(t("sourceVideoNotAvailable"));
        return;
      }
      // Store the insertion line (or null for end of document)
      setIsDirectInsertMode(true);
      setDirectInsertLine(afterLine);
      setSelectedFrameTimestamp(0); // Start at beginning
      setVideoDrawerOpen(true);
    },
    [manual?.source_video?.exists, t]
  );

  // Handle confirming frame selection for direct insertion
  const handleDirectInsertFrameConfirm = useCallback(
    async (timestamp: number, videoId?: string) => {
      try {
        // Extract frame from video and save as new screenshot
        const vid = videoId || "primary";
        const response = await fetch(
          `/api/manuals/${manualId}/screenshots/extract?timestamp=${timestamp}&video_id=${vid}`,
          { method: "POST" }
        );

        if (!response.ok) {
          throw new Error("Failed to extract frame");
        }

        const result = await response.json();
        const newImageFilename = result.filename;

        // Create image markdown
        const newImageMarkdown = `![Screenshot](${newImageFilename})`;

        // Insert at the specified line or at end
        const lines = currentContentRef.current.split("\n");
        let newLines: string[];

        if (directInsertLine !== null && directInsertLine > 0 && directInsertLine <= lines.length) {
          // Insert after the specified line
          newLines = [
            ...lines.slice(0, directInsertLine),
            "",
            newImageMarkdown,
            "",
            ...lines.slice(directInsertLine),
          ];
        } else {
          // Insert at end
          newLines = [...lines, "", newImageMarkdown];
        }

        const newContent = newLines.join("\n");
        recordChange(newContent, "Insert screenshot");
        currentContentRef.current = newContent;
        toast.success(t("imageInserted"));

        // Close video drawer and clear state
        setVideoDrawerOpen(false);
        setIsDirectInsertMode(false);
        setDirectInsertLine(null);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to insert image";
        toast.error(t("insertFailed"), { description: message });
      }
    },
    [directInsertLine, manualId, recordChange, t]
  );

  // Calculate total lines for overlay positioning
  const totalLines = useMemo(() => {
    return currentContent.split("\n").length;
  }, [currentContent]);

  // Preprocess markdown to fix setext heading issues and transform semantic tags for preview
  // (--- without blank line before it becomes h2 instead of hr)
  const processedContent = useMemo(() => {
    // Transform semantic tags: convert <step> to visible labels, strip other tags
    const withoutTags = transformSemanticTagsForPreview(currentContent);
    // Add blank line before --- that follows non-blank lines (to make them hr, not setext h2)
    return withoutTags.replace(/([^\n])\n(---+)\n/g, '$1\n\n$2\n');
  }, [currentContent]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">{t("loadingManual")}</p>
        </div>
      </div>
    );
  }

  if (!manual) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">{t("manualNotFound")}</p>
          <Link href="/dashboard/manuals">
            <Button className="mt-4">{t("backToManuals")}</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Top Toolbar */}
      <div className="border-b px-4 py-2 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {tCommon("back")}
          </Button>

          <div className="h-4 w-px bg-border" />

          {/* Editable Title */}
          {isEditingTitle ? (
            <div className="flex items-center gap-1">
              <Input
                ref={titleInputRef}
                value={editingTitle}
                onChange={(e) => setEditingTitle(e.target.value)}
                onKeyDown={handleTitleKeyDown}
                onBlur={saveTitle}
                className="h-8 w-[280px] font-semibold"
                disabled={savingTitle}
                maxLength={200}
              />
              {savingTitle ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={saveTitle}
                  >
                    <Check className="h-4 w-4 text-green-600" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={cancelEditingTitle}
                  >
                    <X className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </>
              )}
            </div>
          ) : (
            <button
              onClick={startEditingTitle}
              className="group flex items-center gap-2 font-semibold truncate max-w-[300px] hover:text-primary transition-colors"
              title="Click to edit title"
            >
              <span>{manual?.title || manualId}</span>
              <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />
            </button>
          )}

          {/* Document format badge */}
          {manual?.document_format && (
            <Badge
              variant="secondary"
              className="text-xs px-2 py-0.5 font-medium bg-primary/10 text-primary"
            >
              {manual.document_format === "step-manual" && "Step-by-step"}
              {manual.document_format === "quick-guide" && "Quick Guide"}
              {manual.document_format === "reference" && "Reference"}
              {manual.document_format === "summary" && "Summary"}
              {!["step-manual", "quick-guide", "reference", "summary"].includes(manual.document_format) && manual.document_format}
            </Badge>
          )}

          {availableLanguages.length > 1 ? (
            <Select value={language} onValueChange={handleLanguageChange}>
              <SelectTrigger className="w-[100px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableLanguages.map((lang) => (
                  <SelectItem key={lang} value={lang}>
                    {lang.toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : availableLanguages.length === 1 ? (
            <Badge variant="outline" className="text-xs">
              {availableLanguages[0].toUpperCase()}
            </Badge>
          ) : null}

          {hasUnsavedChanges && (
            <Badge variant="secondary" className="text-xs">
              {t("unsavedChanges")}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Download className="mr-2 h-4 w-4" />
                {tCommon("export")}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport("pdf")}>
                <FileDown className="mr-2 h-4 w-4" />
                {t("exportAsPdf")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("word")}>
                <FileDown className="mr-2 h-4 w-4" />
                {t("exportAsWord")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("html")}>
                <FileDown className="mr-2 h-4 w-4" />
                {t("exportAsHtml")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant={showCopilot ? "default" : "outline"}
            size="sm"
            onClick={() => setShowCopilot(!showCopilot)}
            title={showCopilot ? t("hideAssistant") : t("showAssistant")}
          >
            <Sparkles className="h-4 w-4" />
          </Button>
        </div>

      </div>

      {/* Main Content - Two Panel Layout */}
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        {/* Left Panel - Document Editor */}
        <ResizablePanel defaultSize={60} minSize={40}>
          <div className="h-full flex flex-col overflow-hidden">
            <Tabs
              value={activeTab}
              onValueChange={(v) => setActiveTab(v as "preview" | "markdown")}
              className="flex-1 flex flex-col min-h-0"
            >
              <div className="border-b px-4 py-2 shrink-0 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TabsList>
                    <TabsTrigger value="preview" className="gap-2">
                      <FileText className="h-4 w-4" />
                      {t("preview")}
                    </TabsTrigger>
                    <TabsTrigger value="markdown" className="gap-2">
                      <Code className="h-4 w-4" />
                      {t("markdown")}
                    </TabsTrigger>
                  </TabsList>

                  <Button
                    variant={showLineNumbers ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setShowLineNumbers(!showLineNumbers)}
                    title="Toggle line numbers"
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>

                {hasSelection && activeTab === "preview" && (
                  <Badge variant="outline" className="text-xs">
                    {t("textSelected")}
                  </Badge>
                )}
              </div>

              <TabsContent
                value="preview"
                className="flex-1 m-0 p-0 min-h-0 overflow-hidden"
              >
                <PreviewContextMenu
                  hasVideo={!!manual?.source_video?.exists}
                  onInsertScreenshot={handleDirectInsertScreenshot}
                  contentRef={previewRef}
                  markdownContent={currentContent}
                >
                  <div
                    ref={previewContainerRef}
                    className="h-full overflow-y-auto p-6 relative"
                  >
                    {/* Pending changes overlay */}
                    <PendingChangesOverlay
                      changes={pendingChanges}
                      containerRef={previewContainerRef}
                      totalLines={totalLines}
                      onAccept={acceptChange}
                      onReject={rejectChange}
                    />

                    <div
                      ref={previewRef}
                      className="prose prose-base dark:prose-invert max-w-none relative"
                    >
                  {/* Selection highlight overlay - renders pre-calculated highlight rects */}
                  <SelectionHighlightOverlay
                    selection={selection}
                    enabled={activeTab === "preview" && hasSelection}
                  />

                  {/* Render full markdown content */}
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeRaw]}
                    urlTransform={(url) => {
                      // Allow placeholder: URLs for image placeholders
                      if (url.startsWith("placeholder:")) {
                        return url;
                      }
                      // For all other URLs, use default behavior (allows http, https, mailto, etc.)
                      // Return undefined to use default transform, or the URL to allow it
                      return url;
                    }}
                    components={{
                      img: ({ src, alt }) => {
                        const srcStr = typeof src === "string" ? src : "";

                        // Check if this is a placeholder image
                        if (srcStr.startsWith("placeholder:")) {
                          // Parse placeholder: ![IMAGE_NEEDED: description](placeholder:timestamp)
                          const timestampStr = srcStr.replace("placeholder:", "");
                          const suggestedTimestamp = parseFloat(timestampStr) || 0;

                          // Extract description from alt text (remove "IMAGE_NEEDED: " prefix)
                          const description = alt?.replace(/^IMAGE_NEEDED:\s*/i, "") || "Screenshot needed";

                          // Build the full markdown line for replacement
                          const markdownLine = `![${alt || ""}](${srcStr})`;

                          return (
                            <ImagePlaceholder
                              description={description}
                              suggestedTimestamp={suggestedTimestamp}
                              hasVideo={!!manual?.source_video?.exists}
                              onSelectFrame={() =>
                                handlePlaceholderSelectFrame(description, suggestedTimestamp, markdownLine)
                              }
                              onDelete={() => {
                                // Remove the placeholder line from content
                                const lines = currentContentRef.current.split("\n");
                                const newLines = lines.filter(line => line.trim() !== markdownLine.trim());
                                const newContent = newLines.join("\n");
                                if (newContent !== currentContentRef.current) {
                                  recordChange(newContent, "Remove placeholder");
                                  currentContentRef.current = newContent;
                                  toast.success("Placeholder removed");
                                }
                              }}
                            />
                          );
                        }

                        // Regular image
                        const filename = srcStr.split("/").pop() || srcStr;
                        const apiUrl = `/api/manuals/${manualId}/screenshots/${filename}?t=${imageCacheBuster}`;
                        return (
                          <span className="block my-6">
                            <ImageContextMenu
                              hasVideo={!!manual?.source_video?.exists}
                              onOpenFull={() => handleImageClick(apiUrl, filename, alt || "", "full")}
                              onReplaceFromVideo={() => handleDirectVideoReplace(apiUrl, filename, alt || "")}
                              onUpload={() => handleDirectUpload(apiUrl, filename, alt || "")}
                              onAnnotate={() => handleImageClick(apiUrl, filename, alt || "", "annotate")}
                              onEditCaption={() => handleImageClick(apiUrl, filename, alt || "", "caption")}
                              onAskAI={() => handleAskAIAboutImage(apiUrl, filename)}
                              onDelete={() => {
                                // Set up active image and open lightbox to show delete confirmation
                                handleImageClick(apiUrl, filename, alt || "", "full");
                              }}
                            >
                              <img
                                src={apiUrl}
                                alt={alt || "Screenshot"}
                                className="rounded-lg border shadow-sm w-full cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
                                title="Click for image options"
                              />
                            </ImageContextMenu>
                            {alt && (
                              <span className="block text-center text-sm text-muted-foreground mt-2">
                                {alt}
                              </span>
                            )}
                          </span>
                        );
                      },
                    }}
                  >
                    {processedContent}
                    </ReactMarkdown>
                    </div>
                  </div>
                </PreviewContextMenu>
              </TabsContent>

              <TabsContent
                value="markdown"
                className="flex-1 m-0 p-0 min-h-0 overflow-hidden"
              >
                <SemanticTagHighlighter
                  content={currentContent}
                  onChange={handleContentChange}
                  showLineNumbers={showLineNumbers}
                  showTagHighlighting={true}
                  showCollapsibleRegions={true}
                  placeholder="Enter markdown content..."
                />
              </TabsContent>
            </Tabs>

            {/* Editor Status Bar */}
            <EditorStatusBar
              canUndo={canUndo}
              canRedo={canRedo}
              onUndo={handleUndo}
              onRedo={handleRedo}
              lastSavedAt={lastSavedAt}
              isSaving={isSaving}
              hasUnsavedChanges={hasUnsavedChanges}
              hasImageChanges={hasImageChanges}
              unsavedChangesCount={unsavedChangesCount}
              onSave={handleSave}
              onOpenVersionHistory={() => setShowVersionHistory(true)}
              lastError={lastError}
            />
          </div>
        </ResizablePanel>

        {showCopilot && (
          <>
            <ResizableHandle withHandle />

            {/* Right Panel - Copilot Chat */}
            <ResizablePanel defaultSize={40} minSize={25}>
              <CopilotPanel
                messages={messages}
                pendingChanges={pendingChanges}
                selection={selection}
                onClearSelection={clearSelection}
                imageContext={imageContext}
                onClearImageContext={clearImageContext}
                onSendMessage={handleSendMessage}
                onStopGeneration={stopGeneration}
                onClearChat={clearChat}
                onAcceptChange={acceptChange}
                onRejectChange={rejectChange}
                isGenerating={isGenerating}
                isConnected={isConnected}
                isPaused={activeTab === "markdown"}
              />
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>

      {/* Unsaved Changes Dialog */}
      <AlertDialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("unsavedChanges")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("unsavedChangesDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingNavigation(null)}>
              {tCommon("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction onClick={proceedWithNavigation}>
              {t("leaveWithoutSaving")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Version History Dialog */}
      <VersionHistoryDialog
        open={showVersionHistory}
        onOpenChange={setShowVersionHistory}
        manualId={manualId}
        language={language}
        onRestored={handleVersionRestored}
      />

      {/* Image Lightbox */}
      {activeImage && (
        <ImageLightbox
          open={lightboxOpen}
          onOpenChange={setLightboxOpen}
          imageUrl={activeImage.url}
          imageName={activeImage.name}
          caption={activeImage.caption}
          manualId={manualId}
          videoUrl={manual?.source_video?.exists ? `/api/videos/${manual.source_video.name}/stream` : undefined}
          originalTimestamp={activeImage.timestamp}
          onCaptionChange={handleCaptionChange}
          onReplace={handleImageReplace}
          onDelete={handleImageDelete}
          onOpenVideoDrawer={handleOpenVideoDrawer}
          directAction={directAction}
          onDirectActionHandled={() => setDirectAction(null)}
        />
      )}

      {/* Video Drawer for frame selection */}
      {manual?.source_video?.exists && (
        <VideoDrawer
          open={videoDrawerOpen}
          onOpenChange={(open) => {
            setVideoDrawerOpen(open);
            // Clear state if drawer is closed without selecting
            if (!open) {
              setActivePlaceholder(null);
              setIsDirectInsertMode(false);
              setDirectInsertLine(null);
            }
          }}
          videoUrl={`/api/videos/${manual.source_video.name}/stream`}
          currentTimestamp={selectedFrameTimestamp}
          manualId={manualId}
          onFrameSelect={handleFrameSelect}
          onConfirmFrame={
            activePlaceholder
              ? handlePlaceholderFrameConfirm
              : isDirectInsertMode
                ? handleDirectInsertFrameConfirm
                : handleConfirmFrame
          }
          onAddVideo={handleOpenAddVideoDialog}
          selectedVideoId={selectedVideoId}
          onVideoChange={setSelectedVideoId}
        />
      )}

      {/* Add Video Dialog */}
      <AddVideoDialog
        open={addVideoDialogOpen}
        onOpenChange={setAddVideoDialogOpen}
        manualId={manualId}
        onSuccess={handleVideoUploadSuccess}
      />

      {/* Hidden file input for direct uploads from context menu */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleDirectFileSelect}
      />
    </div>
  );
}
