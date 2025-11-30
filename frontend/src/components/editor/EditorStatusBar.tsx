"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Undo2,
  Redo2,
  History,
  Save,
  Loader2,
  Check,
  AlertCircle,
} from "lucide-react";

interface EditorStatusBarProps {
  // Undo/Redo state
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;

  // Save state
  lastSavedAt: Date | null;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  hasImageChanges?: boolean;
  unsavedChangesCount: number;
  onSave: () => void;

  // Version history
  onOpenVersionHistory: () => void;

  // Errors
  lastError?: Error | null;
}

/**
 * Format time since last save
 */
function formatTimeSince(date: Date | null): string {
  if (!date) return "Never saved";

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);

  if (diffSecs < 10) return "Saved just now";
  if (diffSecs < 60) return `Saved ${diffSecs}s ago`;
  if (diffMins === 1) return "Saved 1m ago";
  if (diffMins < 60) return `Saved ${diffMins}m ago`;
  if (diffHours === 1) return "Saved 1h ago";
  return `Saved ${diffHours}h ago`;
}

export function EditorStatusBar({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  lastSavedAt,
  isSaving,
  hasUnsavedChanges,
  hasImageChanges = false,
  unsavedChangesCount,
  onSave,
  onOpenVersionHistory,
  lastError,
}: EditorStatusBarProps) {
  // Combined unsaved state
  const hasAnyChanges = hasUnsavedChanges || hasImageChanges;
  // Update time display every 10 seconds
  const [, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 10000);
    return () => clearInterval(timer);
  }, []);

  return (
    <TooltipProvider>
      <div className="border-t px-4 py-2 flex items-center justify-between gap-4 bg-muted/30 text-sm">
        {/* Left side - Undo/Redo and Version History */}
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={onUndo}
                disabled={!canUndo}
                className="h-7 px-2"
              >
                <Undo2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Undo (Ctrl+Z)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={onRedo}
                disabled={!canRedo}
                className="h-7 px-2"
              >
                <Redo2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Redo (Ctrl+Shift+Z)</TooltipContent>
          </Tooltip>

          <div className="h-4 w-px bg-border mx-1" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={onOpenVersionHistory}
                className="h-7 px-2"
              >
                <History className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Version History</TooltipContent>
          </Tooltip>
        </div>

        {/* Center - Save status */}
        <div className="flex items-center gap-3 text-muted-foreground">
          {lastError ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5 text-destructive cursor-help">
                  <AlertCircle className="h-4 w-4" />
                  <span>Save failed</span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p className="font-medium">Error saving manual</p>
                <p className="text-xs text-muted-foreground mt-1">{lastError.message}</p>
              </TooltipContent>
            </Tooltip>
          ) : isSaving ? (
            <div className="flex items-center gap-1.5">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Saving...</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              {lastSavedAt && !hasAnyChanges && (
                <Check className="h-4 w-4 text-green-500" />
              )}
              <span>{formatTimeSince(lastSavedAt)}</span>
            </div>
          )}

          {hasAnyChanges && (
            <>
              <div className="h-4 w-px bg-border" />
              <Badge variant="secondary" className="text-xs">
                {hasImageChanges && unsavedChangesCount === 0
                  ? "Image changes"
                  : `${unsavedChangesCount} unsaved change${unsavedChangesCount !== 1 ? "s" : ""}${hasImageChanges ? " + images" : ""}`}
              </Badge>
            </>
          )}
        </div>

        {/* Right side - Save button */}
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                onClick={onSave}
                disabled={!hasAnyChanges || isSaving}
                className="h-7"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-1.5" />
                )}
                Save
              </Button>
            </TooltipTrigger>
            <TooltipContent>Save (Ctrl+S)</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
}

export default EditorStatusBar;
