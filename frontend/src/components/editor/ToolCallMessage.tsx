"use client";

import { useState, memo } from "react";
import { ChevronDown, ChevronRight, Wrench, ArrowLeftRight, Plus, Trash2, ImageIcon, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ToolCallMessageProps {
  toolName: string;
  toolArgs?: Record<string, unknown>;
  timestamp: Date;
}

const EXCERPT_LENGTH = 150; // Characters to show in excerpt

/**
 * Get a friendly label for a tool name
 */
function getToolLabel(toolName: string): string {
  switch (toolName) {
    case "replace_text":
      return "Replace Text";
    case "insert_text":
      return "Insert Text";
    case "delete_text":
      return "Delete Text";
    case "update_image_caption":
      return "Update Caption";
    default:
      return toolName;
  }
}

/**
 * Get the icon for a tool
 */
function getToolIcon(toolName: string) {
  switch (toolName) {
    case "replace_text":
      return ArrowLeftRight;
    case "insert_text":
      return Plus;
    case "delete_text":
      return Trash2;
    case "update_image_caption":
      return ImageIcon;
    default:
      return Wrench;
  }
}

/**
 * Get a summary of what the tool is doing
 */
function getToolSummary(toolName: string, args?: Record<string, unknown>): string {
  if (!args || Object.keys(args).length === 0) {
    return "Processing...";
  }

  const startLine = args.start_line ?? args.startLine;
  const endLine = args.end_line ?? args.endLine;
  const afterLine = args.after_line ?? args.afterLine;

  switch (toolName) {
    case "replace_text":
      if (startLine && endLine) {
        if (startLine === endLine) {
          return `Replacing line ${startLine}`;
        }
        return `Replacing lines ${startLine}-${endLine}`;
      }
      return "Replacing text";
    case "insert_text":
      if (afterLine !== undefined) {
        return `Inserting after line ${afterLine}`;
      }
      return "Inserting text";
    case "delete_text":
      if (startLine && endLine) {
        if (startLine === endLine) {
          return `Deleting line ${startLine}`;
        }
        return `Deleting lines ${startLine}-${endLine}`;
      }
      return "Deleting text";
    case "update_image_caption":
      return "Updating image caption";
    default:
      return "Executing tool";
  }
}

/**
 * Format time as HH:MM
 */
function formatTime(date: Date): string {
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Truncate text to excerpt length
 */
function truncateText(text: string, maxLength: number): { text: string; truncated: boolean } {
  if (text.length <= maxLength) {
    return { text, truncated: false };
  }
  return { text: text.slice(0, maxLength) + "...", truncated: true };
}

/**
 * Collapsible tool call message for the chat
 */
export const ToolCallMessage = memo(function ToolCallMessage({
  toolName,
  toolArgs,
  timestamp,
}: ToolCallMessageProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showFullDialog, setShowFullDialog] = useState(false);

  const Icon = getToolIcon(toolName);
  const label = getToolLabel(toolName);
  const summary = getToolSummary(toolName, toolArgs);
  const hasArgs = toolArgs && Object.keys(toolArgs).length > 0;

  // Extract common fields with type narrowing
  const oldTextRaw = toolArgs?.old_text ?? toolArgs?.oldText ?? toolArgs?.original_content;
  const newTextRaw = toolArgs?.new_text ?? toolArgs?.newText ?? toolArgs?.new_content;
  const reasonRaw = toolArgs?.reason;

  const oldText = typeof oldTextRaw === "string" ? oldTextRaw : null;
  const newText = typeof newTextRaw === "string" ? newTextRaw : null;
  const reason = typeof reasonRaw === "string" ? reasonRaw : null;
  const hasTextContent = oldText || newText;

  // Check if content needs truncation
  const oldExcerpt = oldText ? truncateText(oldText, EXCERPT_LENGTH) : null;
  const newExcerpt = newText ? truncateText(newText, EXCERPT_LENGTH) : null;
  const needsFullView = (oldExcerpt?.truncated || newExcerpt?.truncated);

  return (
    <>
      <div className="px-4 py-2">
        <div
          className={cn(
            "rounded-lg border overflow-hidden",
            "bg-amber-50/50 dark:bg-amber-950/20",
            "border-amber-200/50 dark:border-amber-800/50"
          )}
        >
          {/* Header - always visible */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-2 text-left",
              "hover:bg-amber-100/50 dark:hover:bg-amber-900/20 transition-colors",
              hasArgs && "cursor-pointer"
            )}
            disabled={!hasArgs}
          >
            {/* Expand icon */}
            {hasArgs ? (
              isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
              )
            ) : (
              <div className="w-3.5" />
            )}

            {/* Tool icon */}
            <div className="p-1 rounded bg-amber-100 dark:bg-amber-900/40 shrink-0">
              <Icon className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
            </div>

            {/* Tool name and summary */}
            <div className="flex-1 min-w-0">
              <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                {label}
              </span>
              <span className="text-xs text-amber-600/80 dark:text-amber-400/80 ml-2">
                {summary}
              </span>
            </div>

            {/* Timestamp */}
            <span className="text-xs text-amber-500/70 dark:text-amber-500/50 shrink-0">
              {formatTime(timestamp)}
            </span>
          </button>

          {/* Expanded content - shows excerpt */}
          {isExpanded && hasArgs && (
            <div className="px-3 pb-3 pt-1 border-t border-amber-200/30 dark:border-amber-800/30">
              {/* Reason */}
              {reason && (
                <p className="text-xs text-muted-foreground italic mb-2">
                  {reason}
                </p>
              )}

              {/* Old text excerpt (for replace/delete) */}
              {oldExcerpt && (
                <div className="rounded bg-red-50 dark:bg-red-950/30 border border-red-200/50 dark:border-red-800/50 p-2 mb-2">
                  <div className="text-xs text-red-600 dark:text-red-400 mb-1 font-medium">
                    − Original
                  </div>
                  <pre className="text-xs whitespace-pre-wrap font-mono text-red-800 dark:text-red-200">
                    {oldExcerpt.text}
                  </pre>
                </div>
              )}

              {/* New text excerpt (for replace/insert) */}
              {newExcerpt && (
                <div className="rounded bg-green-50 dark:bg-green-950/30 border border-green-200/50 dark:border-green-800/50 p-2">
                  <div className="text-xs text-green-600 dark:text-green-400 mb-1 font-medium">
                    + New
                  </div>
                  <pre className="text-xs whitespace-pre-wrap font-mono text-green-800 dark:text-green-200">
                    {newExcerpt.text}
                  </pre>
                </div>
              )}

              {/* If no old/new text but has other args, show as JSON */}
              {!hasTextContent && toolArgs && (
                <pre className="text-xs text-muted-foreground font-mono overflow-x-auto">
                  {JSON.stringify(toolArgs, null, 2)}
                </pre>
              )}

              {/* View Full button */}
              {needsFullView && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowFullDialog(true)}
                  className="mt-2 h-7 text-xs text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300"
                >
                  <Maximize2 className="h-3 w-3 mr-1" />
                  View Full Details
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Full View Dialog */}
      <Dialog open={showFullDialog} onOpenChange={setShowFullDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon className="h-5 w-5 text-amber-600" />
              {label}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 pr-2">
            {/* Reason */}
            {reason && (
              <p className="text-sm text-muted-foreground italic">
                {reason}
              </p>
            )}

            {/* Original content (for replace/delete) */}
            {oldText && (
              <div className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-4">
                <div className="text-sm text-red-600 dark:text-red-400 mb-2 font-medium">
                  − Original Content
                </div>
                <pre className="text-sm whitespace-pre-wrap font-mono text-red-800 dark:text-red-200 overflow-x-auto">
                  {oldText}
                </pre>
              </div>
            )}

            {/* New content (for replace/insert) */}
            {newText && (
              <div className="rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-4">
                <div className="text-sm text-green-600 dark:text-green-400 mb-2 font-medium">
                  + New Content
                </div>
                <pre className="text-sm whitespace-pre-wrap font-mono text-green-800 dark:text-green-200 overflow-x-auto">
                  {newText}
                </pre>
              </div>
            )}

            {/* If no old/new text but has other args, show as JSON */}
            {!hasTextContent && toolArgs && (
              <div className="rounded-lg bg-muted p-4">
                <div className="text-sm font-medium mb-2">Arguments</div>
                <pre className="text-sm text-muted-foreground font-mono overflow-x-auto">
                  {JSON.stringify(toolArgs, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
});

export default ToolCallMessage;
