"use client";

import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { useGuideStore } from "@/stores/guideStore";

interface HighlightRect {
  id: string;
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * Finds an element by data-guide-id attribute
 */
function findGuideElement(targetId: string): HTMLElement | null {
  return document.querySelector(`[data-guide-id="${targetId}"]`);
}

/**
 * Renders pulsing highlight overlays around UI elements.
 * Used by the Guide Agent to visually indicate elements to users.
 */
export function HighlightOverlay() {
  const { activeHighlights, clearHighlight } = useGuideStore();
  const [rects, setRects] = useState<HighlightRect[]>([]);
  const [mounted, setMounted] = useState(false);

  // Track element positions
  const updateRects = useCallback(() => {
    const newRects: HighlightRect[] = [];

    for (const highlight of activeHighlights) {
      const element = findGuideElement(highlight.targetId);
      if (element) {
        const rect = element.getBoundingClientRect();
        newRects.push({
          id: highlight.targetId,
          top: rect.top + window.scrollY,
          left: rect.left + window.scrollX,
          width: rect.width,
          height: rect.height,
        });
      }
    }

    setRects(newRects);
  }, [activeHighlights]);

  // Update positions on mount and when highlights change
  useEffect(() => {
    setMounted(true);
    updateRects();

    // Update on scroll and resize
    window.addEventListener("scroll", updateRects, true);
    window.addEventListener("resize", updateRects);

    return () => {
      window.removeEventListener("scroll", updateRects, true);
      window.removeEventListener("resize", updateRects);
    };
  }, [updateRects]);

  // Auto-dismiss highlights after duration
  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];

    for (const highlight of activeHighlights) {
      if (highlight.duration && highlight.duration > 0) {
        const timer = setTimeout(() => {
          clearHighlight(highlight.targetId);
        }, highlight.duration);
        timers.push(timer);
      }
    }

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [activeHighlights, clearHighlight]);

  if (!mounted || rects.length === 0) {
    return null;
  }

  return createPortal(
    <AnimatePresence>
      {rects.map((rect) => (
        <motion.div
          key={rect.id}
          initial={{ opacity: 0, scale: 1.1 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="fixed pointer-events-none z-[60]"
          style={{
            top: rect.top - window.scrollY,
            left: rect.left - window.scrollX,
            width: rect.width,
            height: rect.height,
          }}
        >
          {/* Pulsing border */}
          <div
            className="absolute inset-0 rounded-lg animate-pulse"
            style={{
              boxShadow: `
                0 0 0 3px rgba(250, 204, 21, 0.8),
                0 0 20px rgba(250, 204, 21, 0.4),
                inset 0 0 0 1px rgba(250, 204, 21, 0.3)
              `,
            }}
          />
          {/* Optional label - can be added later */}
        </motion.div>
      ))}
    </AnimatePresence>,
    document.body
  );
}

export default HighlightOverlay;
