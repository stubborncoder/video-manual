"use client";

import { X, Type, Quote } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { TextSelection } from "@/hooks/useTextSelection";

interface SelectionChipProps {
  selection: TextSelection;
  onClear: () => void;
}

/**
 * Truncate text with ellipsis
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

/**
 * Displays the current text selection as a chip in the chat input area
 */
export function SelectionChip({ selection, onClear }: SelectionChipProps) {
  const displayText = truncateText(selection.text, 50);
  const charCount = selection.text.length;

  return (
    <TooltipProvider>
      <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 border border-primary/20 rounded-lg">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="shrink-0 p-1 rounded bg-primary/20">
            <Type className="h-3.5 w-3.5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-primary">
                Selected text
              </span>
              <span className="text-xs text-muted-foreground">
                ({charCount} chars)
              </span>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <p className="text-sm text-foreground/80 truncate cursor-help">
                  <Quote className="h-3 w-3 inline mr-1 opacity-50" />
                  {displayText}
                </p>
              </TooltipTrigger>
              <TooltipContent
                side="top"
                className="max-w-sm"
                align="start"
              >
                <p className="text-sm whitespace-pre-wrap break-words">
                  {selection.text.length > 300
                    ? selection.text.slice(0, 300) + "..."
                    : selection.text}
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="h-6 w-6 p-0 shrink-0 hover:bg-primary/20"
        >
          <X className="h-3.5 w-3.5" />
          <span className="sr-only">Clear selection</span>
        </Button>
      </div>
    </TooltipProvider>
  );
}

export default SelectionChip;
