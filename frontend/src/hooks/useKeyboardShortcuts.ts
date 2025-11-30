"use client";

import { useEffect, useCallback } from "react";

interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  action: () => void;
  preventDefault?: boolean;
}

interface UseKeyboardShortcutsOptions {
  shortcuts: KeyboardShortcut[];
  enabled?: boolean;
}

/**
 * Hook for managing keyboard shortcuts
 */
export function useKeyboardShortcuts({
  shortcuts,
  enabled = true,
}: UseKeyboardShortcutsOptions) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Don't trigger shortcuts when typing in inputs (except for global shortcuts like save)
      const target = event.target as HTMLElement;
      const isInputElement =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      for (const shortcut of shortcuts) {
        const ctrlPressed = event.ctrlKey || event.metaKey;
        const shiftPressed = event.shiftKey;
        const altPressed = event.altKey;

        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatch = (shortcut.ctrl ?? false) === ctrlPressed;
        const shiftMatch = (shortcut.shift ?? false) === shiftPressed;
        const altMatch = (shortcut.alt ?? false) === altPressed;

        if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
          // For Ctrl+key shortcuts, allow them even in inputs (like Ctrl+S)
          if (isInputElement && !shortcut.ctrl) {
            continue;
          }

          if (shortcut.preventDefault !== false) {
            event.preventDefault();
          }
          shortcut.action();
          return;
        }
      }
    },
    [shortcuts, enabled]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}

/**
 * Common editor shortcuts configuration
 */
export function createEditorShortcuts(handlers: {
  onUndo?: () => void;
  onRedo?: () => void;
  onSave?: () => void;
}): KeyboardShortcut[] {
  const shortcuts: KeyboardShortcut[] = [];

  if (handlers.onUndo) {
    shortcuts.push({
      key: "z",
      ctrl: true,
      shift: false,
      action: handlers.onUndo,
    });
  }

  if (handlers.onRedo) {
    // Ctrl+Shift+Z
    shortcuts.push({
      key: "z",
      ctrl: true,
      shift: true,
      action: handlers.onRedo,
    });
    // Ctrl+Y (alternative)
    shortcuts.push({
      key: "y",
      ctrl: true,
      action: handlers.onRedo,
    });
  }

  if (handlers.onSave) {
    shortcuts.push({
      key: "s",
      ctrl: true,
      action: handlers.onSave,
    });
  }

  return shortcuts;
}

export default useKeyboardShortcuts;
