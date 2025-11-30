"use client";

import { useState, useCallback, useEffect, useRef } from "react";

/**
 * Represents a single edit command that can be undone/redone
 */
export interface EditCommand {
  id: string;
  timestamp: Date;
  type: "text_replace" | "text_insert" | "text_delete" | "image_replace" | "caption_update" | "bulk";
  before: string;
  after: string;
  description: string;
}

/**
 * State stored in localStorage
 */
interface UndoState {
  manualId: string;
  undoStack: EditCommand[];
  redoStack: EditCommand[];
  lastSavedContent: string;
  savedAt: string | null;
}

const STORAGE_KEY_PREFIX = "manual_editor_undo_";
const MAX_UNDO_STACK_SIZE = 100;
const EXPIRY_HOURS = 24;

/**
 * Generate a unique ID for commands
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Hook for managing undo/redo with localStorage persistence
 */
export function useUndoRedo(manualId: string, initialContent: string) {
  const [undoStack, setUndoStack] = useState<EditCommand[]>([]);
  const [redoStack, setRedoStack] = useState<EditCommand[]>([]);
  const [currentContent, setCurrentContent] = useState(initialContent);
  const [lastSavedContent, setLastSavedContent] = useState(initialContent);
  const [isInitialized, setIsInitialized] = useState(false);

  const storageKey = `${STORAGE_KEY_PREFIX}${manualId}`;

  // Track if we should skip the next content update (to avoid loops)
  const skipNextUpdate = useRef(false);

  // Ref to track current content for avoiding stale closures
  const currentContentRef = useRef(currentContent);
  currentContentRef.current = currentContent;

  // Load from localStorage on mount
  useEffect(() => {
    if (!manualId) return;

    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const state: UndoState = JSON.parse(stored);

        // Check if data is expired
        if (state.savedAt) {
          const savedTime = new Date(state.savedAt).getTime();
          const now = Date.now();
          const hoursElapsed = (now - savedTime) / (1000 * 60 * 60);

          if (hoursElapsed > EXPIRY_HOURS) {
            // Data expired, clear it
            localStorage.removeItem(storageKey);
            setIsInitialized(true);
            return;
          }
        }

        // Restore state if it's for the same manual
        if (state.manualId === manualId) {
          // Convert timestamp strings back to Date objects
          const restoredUndo = state.undoStack.map(cmd => ({
            ...cmd,
            timestamp: new Date(cmd.timestamp),
          }));
          const restoredRedo = state.redoStack.map(cmd => ({
            ...cmd,
            timestamp: new Date(cmd.timestamp),
          }));

          setUndoStack(restoredUndo);
          setRedoStack(restoredRedo);
          setLastSavedContent(state.lastSavedContent);

          // If there are undo items, the current content should be the latest state
          // which is after all undo operations
          if (restoredUndo.length > 0) {
            const latestContent = restoredUndo[restoredUndo.length - 1].after;
            if (latestContent !== initialContent) {
              skipNextUpdate.current = true;
              setCurrentContent(latestContent);
            }
          }
        }
      }
    } catch (e) {
      console.error("Failed to load undo state from localStorage:", e);
    }

    setIsInitialized(true);
  }, [manualId, storageKey]);

  // Save to localStorage when stacks change
  useEffect(() => {
    if (!isInitialized || !manualId) return;

    try {
      const state: UndoState = {
        manualId,
        undoStack,
        redoStack,
        lastSavedContent,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch (e) {
      console.error("Failed to save undo state to localStorage:", e);
    }
  }, [undoStack, redoStack, lastSavedContent, manualId, storageKey, isInitialized]);

  // Update initial content when it changes (e.g., language switch)
  useEffect(() => {
    if (skipNextUpdate.current) {
      skipNextUpdate.current = false;
      return;
    }
    setCurrentContent(initialContent);
    setLastSavedContent(initialContent);
  }, [initialContent]);

  /**
   * Push a new edit command to the undo stack
   */
  const pushCommand = useCallback((
    type: EditCommand["type"],
    before: string,
    after: string,
    description: string
  ) => {
    const command: EditCommand = {
      id: generateId(),
      timestamp: new Date(),
      type,
      before,
      after,
      description,
    };

    setUndoStack(prev => {
      const newStack = [...prev, command];
      // Limit stack size
      if (newStack.length > MAX_UNDO_STACK_SIZE) {
        return newStack.slice(-MAX_UNDO_STACK_SIZE);
      }
      return newStack;
    });

    // Clear redo stack when new action is performed
    setRedoStack([]);
    setCurrentContent(after);
  }, []);

  /**
   * Record a content change (convenience wrapper around pushCommand)
   */
  const recordChange = useCallback((
    newContent: string,
    description: string = "Edit content"
  ) => {
    const current = currentContentRef.current;
    if (newContent === current) {
      return;
    }
    pushCommand("text_replace", current, newContent, description);
  }, [pushCommand]);

  /**
   * Undo the last action
   */
  const undo = useCallback((): EditCommand | null => {
    if (undoStack.length === 0) return null;

    const command = undoStack[undoStack.length - 1];

    setUndoStack(prev => prev.slice(0, -1));
    setRedoStack(prev => [...prev, command]);
    setCurrentContent(command.before);

    return command;
  }, [undoStack]);

  /**
   * Redo the last undone action
   */
  const redo = useCallback((): EditCommand | null => {
    if (redoStack.length === 0) return null;

    const command = redoStack[redoStack.length - 1];

    setRedoStack(prev => prev.slice(0, -1));
    setUndoStack(prev => [...prev, command]);
    setCurrentContent(command.after);

    return command;
  }, [redoStack]);

  /**
   * Clear all undo/redo history
   */
  const clear = useCallback(() => {
    setUndoStack([]);
    setRedoStack([]);
    localStorage.removeItem(storageKey);
  }, [storageKey]);

  /**
   * Mark current content as saved (resets unsaved changes counter)
   */
  const markAsSaved = useCallback(() => {
    setLastSavedContent(currentContent);
  }, [currentContent]);

  /**
   * Get the number of unsaved changes
   */
  const unsavedChangesCount = undoStack.filter(
    cmd => new Date(cmd.timestamp) > new Date(lastSavedContent ? 0 : Date.now())
  ).length;

  // Calculate actual unsaved changes by comparing to last saved
  const changesSinceLastSave = (() => {
    let count = 0;
    for (let i = undoStack.length - 1; i >= 0; i--) {
      if (undoStack[i].before === lastSavedContent) break;
      count++;
    }
    return currentContent !== lastSavedContent ? Math.max(count, 1) : 0;
  })();

  return {
    // State
    currentContent,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    undoStack,
    redoStack,
    hasUnsavedChanges: currentContent !== lastSavedContent,
    unsavedChangesCount: changesSinceLastSave,
    isInitialized,

    // Actions
    pushCommand,
    recordChange,
    undo,
    redo,
    clear,
    markAsSaved,
    setCurrentContent,
  };
}

export default useUndoRedo;
