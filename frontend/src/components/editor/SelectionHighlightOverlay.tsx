"use client";

import type { TextSelection } from "@/hooks/useTextSelection";

interface SelectionHighlightOverlayProps {
  /** Current text selection with pre-calculated highlight rects */
  selection: TextSelection | null;
  /** Whether overlay is enabled */
  enabled?: boolean;
}

/**
 * Renders an overlay to highlight selected text without modifying the DOM.
 * Uses pre-calculated rectangles from the selection.
 */
export function SelectionHighlightOverlay({
  selection,
  enabled = true,
}: SelectionHighlightOverlayProps) {
  if (!enabled || !selection || selection.highlightRects.length === 0) {
    return null;
  }

  return (
    <>
      {selection.highlightRects.map((rect, index) => (
        <div
          key={index}
          className="absolute pointer-events-none rounded-sm"
          style={{
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            backgroundColor: "rgba(250, 204, 21, 0.5)", // yellow-400 with 50% opacity
            zIndex: 50,
          }}
        />
      ))}
    </>
  );
}

export default SelectionHighlightOverlay;
