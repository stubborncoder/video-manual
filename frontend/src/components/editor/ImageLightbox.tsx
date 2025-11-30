"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import { X, Video, Upload, Type, Trash2, ZoomIn, ZoomOut, RotateCcw, Pencil, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

// Dynamic import to avoid SSR issues with Fabric.js
const AnnotationEditor = dynamic(
  () => import("./AnnotationEditor").then((mod) => mod.AnnotationEditor),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center">
        <div className="flex items-center gap-2 text-white">
          <Loader2 className="h-6 w-6 animate-spin" />
          Loading annotation editor...
        </div>
      </div>
    )
  }
);
import { Input } from "@/components/ui/input";
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
import { cn } from "@/lib/utils";

interface ImageLightboxProps {
  /** Whether the lightbox is open */
  open: boolean;
  /** Callback to close the lightbox */
  onOpenChange: (open: boolean) => void;
  /** URL of the image to display */
  imageUrl: string;
  /** Filename of the image */
  imageName: string;
  /** Current caption/alt text */
  caption: string;
  /** Manual ID for API calls */
  manualId: string;
  /** Source video URL (if available) */
  videoUrl?: string;
  /** Original timestamp when screenshot was taken */
  originalTimestamp?: number;
  /** Callback when caption is changed */
  onCaptionChange: (newCaption: string) => void;
  /** Callback when image is replaced */
  onReplace: (source: "video" | "upload", data: { timestamp?: number; file?: File }) => void;
  /** Callback when image is deleted */
  onDelete: () => void;
  /** Callback to open video drawer for frame selection */
  onOpenVideoDrawer?: () => void;
  /** Direct action to perform when lightbox opens (from context menu shortcuts) */
  directAction?: "annotate" | "caption" | null;
  /** Callback to clear the direct action after it's been handled */
  onDirectActionHandled?: () => void;
}

/**
 * Full-screen lightbox for viewing and editing images in the manual editor.
 * Provides actions for replacing, uploading, editing captions, and deleting images.
 */
