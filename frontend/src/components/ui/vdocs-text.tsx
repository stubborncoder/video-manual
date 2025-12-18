"use client";

import { cn } from "@/lib/utils";

interface VDocsTextProps {
  className?: string;
  /** Additional text to append after "vDocs" (e.g., " Guide", " Admin") */
  suffix?: string;
}

/**
 * Branded vDocs text component.
 * Renders "vDocs" with bold styling and the "D" in the primary theme color.
 */
export function VDocsText({ className, suffix }: VDocsTextProps) {
  return (
    <span className={cn("font-bold", className)}>
      v<span className="text-primary">D</span>ocs{suffix}
    </span>
  );
}
