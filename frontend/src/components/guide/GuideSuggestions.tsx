"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface GuideSuggestionsProps {
  suggestions: string[];
  onSuggestionClick: (suggestion: string) => void;
  disabled?: boolean;
}

/**
 * Quick action suggestion chips for the guide
 * Displays contextual suggestions in a horizontal scrollable container
 */
export function GuideSuggestions({
  suggestions,
  onSuggestionClick,
  disabled = false,
}: GuideSuggestionsProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScrollPosition = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollLeft, scrollWidth, clientWidth } = container;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
  }, []);

  useEffect(() => {
    checkScrollPosition();
    const container = scrollContainerRef.current;
    if (!container) return;

    container.addEventListener("scroll", checkScrollPosition);
    window.addEventListener("resize", checkScrollPosition);

    return () => {
      container.removeEventListener("scroll", checkScrollPosition);
      window.removeEventListener("resize", checkScrollPosition);
    };
  }, [checkScrollPosition, suggestions]);

  const scroll = (direction: "left" | "right") => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const scrollAmount = 200;
    container.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  if (suggestions.length === 0) return null;

  return (
    <div className="px-4 py-2 border-t">
      <div className="relative">
        {/* Left scroll button */}
        <button
          onClick={() => scroll("left")}
          className={cn(
            "absolute left-0 top-1/2 -translate-y-1/2 z-10",
            "w-8 h-8 rounded-full",
            "bg-background/90 backdrop-blur-sm border shadow-sm",
            "flex items-center justify-center",
            "hover:bg-muted transition-all duration-200",
            "focus:outline-none focus:ring-2 focus:ring-primary/50",
            canScrollLeft
              ? "opacity-100 translate-x-0"
              : "opacity-0 -translate-x-2 pointer-events-none"
          )}
          aria-label="Scroll left"
        >
          <ChevronLeft className="h-5 w-5 text-muted-foreground" />
        </button>

        {/* Scrollable container */}
        <div
          ref={scrollContainerRef}
          className="flex gap-2 overflow-x-auto scrollbar-hide px-8"
        >
          {suggestions.map((suggestion, idx) => (
            <Button
              key={idx}
              variant="outline"
              size="sm"
              onClick={() => onSuggestionClick(suggestion)}
              disabled={disabled}
              className={cn(
                "h-auto py-1.5 px-3 text-xs rounded-full shrink-0",
                "hover:bg-primary/10 transition-colors"
              )}
            >
              {suggestion}
            </Button>
          ))}
        </div>

        {/* Right scroll button */}
        <button
          onClick={() => scroll("right")}
          className={cn(
            "absolute right-0 top-1/2 -translate-y-1/2 z-10",
            "w-8 h-8 rounded-full",
            "bg-background/90 backdrop-blur-sm border shadow-sm",
            "flex items-center justify-center",
            "hover:bg-muted transition-all duration-200",
            "focus:outline-none focus:ring-2 focus:ring-primary/50",
            canScrollRight
              ? "opacity-100 translate-x-0"
              : "opacity-0 translate-x-2 pointer-events-none"
          )}
          aria-label="Scroll right"
        >
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </button>
      </div>
    </div>
  );
}
