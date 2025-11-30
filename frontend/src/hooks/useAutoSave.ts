"use client";

import { useState, useCallback, useEffect, useRef } from "react";

interface AutoSaveOptions {
  /** Interval in milliseconds (default: 120000 = 2 minutes) */
  interval?: number;
  /** Callback to perform the save operation */
  onSave: (content: string) => Promise<void>;
  /** Whether auto-save is enabled */
  enabled?: boolean;
}

interface AutoSaveState {
  /** Timestamp of last successful save */
  lastSavedAt: Date | null;
  /** Whether a save is currently in progress */
  isSaving: boolean;
  /** Last error encountered during save */
  lastError: Error | null;
  /** Whether there are pending changes to save */
  hasPendingChanges: boolean;
}

/**
 * Hook for auto-saving content at regular intervals
 */
export function useAutoSave(
  content: string,
  originalContent: string,
  options: AutoSaveOptions
) {
  const { interval = 120000, onSave, enabled = true } = options;

  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastError, setLastError] = useState<Error | null>(null);

  // Track the last saved content to avoid unnecessary saves
  const lastSavedContentRef = useRef<string>(originalContent);
  const contentRef = useRef<string>(content);
  const isMountedRef = useRef(true);

  // Update content ref when content changes
  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  // Update original content ref when it changes
  useEffect(() => {
    lastSavedContentRef.current = originalContent;
  }, [originalContent]);

  // Track mount state
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  /**
   * Perform a save operation
   * Returns { success: true } on success, or { success: false, error: Error } on failure
   */
  const saveNow = useCallback(async (): Promise<{ success: boolean; error?: Error }> => {
    const currentContent = contentRef.current;

    // Don't save if content hasn't changed
    if (currentContent === lastSavedContentRef.current) {
      return { success: true };
    }

    setIsSaving(true);
    setLastError(null);

    try {
      await onSave(currentContent);

      if (isMountedRef.current) {
        lastSavedContentRef.current = currentContent;
        setLastSavedAt(new Date());
        setIsSaving(false);
      }

      return { success: true };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      if (isMountedRef.current) {
        setLastError(err);
        setIsSaving(false);
      }
      return { success: false, error: err };
    }
  }, [onSave]);

  /**
   * Mark content as saved (e.g., after manual save)
   */
  const markAsSaved = useCallback((savedContent?: string) => {
    lastSavedContentRef.current = savedContent ?? contentRef.current;
    setLastSavedAt(new Date());
  }, []);

  // Auto-save interval
  useEffect(() => {
    if (!enabled) return;

    const timer = setInterval(() => {
      // Only auto-save if there are changes
      if (contentRef.current !== lastSavedContentRef.current) {
        saveNow();
      }
    }, interval);

    return () => clearInterval(timer);
  }, [enabled, interval, saveNow]);

  // Compute time since last save for display
  const getTimeSinceLastSave = useCallback((): string | null => {
    if (!lastSavedAt) return null;

    const now = new Date();
    const diffMs = now.getTime() - lastSavedAt.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "just now";
    if (diffMins === 1) return "1 min ago";
    if (diffMins < 60) return `${diffMins} mins ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours === 1) return "1 hour ago";
    return `${diffHours} hours ago`;
  }, [lastSavedAt]);

  const hasPendingChanges = content !== lastSavedContentRef.current;

  return {
    // State
    lastSavedAt,
    isSaving,
    lastError,
    hasPendingChanges,

    // Actions
    saveNow,
    markAsSaved,

    // Helpers
    getTimeSinceLastSave,
  };
}

export default useAutoSave;
