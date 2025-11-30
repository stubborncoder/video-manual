"use client";

import { memo } from "react";
import { Check, X, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface PendingChangeData {
  id: string;
  type: "text_replace" | "text_insert" | "text_delete" | "caption_update";
  startLine?: number;
  endLine?: number;
  afterLine?: number;
  originalContent?: string;
  newContent?: string;
  reason?: string;
  status: "pending" | "accepted" | "rejected";
}

interface PendingChangeProps {
  change: PendingChangeData;
  onAccept: (changeId: string) => void;
  onReject: (changeId: string) => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

/**
 * Renders a pending change as an inline diff with accept/reject buttons
 */
export const PendingChange = memo(function PendingChange({
  change,
  onAccept,
  onReject,
  isExpanded = true,
  onToggleExpand,
}: PendingChangeProps) {
  const isReplacement = change.type === "text_replace";
  const isInsertion = change.type === "text_insert";
  const isDeletion = change.type === "text_delete";
  const isCaptionUpdate = change.type === "caption_update";

  // Get display text based on change type
  const getChangeTypeLabel = () => {
    switch (change.type) {
      case "text_replace":
        return "Replace";
      case "text_insert":
        return "Insert";
      case "text_delete":
        return "Delete";
      case "caption_update":
        return "Update Caption";
      default:
        return "Change";
    }
  };

  // Get location text
  const getLocationText = () => {
    if (change.startLine && change.endLine) {
      if (change.startLine === change.endLine) {
        return `Line ${change.startLine}`;
      }
      return `Lines ${change.startLine}-${change.endLine}`;
    }
    if (change.afterLine !== undefined) {
      return `After line ${change.afterLine}`;
    }
    return "";
  };

  if (change.status !== "pending") {
    return null; // Don't render accepted/rejected changes
  }

  return (
    <div
      className={cn(
        "border rounded-lg overflow-hidden my-2",
        "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-amber-100/50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-800">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
            {getChangeTypeLabel()}
          </span>
          <span className="text-xs text-amber-600 dark:text-amber-400">
            {getLocationText()}
          </span>
          {onToggleExpand && (
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0"
              onClick={onToggleExpand}
            >
              {isExpanded ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </Button>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-green-600 hover:text-green-700 hover:bg-green-100 dark:text-green-400 dark:hover:bg-green-900/30"
            onClick={() => onAccept(change.id)}
          >
            <Check className="h-4 w-4 mr-1" />
            Accept
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-900/30"
            onClick={() => onReject(change.id)}
          >
            <X className="h-4 w-4 mr-1" />
            Reject
          </Button>
        </div>
      </div>

      {/* Diff content */}
      {isExpanded && (
        <div className="p-3 space-y-2">
          {/* Reason */}
          {change.reason && (
            <p className="text-xs text-muted-foreground italic">
              {change.reason}
            </p>
          )}

          {/* Show original content for replacement/deletion */}
          {(isReplacement || isDeletion) && change.originalContent && (
            <div className="rounded bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-2">
              <div className="text-xs text-red-600 dark:text-red-400 mb-1 font-medium">
                − Original
              </div>
              <pre className="text-sm whitespace-pre-wrap font-mono text-red-800 dark:text-red-200">
                {change.originalContent}
              </pre>
            </div>
          )}

          {/* Show new content for replacement/insertion */}
          {(isReplacement || isInsertion || isCaptionUpdate) && change.newContent && (
            <div className="rounded bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-2">
              <div className="text-xs text-green-600 dark:text-green-400 mb-1 font-medium">
                + New
              </div>
              <pre className="text-sm whitespace-pre-wrap font-mono text-green-800 dark:text-green-200">
                {change.newContent}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default PendingChange;
