"use client";

import { ReactNode, useCallback, useState, useRef } from "react";
import { ImagePlus } from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useTranslations } from "next-intl";

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
 * Context menu for the preview area that allows inserting screenshots.
 * Tries to detect the clicked position to insert at the right location.
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

  // Try to find the line number from click position
  const findLineFromClick = useCallback((): number | null => {
    if (!contentRef?.current || !markdownContent || !clickPositionRef.current) {
      return null;
    }

    const { x, y } = clickPositionRef.current;
    const container = contentRef.current;

    // Get the element at the click position
    const element = document.elementFromPoint(x, y);
    if (!element || !container.contains(element)) {
      return null;
    }

    // Try to find text content that matches something in the markdown
    // Walk up to find a meaningful block element
    let targetElement: Element | null = element;
    while (targetElement && targetElement !== container) {
      const tagName = targetElement.tagName.toLowerCase();
      // Stop at block-level elements
      if (['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote', 'pre'].includes(tagName)) {
        break;
      }
      targetElement = targetElement.parentElement;
    }

    if (!targetElement || targetElement === container) {
      return null;
    }

    // Get the text content and try to find it in the markdown
    const textContent = targetElement.textContent?.trim();
    if (!textContent) {
      return null;
    }

    // Search for this text in the markdown lines
    const lines = markdownContent.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const lineText = lines[i].replace(/^#+\s*/, '').replace(/\*\*/g, '').replace(/\*/g, '').trim();
      if (lineText && textContent.includes(lineText.substring(0, 50))) {
        return i + 1; // Return 1-indexed line number
      }
    }

    return null;
  }, [contentRef, markdownContent]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    clickPositionRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleInsertScreenshot = useCallback(() => {
    const lineNumber = findLineFromClick();
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
