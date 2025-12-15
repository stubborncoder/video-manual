"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export interface HighlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface TextSelection {
  /** The selected text content */
  text: string;
  /** Start offset in the full document */
  startOffset: number;
  /** End offset in the full document */
  endOffset: number;
  /** Surrounding context (paragraph or nearby text) */
  context: string;
  /** Pre-calculated highlight rectangles relative to container */
  highlightRects: HighlightRect[];
}

interface UseTextSelectionOptions {
  /** Container element ref to track selections within */
  containerRef: React.RefObject<HTMLElement | null>;
  /** Whether selection tracking is enabled */
  enabled?: boolean;
  /** Minimum characters to consider a valid selection */
  minLength?: number;
  /** Maximum context characters to include */
  maxContextLength?: number;
}

/**
 * Hook for tracking text selections within a container
 */
export function useTextSelection({
  containerRef,
  enabled = true,
  minLength = 3,
  maxContextLength = 200,
}: UseTextSelectionOptions) {
  const [selection, setSelection] = useState<TextSelection | null>(null);
  const lastSelectionRef = useRef<string>("");

  /**
   * Get the text content offset within the container
   */
  const getOffsetInContainer = useCallback(
    (node: Node, offset: number): number => {
      const container = containerRef.current;
      if (!container) return 0;

      const walker = document.createTreeWalker(
        container,
        NodeFilter.SHOW_TEXT,
        null
      );

      let totalOffset = 0;
      let currentNode = walker.nextNode();

      while (currentNode) {
        if (currentNode === node) {
          return totalOffset + offset;
        }
        totalOffset += currentNode.textContent?.length || 0;
        currentNode = walker.nextNode();
      }

      return totalOffset;
    },
    [containerRef]
  );

  /**
   * Extract context around the selection
   */
  const getContext = useCallback(
    (startOffset: number, endOffset: number, fullText: string): string => {
      const halfContext = Math.floor(maxContextLength / 2);
      const contextStart = Math.max(0, startOffset - halfContext);
      const contextEnd = Math.min(fullText.length, endOffset + halfContext);

      let context = fullText.slice(contextStart, contextEnd);

      // Add ellipsis if truncated
      if (contextStart > 0) context = "..." + context;
      if (contextEnd < fullText.length) context = context + "...";

      return context;
    },
    [maxContextLength]
  );

  /**
   * Calculate highlight rectangles from a Range, relative to container
   */
  const calculateHighlightRects = useCallback(
    (range: Range): HighlightRect[] => {
      const container = containerRef.current;
      if (!container) return [];

      try {
        const rangeRects = range.getClientRects();
        const containerRect = container.getBoundingClientRect();

        const rects: HighlightRect[] = [];
        for (let i = 0; i < rangeRects.length; i++) {
          const rect = rangeRects[i];
          // Skip empty rects
          if (rect.width === 0 || rect.height === 0) continue;

          // Calculate position relative to container
          // Both rect and containerRect are viewport-relative, so the difference
          // gives us the position relative to the container's coordinate system
          rects.push({
            top: rect.top - containerRect.top,
            left: rect.left - containerRect.left,
            width: rect.width,
            height: rect.height,
          });
        }

        return rects;
      } catch {
        return [];
      }
    },
    [containerRef]
  );

  /**
   * Handle selection change
   */
  const handleSelectionChange = useCallback(() => {
    if (!enabled) return;

    const container = containerRef.current;
    if (!container) return;

    const windowSelection = window.getSelection();

    // If no selection or collapsed, don't do anything
    // We don't clear the stored selection here - only via explicit clearSelection()
    if (!windowSelection || windowSelection.isCollapsed) {
      return;
    }

    // Check if selection is within our container
    const range = windowSelection.getRangeAt(0);
    if (!container.contains(range.commonAncestorContainer)) {
      // Selection is outside our container, ignore it
      return;
    }

    const text = windowSelection.toString().trim();

    // Ignore too short selections
    if (text.length < minLength) {
      return;
    }

    // Avoid duplicate updates
    if (text === lastSelectionRef.current) {
      return;
    }
    lastSelectionRef.current = text;

    // Calculate offsets
    const startOffset = getOffsetInContainer(
      range.startContainer,
      range.startOffset
    );
    const endOffset = getOffsetInContainer(range.endContainer, range.endOffset);

    // Get full text content for context
    const fullText = container.textContent || "";
    const context = getContext(startOffset, endOffset, fullText);

    // Calculate highlight rectangles IMMEDIATELY while Range is still valid
    const highlightRects = calculateHighlightRects(range);

    setSelection({
      text,
      startOffset,
      endOffset,
      context,
      highlightRects,
    });
  }, [
    enabled,
    containerRef,
    minLength,
    getOffsetInContainer,
    getContext,
    calculateHighlightRects,
  ]);

  /**
   * Clear the current selection
   */
  const clearSelection = useCallback(() => {
    setSelection(null);
    lastSelectionRef.current = "";
    window.getSelection()?.removeAllRanges();
  }, []);

  /**
   * Set up selection change listener
   */
  useEffect(() => {
    if (!enabled) return;

    // Use mouseup for better UX (selection is finalized)
    const handleMouseUp = () => {
      // Small delay to ensure selection is finalized
      setTimeout(handleSelectionChange, 10);
    };

    // Also handle keyboard selection (Shift+Arrow)
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.shiftKey) {
        setTimeout(handleSelectionChange, 10);
      }
    };

    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("keyup", handleKeyUp);

    return () => {
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("keyup", handleKeyUp);
    };
  }, [enabled, handleSelectionChange]);

  return {
    selection,
    clearSelection,
    hasSelection: selection !== null,
  };
}

export default useTextSelection;
