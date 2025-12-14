"use client";

import { useState, useEffect } from "react";

/**
 * Hook to detect media query matches
 * Safe for SSR - returns false during server render, then updates on client
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);

    // Set initial value
    setMatches(mediaQuery.matches);

    // Listen for changes
    const handler = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, [query]);

  return matches;
}

/**
 * Convenience hook to detect mobile viewport
 */
export function useIsMobile(): boolean {
  return useMediaQuery("(max-width: 767px)");
}
