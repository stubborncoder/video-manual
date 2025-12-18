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
 * Check if element is fully visible in viewport
 */
function isElementInViewport(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= window.innerHeight &&
    rect.right <= window.innerWidth
  );
}

/**
 * Scroll element into view with smooth animation
 * Returns a promise that resolves when scroll completes
 */
function scrollToElement(element: HTMLElement): Promise<void> {
  return new Promise((resolve) => {
    element.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "nearest",
    });
    // Wait for scroll animation to complete
    setTimeout(resolve, 500);
  });
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

  // Handle scrolling to elements and updating positions when highlights change
  useEffect(() => {
    setMounted(true);

    async function scrollAndHighlight() {
      // Scroll to any off-screen elements first
      for (const highlight of activeHighlights) {
        const element = findGuideElement(highlight.targetId);
        if (element && !isElementInViewport(element)) {
          await scrollToElement(element);
        }
      }
      // Update rects after scrolling
      updateRects();
    }

    scrollAndHighlight();

    // Update on scroll and resize
    window.addEventListener("scroll", updateRects, true);
    window.addEventListener("resize", updateRects);

    return () => {
      window.removeEventListener("scroll", updateRects, true);
      window.removeEventListener("resize", updateRects);
    };
  }, [activeHighlights, updateRects]);

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
