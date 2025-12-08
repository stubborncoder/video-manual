"use client";

import { useMemo, useCallback, useRef, useEffect } from "react";
import { getTagPositions } from "@/lib/tag-utils";

interface SemanticTagHighlighterProps {
  content: string;
  onChange: (content: string) => void;
  showLineNumbers: boolean;
  showTagHighlighting: boolean;
  showCollapsibleRegions?: boolean; // Reserved for future use
  placeholder?: string;
  className?: string;
}

/**
 * Markdown editor with semantic tag highlighting.
 *
 * Features:
 * - Syntax highlighting for semantic tags (violet color)
 * - Line numbers
 * - Synchronized scrolling between overlay and textarea
 */
export function SemanticTagHighlighter({
  content,
  onChange,
  showLineNumbers,
  showTagHighlighting = true,
  placeholder,
  className = "",
}: SemanticTagHighlighterProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

  // Calculate tag positions for highlighting
  const tagPositions = useMemo(() => {
    if (!showTagHighlighting) return [];
    return getTagPositions(content);
  }, [content, showTagHighlighting]);

  // Split content into lines
  const lines = useMemo(() => content.split("\n"), [content]);

  // Build highlighted lines with tag coloring
  const highlightedContent = useMemo(() => {
    if (!showTagHighlighting) {
      return content;
    }

    // Create a map of line -> positions on that line
    const positionsByLine = new Map<number, typeof tagPositions>();
    for (const pos of tagPositions) {
      const existing = positionsByLine.get(pos.line) || [];
      existing.push(pos);
      positionsByLine.set(pos.line, existing);
    }

    return lines.map((line, lineIndex) => {
      const lineNum = lineIndex + 1;
      const linePositions = positionsByLine.get(lineNum) || [];

      if (linePositions.length === 0) {
        return <span key={lineIndex}>{line}{"\n"}</span>;
      }

      // Sort positions by column
      linePositions.sort((a, b) => a.column - b.column);

      // Build segments
      const segments: React.ReactNode[] = [];
      let lastEnd = 0;

      // Calculate line start position in full content
      const lineStart = lines.slice(0, lineIndex).reduce((acc, l) => acc + l.length + 1, 0);

      for (const pos of linePositions) {
        const tagStartInLine = pos.startPos - lineStart;
        const tagEndInLine = pos.endPos - lineStart;

        if (tagStartInLine < 0 || tagEndInLine > line.length) continue;

        // Add text before the tag
        if (tagStartInLine > lastEnd) {
          segments.push(
            <span key={`text-${lineIndex}-${lastEnd}`}>{line.slice(lastEnd, tagStartInLine)}</span>
          );
        }

        // Add the highlighted tag
        const tagText = line.slice(tagStartInLine, tagEndInLine);
        segments.push(
          <span
            key={`tag-${lineIndex}-${tagStartInLine}`}
            className="text-violet-500 dark:text-violet-400"
          >
            {tagText}
          </span>
        );

        lastEnd = tagEndInLine;
      }

      // Add remaining text
      if (lastEnd < line.length) {
        segments.push(
          <span key={`text-${lineIndex}-end`}>{line.slice(lastEnd)}</span>
        );
      }

      return <span key={lineIndex}>{segments}{"\n"}</span>;
    });
  }, [lines, tagPositions, showTagHighlighting, content]);

  // Sync scroll between textarea, overlay, and gutter
  const handleScroll = useCallback(() => {
    if (textareaRef.current) {
      const scrollTop = textareaRef.current.scrollTop;
      const scrollLeft = textareaRef.current.scrollLeft;

      if (overlayRef.current) {
        overlayRef.current.scrollTop = scrollTop;
        overlayRef.current.scrollLeft = scrollLeft;
      }
      if (gutterRef.current) {
        gutterRef.current.scrollTop = scrollTop;
      }
    }
  }, []);

  // Handle textarea change
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange(e.target.value);
    },
    [onChange]
  );

  // If no special features, return simple textarea
  if (!showLineNumbers && !showTagHighlighting) {
    return (
      <textarea
        value={content}
        onChange={handleChange}
        className={`h-full w-full resize-none rounded-none border-0 font-mono text-sm focus-visible:ring-0 focus-visible:ring-offset-0 overflow-auto p-4 bg-background ${className}`}
        placeholder={placeholder}
      />
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Line numbers gutter */}
      {showLineNumbers && (
        <div
          ref={gutterRef}
          className="shrink-0 bg-muted/30 text-right py-2 overflow-hidden select-none border-r border-border/50"
          style={{ width: "3.5rem" }}
          aria-hidden="true"
        >
          {lines.map((_, i) => (
            <div
              key={i + 1}
              className="px-2 text-muted-foreground/60 font-mono text-sm leading-6 h-6"
            >
              {i + 1}
            </div>
          ))}
        </div>
      )}

      {/* Editor area with highlighting overlay */}
      <div className="flex-1 relative overflow-hidden">
        {/* Syntax highlighting overlay (read-only display) */}
        {showTagHighlighting && (
          <div
            ref={overlayRef}
            className="absolute inset-0 py-2 px-4 font-mono text-sm pointer-events-none overflow-hidden whitespace-pre-wrap break-all"
            style={{ lineHeight: "1.5rem" }}
            aria-hidden="true"
          >
            {highlightedContent}
          </div>
        )}

        {/* Actual editable textarea (transparent text when overlay active) */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onScroll={handleScroll}
          className={`absolute inset-0 h-full w-full resize-none rounded-none border-0 font-mono text-sm focus-visible:ring-0 focus-visible:ring-offset-0 overflow-auto py-2 px-4 bg-transparent ${
            showTagHighlighting ? "text-transparent caret-foreground selection:bg-primary/30" : ""
          } ${className}`}
          placeholder={placeholder}
          style={{ lineHeight: "1.5rem" }}
          spellCheck={false}
        />
      </div>
    </div>
  );
}

export default SemanticTagHighlighter;