export function ImageLightbox({
  open,
  onOpenChange,
  imageUrl,
  imageName,
  caption,
  manualId,
  videoUrl,
  originalTimestamp,
  onCaptionChange,
  onReplace,
  onDelete,
  onOpenVideoDrawer,
  directAction,
  onDirectActionHandled,
}: ImageLightboxProps) {
  const [isEditingCaption, setIsEditingCaption] = useState(false);
  const [captionValue, setCaptionValue] = useState(caption);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [isAnnotating, setIsAnnotating] = useState(false);
  const [openedViaDirectAction, setOpenedViaDirectAction] = useState(false);
  const captionInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasHandledOpenRef = useRef(false);

  // Sync caption value when prop changes
  useEffect(() => {
    setCaptionValue(caption);
  }, [caption]);

  // Focus caption input when editing starts
  useEffect(() => {
    if (isEditingCaption && captionInputRef.current) {
      captionInputRef.current.focus();
      captionInputRef.current.select();
    }
  }, [isEditingCaption]);

  // Reset when lightbox closes
  useEffect(() => {
    if (!open) {
      hasHandledOpenRef.current = false;
    }
  }, [open]);

  // Handle opening - either with direct action or normal
  useEffect(() => {
    if (open && !hasHandledOpenRef.current) {
      hasHandledOpenRef.current = true;
      setZoom(1);

      if (directAction) {
        // Handle direct action from context menu shortcuts
        setOpenedViaDirectAction(true);
        if (directAction === "annotate") {
          setIsAnnotating(true);
          setIsEditingCaption(false);
        } else if (directAction === "caption") {
          setIsEditingCaption(true);
          setIsAnnotating(false);
        }
        // Clear the direct action after handling
        onDirectActionHandled?.();
      } else {
        // Normal open - reset states
        setIsAnnotating(false);
        setIsEditingCaption(false);
        setOpenedViaDirectAction(false);
      }
    }
  }, [open, directAction, onDirectActionHandled]);

  // Handle escape key (only when not in annotation mode)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open || isAnnotating) return; // Let annotation editor handle its own Escape

      if (e.key === "Escape") {
        if (isEditingCaption) {
          setIsEditingCaption(false);
          setCaptionValue(caption);
          // If opened via direct action, close the entire lightbox on cancel
          if (openedViaDirectAction) {
            onOpenChange(false);
          }
        } else {
          onOpenChange(false);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, isEditingCaption, isAnnotating, caption, onOpenChange, openedViaDirectAction]);

  // Handle caption save
  const handleCaptionSave = useCallback(() => {
    if (captionValue.trim() !== caption) {
      onCaptionChange(captionValue.trim());
    }
    setIsEditingCaption(false);
    // If opened via direct action, close the entire lightbox after saving
    if (openedViaDirectAction) {
      onOpenChange(false);
    }
  }, [captionValue, caption, onCaptionChange, openedViaDirectAction, onOpenChange]);

  // Handle caption key events
  const handleCaptionKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleCaptionSave();
      } else if (e.key === "Escape") {
        e.preventDefault();
        setCaptionValue(caption);
        setIsEditingCaption(false);
        // If opened via direct action, close the entire lightbox on cancel
        if (openedViaDirectAction) {
          onOpenChange(false);
        }
      }
    },
    [handleCaptionSave, caption, openedViaDirectAction, onOpenChange]
  );

  // Handle file upload
  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        onReplace("upload", { file });
      }
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [onReplace]
  );

  // Handle backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onOpenChange(false);
      }
    },
    [onOpenChange]
  );

  // Handle replace from video
  const handleReplaceFromVideo = useCallback(() => {
    if (onOpenVideoDrawer) {
      onOpenVideoDrawer();
    }
  }, [onOpenVideoDrawer]);

  // Handle delete confirmation
  const handleDeleteConfirm = useCallback(() => {
    onDelete();
    setShowDeleteConfirm(false);
    onOpenChange(false);
  }, [onDelete, onOpenChange]);

  // Zoom controls
  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.25, 3));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.25, 0.5));
  const handleZoomReset = () => setZoom(1);

  // Handle annotation save
  const handleAnnotationSave = useCallback(
    async (dataUrl: string) => {
      try {
        // Convert data URL to blob
        const response = await fetch(dataUrl);
        const blob = await response.blob();
        const file = new File([blob], imageName, { type: "image/png" });

        // Use existing upload replacement flow
        onReplace("upload", { file });
        setIsAnnotating(false);

        // If opened via direct action, close the entire lightbox after saving
        if (openedViaDirectAction) {
          onOpenChange(false);
        }
      } catch (error) {
        console.error("Failed to save annotated image:", error);
      }
    },
    [imageName, onReplace, openedViaDirectAction, onOpenChange]
  );

  if (!open) return null;

  // Show annotation editor if in annotation mode
  if (isAnnotating) {
    console.log("[ImageLightbox] Rendering AnnotationEditor with imageUrl:", imageUrl);
    return (
      <AnnotationEditor
        imageUrl={imageUrl}
        onSave={handleAnnotationSave}
        onCancel={() => {
          setIsAnnotating(false);
          // If opened via direct action, close the entire lightbox
          if (openedViaDirectAction) {
            onOpenChange(false);
          }
        }}
      />
    );
  }

  return (
    <>
      {/* Lightbox overlay */}
      <div
        className="fixed inset-0 z-50 bg-black/90 flex flex-col"
        onClick={handleBackdropClick}
      >
        {/* Top toolbar */}
        <div className="flex items-center justify-between px-4 py-3 bg-black/50">
          <div className="flex items-center gap-2 text-white">
            <span className="font-medium">{imageName}</span>
            {originalTimestamp !== undefined && (
              <span className="text-sm text-gray-400">
                @ {originalTimestamp.toFixed(1)}s
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Zoom controls */}
            <div className="flex items-center gap-1 mr-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleZoomOut}
                disabled={zoom <= 0.5}
                className="text-white hover:bg-white/20"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-white text-sm w-12 text-center">
                {Math.round(zoom * 100)}%
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleZoomIn}
                disabled={zoom >= 3}
                className="text-white hover:bg-white/20"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleZoomReset}
                disabled={zoom === 1}
                className="text-white hover:bg-white/20"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>

            {/* Close button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-white hover:bg-white/20"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Image container */}
        <div
          className="flex-1 flex items-center justify-center overflow-auto p-8"
          onClick={handleBackdropClick}
        >
          <img
            src={imageUrl}
            alt={caption || imageName}
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl transition-transform duration-200"
            style={{ transform: `scale(${zoom})` }}
            onClick={(e) => e.stopPropagation()}
            draggable={false}
          />
        </div>

        {/* Caption area */}
        <div className="px-4 py-2 bg-black/50">
          {isEditingCaption ? (
            <div className="flex items-center gap-2 max-w-2xl mx-auto">
              <Input
                ref={captionInputRef}
                value={captionValue}
                onChange={(e) => setCaptionValue(e.target.value)}
                onBlur={handleCaptionSave}
                onKeyDown={handleCaptionKeyDown}
                placeholder="Enter image caption..."
                className="bg-white/10 border-white/20 text-white placeholder:text-gray-400"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCaptionSave}
                className="text-white hover:bg-white/20"
              >
                Save
              </Button>
            </div>
          ) : (
            <p
              className={cn(
                "text-center text-gray-300 cursor-pointer hover:text-white transition-colors max-w-2xl mx-auto",
                !caption && "text-gray-500 italic"
              )}
              onClick={() => setIsEditingCaption(true)}
            >
              {caption || "Click to add caption..."}
            </p>
          )}
        </div>

        {/* Bottom action bar */}
        <div className="flex items-center justify-center gap-4 px-4 py-4 bg-black/50">
          {/* Replace from Video */}
          {videoUrl && (
            <Button
              variant="secondary"
              onClick={handleReplaceFromVideo}
              className="gap-2"
            >
              <Video className="h-4 w-4" />
              Replace from Video
            </Button>
          )}

          {/* Upload replacement */}
          <Button
            variant="secondary"
            onClick={() => fileInputRef.current?.click()}
            className="gap-2"
          >
            <Upload className="h-4 w-4" />
            Upload
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelect}
          />

          {/* Annotate */}
          <Button
            variant="secondary"
            onClick={() => {
              console.log("[ImageLightbox] Annotate button clicked");
              setIsAnnotating(true);
            }}
            className="gap-2"
          >
            <Pencil className="h-4 w-4" />
            Annotate
          </Button>

          {/* Edit Caption */}
          <Button
            variant="secondary"
            onClick={() => setIsEditingCaption(true)}
            className="gap-2"
          >
            <Type className="h-4 w-4" />
            Edit Caption
          </Button>

          {/* Delete */}
          <Button
            variant="destructive"
            onClick={() => setShowDeleteConfirm(true)}
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Screenshot?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the screenshot and remove it from the manual.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default ImageLightbox;
