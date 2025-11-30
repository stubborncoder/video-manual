"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PendingChange, type PendingChangeData } from "./PendingChange";
import { cn } from "@/lib/utils";

interface PendingChangesOverlayProps {
  /** All pending changes from the copilot */
  changes: PendingChangeData[];
  /** Reference to the scrollable container */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Total number of lines in the document */
  totalLines: number;
  /** Callback when a change is accepted */
  onAccept: (changeId: string) => void;
  /** Callback when a change is rejected */
  onReject: (changeId: string) => void;
  /** Callback after change is applied to scroll to location */
  onScrollToLine?: (lineNumber: number) => void;
}

/**
 * Overlay component that shows pending changes in a collapsible panel
 * at the top of the document preview.
 */
export function PendingChangesOverlay({
  changes,
  containerRef,
  totalLines,
  onAccept,
  onReject,
  onScrollToLine,
}: PendingChangesOverlayProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Filter to only pending changes
  const pendingChanges = useMemo(() => {
    return changes.filter((c) => c.status === "pending");
  }, [changes]);

  // Scroll to a specific line in the document
  const scrollToLine = (lineNumber: number) => {
    const container = containerRef.current;
    if (!container || totalLines === 0) return;

    const contentHeight = container.scrollHeight;
    const lineHeight = contentHeight / totalLines;
    const targetPosition = (lineNumber - 1) * lineHeight - container.clientHeight / 3;

    container.scrollTo({
      top: Math.max(0, targetPosition),
      behavior: "smooth",
    });
  };

  // Handle accept with scroll
  const handleAccept = (changeId: string) => {
    const change = pendingChanges.find(c => c.id === changeId);
    const lineNumber = change?.startLine || change?.afterLine;

    onAccept(changeId);

    // Scroll to the change location after a short delay to let the DOM update
    if (lineNumber) {
      setTimeout(() => {
        scrollToLine(lineNumber);
        onScrollToLine?.(lineNumber);
      }, 100);
    }
  };

  if (pendingChanges.length === 0) {
    return null;
  }

  return (
    <div className="sticky top-0 left-0 right-0 z-40 pointer-events-auto">
      {/* Header bar */}
      <div
        className={cn(
          "flex items-center justify-between px-4 py-2 bg-amber-100 dark:bg-amber-900/50 border-b border-amber-300 dark:border-amber-700 cursor-pointer",
          isCollapsed ? "rounded-b-lg" : ""
        )}
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200">
            {pendingChanges.length}
          </Badge>
          <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
            Pending {pendingChanges.length === 1 ? 'Change' : 'Changes'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Accept all / Reject all buttons */}
          {pendingChanges.length > 1 && !isCollapsed && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-green-600 hover:text-green-700 hover:bg-green-100 dark:text-green-400"
                onClick={(e) => {
                  e.stopPropagation();
                  pendingChanges.forEach(c => handleAccept(c.id));
                }}
              >
                <Check className="h-4 w-4 mr-1" />
                Accept All
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-100 dark:text-red-400"
                onClick={(e) => {
                  e.stopPropagation();
                  pendingChanges.forEach(c => onReject(c.id));
                }}
              >
                <X className="h-4 w-4 mr-1" />
                Reject All
              </Button>
            </>
          )}
          {isCollapsed ? (
            <ChevronDown className="h-4 w-4 text-amber-600" />
          ) : (
            <ChevronUp className="h-4 w-4 text-amber-600" />
          )}
        </div>
      </div>

      {/* Collapsible changes list */}
      {!isCollapsed && (
        <div className="max-h-[50vh] overflow-y-auto bg-background/95 backdrop-blur-sm border-x border-b border-amber-200 dark:border-amber-800 rounded-b-lg shadow-lg">
          {pendingChanges.map((change, index) => (
            <div
              key={change.id}
              className={cn(
                "border-b border-amber-100 dark:border-amber-900 last:border-b-0",
              )}
            >
              {/* Line indicator */}
              <div className="px-3 py-1 bg-muted/50 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {change.type === "text_insert"
                    ? `Insert after line ${change.afterLine}`
                    : `Line${change.startLine !== change.endLine ? 's' : ''} ${change.startLine}${change.endLine && change.endLine !== change.startLine ? `-${change.endLine}` : ''}`
                  }
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 px-2 text-xs"
                  onClick={() => scrollToLine(change.startLine || change.afterLine || 1)}
                >
                  Go to line
                </Button>
              </div>
              <PendingChange
                change={change}
                onAccept={handleAccept}
                onReject={onReject}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default PendingChangesOverlay;
