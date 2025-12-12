"use client";

import { ReactNode, useCallback, useRef } from "react";
import { ImagePlus } from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useTranslations } from "next-intl";

// Helper to strip semantic tags from a line for comparison
function stripTagsFromLine(line: string): string {
  return line.replace(/<\/?[\w]+(\s+[^>]*)?>/g, "").trim();
}

interface PreviewContextMenuProps {
  children: ReactNode;
  /** Whether video is available for frame selection */
  hasVideo?: boolean;
  /** Callback when user wants to insert a screenshot */
  onInsertScreenshot: (afterLine: number | null) => void;
  /** Reference to the content container for position detection */
  contentRef?: React.RefObject<HTMLDivElement | null>;
  /** The markdown content for line detection */
  markdownContent?: string;
}

/**
 * Find the markdown line number for an element by matching its content
 */
function findLineForElement(
  element: Element,
  markdownContent: string
): number | null {
  const lines = markdownContent.split("\n");
  const tagName = element.tagName.toLowerCase();

  console.log("[findLineForElement] Searching for", tagName, "in", lines.length, "lines");

  // Check for headings
  if (/^h[1-6]$/.test(tagName)) {
    const headingText = element.textContent?.trim();
    console.log("[findLineForElement] Heading text:", headingText);
    if (headingText && headingText.length > 3) {
      for (let i = 0; i < lines.length; i++) {
        const strippedLine = stripTagsFromLine(lines[i]);
        if (strippedLine.match(/^#{1,6}\s/) && strippedLine.includes(headingText)) {
          console.log("[findLineForElement] Matched heading at line", i + 1);
          return i + 1;
        }
      }
    }
  }

  // Check for list items
  if (tagName === "li") {
    const itemText = element.textContent?.trim();
    if (itemText && itemText.length > 3) {
      const searchText = itemText.substring(0, 30);
      console.log("[findLineForElement] List item search:", searchText);
      for (let i = 0; i < lines.length; i++) {
        const strippedLine = stripTagsFromLine(lines[i]).trim();
        if ((strippedLine.startsWith("-") || strippedLine.startsWith("*") || strippedLine.match(/^\d+\./)) &&
            strippedLine.includes(searchText)) {
          console.log("[findLineForElement] Matched list item at line", i + 1);
          return i + 1;
        }
      }
    }
  }

  // Check for paragraphs - use longer search text for better matching
  if (tagName === "p") {
    const paraText = element.textContent?.trim();
    console.log("[findLineForElement] Paragraph text:", paraText?.substring(0, 60));
    if (paraText && paraText.length > 10) {
      // Use first 60 chars for more unique matching, normalize whitespace
      const searchText = paraText.substring(0, 60).replace(/\s+/g, " ");
      console.log("[findLineForElement] Searching for:", searchText);

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Skip obvious non-paragraph lines (but not tag lines)
        if (line.trim() === "" || line.match(/^[#\-*>`!]/)) continue;

        // Strip semantic tags and normalize for comparison
        const strippedLine = stripTagsFromLine(line);
        const normalizedLine = strippedLine.replace(/\s+/g, " ");
        if (normalizedLine.includes(searchText)) {
          console.log("[findLineForElement] Matched paragraph at line", i + 1, ":", line.substring(0, 40));
          return i + 1;
        }
      }

      // Try shorter search if no match
      const shortSearch = paraText.substring(0, 30).replace(/\s+/g, " ");
      console.log("[findLineForElement] Trying shorter search:", shortSearch);
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.trim() === "" || line.match(/^[#\-*>`!]/)) continue;
        const strippedLine = stripTagsFromLine(line);
        const normalizedLine = strippedLine.replace(/\s+/g, " ");
        if (normalizedLine.includes(shortSearch)) {
          console.log("[findLineForElement] Matched with short search at line", i + 1);
          return i + 1;
        }
      }
    }
  }

  // Check for blockquotes
  if (tagName === "blockquote") {
    const quoteText = element.textContent?.trim();
    if (quoteText && quoteText.length > 5) {
      const searchText = quoteText.substring(0, 30);
      for (let i = 0; i < lines.length; i++) {
        const strippedLine = stripTagsFromLine(lines[i]);
        if (strippedLine.startsWith(">") && strippedLine.includes(searchText)) {
          console.log("[findLineForElement] Matched blockquote at line", i + 1);
          return i + 1;
        }
      }
    }
  }

  console.log("[findLineForElement] No match found for", tagName);
  return null;
}

/**
 * Find the element closest to (but above) the click Y position
 */
function findNearestElementAbove(
  clickY: number,
  container: HTMLElement
): Element | null {
  // Get all block-level elements that could contain content
  // Prioritize paragraphs and headings over image wrappers for text positioning
  const selectors = "h1, h2, h3, h4, h5, h6, p, li, blockquote";
  const elements = container.querySelectorAll(selectors);

  console.log("[findNearestElementAbove] Click Y:", clickY);
  console.log("[findNearestElementAbove] Found", elements.length, "elements");

  let closestElement: Element | null = null;
  let closestDistance = Infinity;

  for (const el of elements) {
    const rect = el.getBoundingClientRect();
    // Element must be above or at the click position
    // Use the bottom of the element as the reference
    if (rect.bottom <= clickY) {
      const distance = clickY - rect.bottom;
      const preview = el.textContent?.substring(0, 50) || "";
      console.log(`[findNearestElementAbove] ${el.tagName} bottom=${rect.bottom.toFixed(0)} distance=${distance.toFixed(0)} "${preview}..."`);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestElement = el;
      }
    }
  }

  if (closestElement) {
    console.log("[findNearestElementAbove] Chosen:", closestElement.tagName, closestElement.textContent?.substring(0, 50));
  }

  // If no element is above, find the first element below
  if (!closestElement) {
    let firstBelow: Element | null = null;
    let smallestTop = Infinity;

    for (const el of elements) {
      const rect = el.getBoundingClientRect();
      if (rect.top >= clickY && rect.top < smallestTop) {
        smallestTop = rect.top;
        firstBelow = el;
      }
    }

    // If clicking above the first element, return null (insert at beginning)
    if (firstBelow) {
      console.log("[findNearestElementAbove] No element above, first below:", firstBelow.tagName);
      return null; // Will trigger insert at beginning/end
    }
  }

  return closestElement;
}

/**
 * Context menu for the preview area that allows inserting screenshots.
 * Detects the clicked position to insert at the right location.
 */
export function PreviewContextMenu({
  children,
  hasVideo = true,
  onInsertScreenshot,
  contentRef,
  markdownContent,
}: PreviewContextMenuProps) {
  const t = useTranslations("previewContextMenu");
  const clickPositionRef = useRef<{ x: number; y: number } | null>(null);

  const findLineFromClick = useCallback((): number | null => {
    if (!contentRef?.current || !markdownContent || !clickPositionRef.current) {
      return null;
    }

    const { y } = clickPositionRef.current;
    const container = contentRef.current;

    // Find the nearest element above the click position
    const nearestElement = findNearestElementAbove(y, container);

    if (!nearestElement) {
      console.log("[PreviewContextMenu] No element found above click, will insert at end");
      return null;
    }

    console.log("[PreviewContextMenu] Nearest element above:", nearestElement.tagName, nearestElement.textContent?.substring(0, 30));

    // Find the markdown line for this element
    const lineNumber = findLineForElement(nearestElement, markdownContent);

    if (lineNumber) {
      console.log("[PreviewContextMenu] Found line:", lineNumber);
      return lineNumber;
    }

    // If we couldn't match the element, try walking up to find a parent we can match
    let parent = nearestElement.parentElement;
    while (parent && parent !== container) {
      const parentLine = findLineForElement(parent, markdownContent);
      if (parentLine) {
        console.log("[PreviewContextMenu] Found line via parent:", parentLine);
        return parentLine;
      }
      parent = parent.parentElement;
    }

    console.log("[PreviewContextMenu] Could not determine line number");
    return null;
  }, [contentRef, markdownContent]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    clickPositionRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleInsertScreenshot = useCallback(() => {
    const lineNumber = findLineFromClick();
    console.log("[PreviewContextMenu] Final detected line:", lineNumber);
    onInsertScreenshot(lineNumber);
  }, [findLineFromClick, onInsertScreenshot]);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild onContextMenu={handleContextMenu}>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <ContextMenuItem
          onClick={handleInsertScreenshot}
          disabled={!hasVideo}
          className="gap-2"
        >
          <ImagePlus className="h-4 w-4" />
          {t("insertScreenshot")}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

export default PreviewContextMenu;
