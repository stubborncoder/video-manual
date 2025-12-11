"use client";

import { useState, useCallback, useRef } from "react";
import { Upload, X, Video, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Progress } from "@/components/ui/progress";
import { manuals, type UploadProgress, type AdditionalVideoUploadResponse } from "@/lib/api";
import { cn } from "@/lib/utils";

// Common UI languages
const LANGUAGES = [
  { code: "", label: "Not specified" },
  { code: "en", label: "English" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "pt", label: "Portuguese" },
  { code: "it", label: "Italian" },
  { code: "zh", label: "Chinese" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "ar", label: "Arabic" },
  { code: "ru", label: "Russian" },
  { code: "nl", label: "Dutch" },
  { code: "pl", label: "Polish" },
  { code: "tr", label: "Turkish" },
  { code: "vi", label: "Vietnamese" },
  { code: "th", label: "Thai" },
  { code: "id", label: "Indonesian" },
  { code: "hi", label: "Hindi" },
];

const ACCEPTED_FORMATS = ".mp4,.webm,.mov,.avi,.mkv,.m4v";
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB

interface AddVideoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  manualId: string;
  onSuccess?: (video: AdditionalVideoUploadResponse) => void;
}

export function AddVideoDialog({
  open,
  onOpenChange,
  manualId,
  onSuccess,
}: AddVideoDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [label, setLabel] = useState("");
  const [language, setLanguage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetForm = useCallback(() => {
    setFile(null);
    setLabel("");
    setLanguage("");
    setUploadProgress(0);
    setError(null);
  }, []);

  const handleClose = useCallback(() => {
    if (!uploading) {
      resetForm();
      onOpenChange(false);
    }
  }, [uploading, resetForm, onOpenChange]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validate file size
    if (selectedFile.size > MAX_FILE_SIZE) {
      setError(`File too large. Maximum size is ${Math.round(MAX_FILE_SIZE / 1024 / 1024)}MB.`);
      return;
    }

    // Validate file type
    const ext = selectedFile.name.split('.').pop()?.toLowerCase();
    const validExts = ['mp4', 'webm', 'mov', 'avi', 'mkv', 'm4v'];
    if (!ext || !validExts.includes(ext)) {
      setError(`Invalid file type. Accepted formats: ${validExts.join(', ')}`);
      return;
    }

    setFile(selectedFile);
    setError(null);

    // Auto-fill label from filename
    if (!label) {
      const baseName = selectedFile.name.replace(/\.[^/.]+$/, '');
      setLabel(baseName);
    }
  }, [label]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      // Simulate file input change
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(droppedFile);
      if (fileInputRef.current) {
        fileInputRef.current.files = dataTransfer.files;
        handleFileSelect({ target: fileInputRef.current } as React.ChangeEvent<HTMLInputElement>);
      }
    }
  }, [handleFileSelect]);

  const handleUpload = useCallback(async () => {
    if (!file) return;

    setUploading(true);
    setError(null);
    setUploadProgress(0);

    try {
      const result = await manuals.uploadVideo(
        manualId,
        file,
        label || undefined,
        language || undefined,
        (progress: UploadProgress) => {
          setUploadProgress(progress.percent);
        }
      );

      onSuccess?.(result);
      handleClose();
    } catch (err) {
      // Parse error and show user-friendly message
      let errorMessage = "Upload failed. Please try again.";

      if (err instanceof Error) {
        const msg = err.message.toLowerCase();

        if (msg.includes("socket hang up") || msg.includes("econnreset") || msg.includes("network")) {
          errorMessage = "Connection lost during upload. The file may be too large or the server timed out. Please try again.";
        } else if (msg.includes("exceeded") || msg.includes("too large") || msg.includes("413")) {
          errorMessage = `File is too large. Maximum upload size is 500MB.`;
        } else if (msg.includes("timeout")) {
          errorMessage = "Upload timed out. Please check your connection and try again.";
        } else if (msg.includes("500") || msg.includes("internal server")) {
          errorMessage = "Server error occurred while processing the video. Please try again later.";
        } else if (msg.includes("invalid") || msg.includes("unsupported")) {
          errorMessage = "This video format is not supported. Please use MP4, WebM, MOV, AVI, or MKV.";
        } else if (err.message && !msg.includes("http")) {
          // Use the original message if it's user-friendly (doesn't contain HTTP codes)
          errorMessage = err.message;
        }
      }

      setError(errorMessage);
    } finally {
      setUploading(false);
    }
  }, [file, manualId, label, language, onSuccess, handleClose]);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Video Source</DialogTitle>
          <DialogDescription>
            Upload an additional video to use as a frame source for screenshot replacement.
            The video will be compressed to save storage space.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* File Upload Area */}
          <div
            className={cn(
              "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
              file ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50",
              uploading && "pointer-events-none opacity-50"
            )}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_FORMATS}
              className="hidden"
              onChange={handleFileSelect}
              disabled={uploading}
            />

            {file ? (
              <div className="flex items-center justify-center gap-3">
                <Video className="h-8 w-8 text-primary" />
                <div className="text-left">
                  <p className="font-medium truncate max-w-[200px]">{file.name}</p>
                  <p className="text-sm text-muted-foreground">{formatFileSize(file.size)}</p>
                </div>
                {!uploading && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="ml-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
                <p className="text-sm font-medium">Drop video here or click to browse</p>
                <p className="text-xs text-muted-foreground">
                  MP4, WebM, MOV, AVI, MKV • Max {Math.round(MAX_FILE_SIZE / 1024 / 1024)}MB
                </p>
              </div>
            )}
          </div>

          {/* Upload Progress */}
          {uploading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Uploading & compressing...</span>
                <span className="font-medium">{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="h-2" />
            </div>
          )}

          {/* Label Input */}
          <div className="space-y-2">
            <Label htmlFor="label">Label</Label>
            <Input
              id="label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g., English UI, Spanish Version"
              disabled={uploading}
            />
          </div>

          {/* Language Selector */}
          <div className="space-y-2">
            <Label htmlFor="language">UI Language (optional)</Label>
            <Select value={language} onValueChange={setLanguage} disabled={uploading}>
              <SelectTrigger>
                <SelectValue placeholder="Select language..." />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((lang) => (
                  <SelectItem key={lang.code || "none"} value={lang.code || "none"}>
                    {lang.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              The language shown in the video's user interface
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={uploading}>
            Cancel
          </Button>
          <Button onClick={handleUpload} disabled={!file || uploading}>
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload Video
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default AddVideoDialog;
