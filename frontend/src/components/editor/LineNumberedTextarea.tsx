"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { Textarea } from "@/components/ui/textarea";

interface LineNumberedTextareaProps {
  value: string;
  onChange: (value: string) => void;
  showLineNumbers: boolean;
  placeholder?: string;
  className?: string;
}

/**
 * Textarea with line numbers in the gutter.
 */
export function LineNumberedTextarea({
  value,
  onChange,
  showLineNumbers,
  placeholder,
  className = "",
}: LineNumberedTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const [lineCount, setLineCount] = useState(1);

  // Update line count when value changes
  useEffect(() => {
    const lines = value.split("\n").length;
    setLineCount(lines);
  }, [value]);

  // Sync scroll between textarea and gutter
  const handleScroll = useCallback(() => {
    if (textareaRef.current && gutterRef.current) {
      gutterRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  }, []);

  if (!showLineNumbers) {
    return (
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`h-full w-full resize-none rounded-none border-0 font-mono text-sm focus-visible:ring-0 focus-visible:ring-offset-0 overflow-auto custom-scrollbar ${className}`}
        placeholder={placeholder}
      />
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Line numbers gutter */}
      <div
        ref={gutterRef}
        className="shrink-0 bg-muted/30 text-right py-2 overflow-hidden select-none border-r border-border/50"
        style={{ width: "3.5rem" }}
        aria-hidden="true"
      >
        {Array.from({ length: lineCount }, (_, i) => (
          <div
            key={i + 1}
            className="px-2 text-muted-foreground/60 font-mono text-sm leading-[1.5rem]"
          >
            {i + 1}
          </div>
        ))}
      </div>

      {/* Textarea */}
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={handleScroll}
        className={`flex-1 h-full resize-none rounded-none border-0 font-mono text-sm focus-visible:ring-0 focus-visible:ring-offset-0 overflow-auto custom-scrollbar leading-[1.5rem] py-2 ${className}`}
        placeholder={placeholder}
        style={{ lineHeight: "1.5rem" }}
      />
    </div>
  );
}

export default LineNumberedTextarea;
