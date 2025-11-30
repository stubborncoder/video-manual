"use client";

import { useState, memo } from "react";
import { ChevronDown, ChevronRight, Check, ArrowLeftRight, Plus, Trash2, ImageIcon, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ToolResultData {
  changeId: string;
  changeType: "text_replace" | "text_insert" | "text_delete" | "caption_update";
  startLine?: number;
  endLine?: number;
  afterLine?: number;
  originalContent?: string;
  newContent?: string;
  reason?: string;
  status: "pending" | "accepted" | "rejected";
}

interface ToolResultMessageProps {
  toolResult: ToolResultData;
  timestamp: Date;
}

const EXCERPT_LENGTH = 150; // Characters to show in excerpt

/**
 * Get a friendly label for a change type
 */
function getChangeLabel(changeType: string): string {
  switch (changeType) {
    case "text_replace":
      return "Replaced";
    case "text_insert":
      return "Inserted";
    case "text_delete":
      return "Deleted";
    case "caption_update":
      return "Updated Caption";
    default:
      return "Changed";
  }
}

/**
 * Get the icon for a change type
 */
function getChangeIcon(changeType: string) {
  switch (changeType) {
    case "text_replace":
      return ArrowLeftRight;
    case "text_insert":
      return Plus;
    case "text_delete":
      return Trash2;
    case "caption_update":
      return ImageIcon;
    default:
      return Check;
  }
}

/**
 * Get a summary of the change
 */
function getChangeSummary(result: ToolResultData): string {
  const { changeType, startLine, endLine, afterLine } = result;

  switch (changeType) {
    case "text_replace":
      if (startLine && endLine) {
        if (startLine === endLine) {
          return `line ${startLine}`;
        }
        return `lines ${startLine}-${endLine}`;
      }
      return "text";
    case "text_insert":
      if (afterLine !== undefined) {
        return `after line ${afterLine}`;
      }
      return "text";
    case "text_delete":
      if (startLine && endLine) {
        if (startLine === endLine) {
          return `line ${startLine}`;
        }
        return `lines ${startLine}-${endLine}`;
      }
      return "text";
    case "caption_update":
      return "image caption";
    default:
      return "content";
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
 * Collapsible tool result message for the chat
 */
export const ToolResultMessage = memo(function ToolResultMessage({
  toolResult,
  timestamp,
}: ToolResultMessageProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showFullDialog, setShowFullDialog] = useState(false);

  const Icon = getChangeIcon(toolResult.changeType);
  const label = getChangeLabel(toolResult.changeType);
  const summary = getChangeSummary(toolResult);
  const hasContent = toolResult.originalContent || toolResult.newContent;

  // Check if content needs truncation
  const originalExcerpt = toolResult.originalContent
    ? truncateText(toolResult.originalContent, EXCERPT_LENGTH)
    : null;
  const newExcerpt = toolResult.newContent
    ? truncateText(toolResult.newContent, EXCERPT_LENGTH)
    : null;
  const needsFullView = (originalExcerpt?.truncated || newExcerpt?.truncated);

  return (
    <>
      <div className="px-4 py-2">
        <div
          className={cn(
            "rounded-lg border overflow-hidden",
            "bg-green-50/50 dark:bg-green-950/20",
            "border-green-200/50 dark:border-green-800/50"
          )}
        >
          {/* Header - always visible */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-2 text-left",
              "hover:bg-green-100/50 dark:hover:bg-green-900/20 transition-colors",
              hasContent && "cursor-pointer"
            )}
            disabled={!hasContent}
          >
            {/* Expand icon */}
            {hasContent ? (
              isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5 text-green-600 dark:text-green-400 shrink-0" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-green-600 dark:text-green-400 shrink-0" />
              )
            ) : (
              <div className="w-3.5" />
            )}

            {/* Result icon */}
            <div className="p-1 rounded bg-green-100 dark:bg-green-900/40 shrink-0">
              <Icon className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
            </div>

            {/* Label and summary */}
            <div className="flex-1 min-w-0">
              <span className="text-xs font-medium text-green-700 dark:text-green-300">
                {label}
              </span>
              <span className="text-xs text-green-600/80 dark:text-green-400/80 ml-2">
                {summary}
              </span>
            </div>

            {/* Status badge */}
            <span
              className={cn(
                "text-xs px-1.5 py-0.5 rounded shrink-0",
                toolResult.status === "pending" && "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
                toolResult.status === "accepted" && "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
                toolResult.status === "rejected" && "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
              )}
            >
              {toolResult.status}
            </span>

            {/* Timestamp */}
            <span className="text-xs text-green-500/70 dark:text-green-500/50 shrink-0 ml-2">
              {formatTime(timestamp)}
            </span>
          </button>

          {/* Expanded content - shows excerpt */}
          {isExpanded && hasContent && (
            <div className="px-3 pb-3 pt-1 border-t border-green-200/30 dark:border-green-800/30">
              {/* Reason */}
              {toolResult.reason && (
                <p className="text-xs text-muted-foreground italic mb-2">
                  {toolResult.reason}
                </p>
              )}

              {/* Original content excerpt (for replace/delete) */}
              {originalExcerpt && (
                <div className="rounded bg-red-50 dark:bg-red-950/30 border border-red-200/50 dark:border-red-800/50 p-2 mb-2">
                  <div className="text-xs text-red-600 dark:text-red-400 mb-1 font-medium">
                    − Original
                  </div>
                  <pre className="text-xs whitespace-pre-wrap font-mono text-red-800 dark:text-red-200">
                    {originalExcerpt.text}
                  </pre>
                </div>
              )}

              {/* New content excerpt (for replace/insert) */}
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

              {/* View Full button */}
              {needsFullView && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowFullDialog(true)}
                  className="mt-2 h-7 text-xs text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300"
                >
                  <Maximize2 className="h-3 w-3 mr-1" />
                  View Full Change
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
              <Icon className="h-5 w-5 text-green-600" />
              {label} {summary}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 pr-2">
            {/* Reason */}
            {toolResult.reason && (
              <p className="text-sm text-muted-foreground italic">
                {toolResult.reason}
              </p>
            )}

            {/* Original content (for replace/delete) */}
            {toolResult.originalContent && (
              <div className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-4">
                <div className="text-sm text-red-600 dark:text-red-400 mb-2 font-medium">
                  − Original Content
                </div>
                <pre className="text-sm whitespace-pre-wrap font-mono text-red-800 dark:text-red-200 overflow-x-auto">
                  {toolResult.originalContent}
                </pre>
              </div>
            )}

            {/* New content (for replace/insert) */}
            {toolResult.newContent && (
              <div className="rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-4">
                <div className="text-sm text-green-600 dark:text-green-400 mb-2 font-medium">
                  + New Content
                </div>
                <pre className="text-sm whitespace-pre-wrap font-mono text-green-800 dark:text-green-200 overflow-x-auto">
                  {toolResult.newContent}
                </pre>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
});

export default ToolResultMessage;
