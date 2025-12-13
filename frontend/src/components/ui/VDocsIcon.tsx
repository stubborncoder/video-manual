"use client";

import { cn } from "@/lib/utils";

interface VDocsIconProps {
  className?: string;
  branded?: boolean;
}

/**
 * Custom vDocs icon component
 * @param branded - If true, uses the gradient brand colors. If false, uses currentColor.
 */
export function VDocsIcon({ className, branded = false }: VDocsIconProps) {
  if (branded) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cn(className)}
      >
        <defs>
          <linearGradient id="brandGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: "#4361EE" }} />
            <stop offset="100%" style={{ stopColor: "#60A5FA" }} />
          </linearGradient>
        </defs>
        <path
          d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"
          stroke="url(#brandGrad)"
          strokeWidth="1.5"
          fill="none"
        />
        <polyline
          points="14 2 14 8 20 8"
          stroke="url(#brandGrad)"
          strokeWidth="1.5"
          fill="none"
        />
        <path
          d="M6 12l2 2-2 2"
          stroke="url(#brandGrad)"
          strokeWidth="1"
          fill="none"
          opacity="0.3"
        />
        <path
          d="M9 11.5l3 2.5-3 2.5"
          stroke="url(#brandGrad)"
          strokeWidth="1.5"
          fill="none"
          opacity="0.6"
        />
        <path
          d="M13 11l4 3-4 3"
          stroke="url(#brandGrad)"
          strokeWidth="2"
          fill="none"
        />
      </svg>
    );
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn(className)}
    >
      <path
        d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"
        fill="none"
      />
      <polyline points="14 2 14 8 20 8" fill="none" />
      <path d="M6 12l2 2-2 2" strokeWidth="1" fill="none" opacity="0.3" />
      <path d="M9 11.5l3 2.5-3 2.5" strokeWidth="1.5" fill="none" opacity="0.6" />
      <path d="M13 11l4 3-4 3" strokeWidth="2" fill="none" />
    </svg>
  );
}
