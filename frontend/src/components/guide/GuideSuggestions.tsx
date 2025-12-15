"use client";

import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface GuideSuggestionsProps {
  suggestions: string[];
  onSuggestionClick: (suggestion: string) => void;
  disabled?: boolean;
}

/**
 * Quick action suggestion chips for the guide
 * Displays contextual suggestions based on the current page
 */
export function GuideSuggestions({
  suggestions,
  onSuggestionClick,
  disabled = false,
}: GuideSuggestionsProps) {
  if (suggestions.length === 0) return null;

  return (
    <div className="px-4 py-2 border-t bg-muted/30">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">
          Suggestions
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {suggestions.map((suggestion, idx) => (
          <Button
            key={idx}
            variant="outline"
            size="sm"
            onClick={() => onSuggestionClick(suggestion)}
            disabled={disabled}
            className={cn(
              "h-auto py-1.5 px-3 text-xs rounded-full",
              "hover:bg-primary/10 transition-colors"
            )}
          >
            {suggestion}
          </Button>
        ))}
      </div>
    </div>
  );
}
