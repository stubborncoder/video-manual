/**
 * Tests for useUndoRedo hook
 * Tests state management, undo/redo operations, and localStorage persistence
 */

import { renderHook, act } from '@testing-library/react';
import { useUndoRedo } from '@/hooks/useUndoRedo';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
    get store() {
      return store;
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

beforeEach(() => {
  jest.clearAllMocks();
  localStorageMock.clear();
});

describe('useUndoRedo', () => {
  const manualId = 'test-manual-001';
  const initialContent = '# Initial Content\n\nThis is the initial content.';

  describe('test_initial_state', () => {
    it('should initialize with provided content', () => {
      const { result } = renderHook(() => useUndoRedo(manualId, initialContent));

      expect(result.current.currentContent).toBe(initialContent);
      expect(result.current.canUndo).toBe(false);
      expect(result.current.canRedo).toBe(false);
      expect(result.current.undoStack).toEqual([]);
      expect(result.current.redoStack).toEqual([]);
      expect(result.current.hasUnsavedChanges).toBe(false);
    });

    it('should report as initialized after mount', async () => {
      const { result } = renderHook(() => useUndoRedo(manualId, initialContent));

      // Should initialize after localStorage check
      expect(result.current.isInitialized).toBe(true);
    });

    it('should restore state from localStorage if available', () => {
      const savedState = {
        manualId,
        undoStack: [
          {
            id: 'cmd-1',
            timestamp: new Date().toISOString(),
            type: 'text_replace',
            before: initialContent,
            after: 'Modified content',
            description: 'Test edit',
          },
        ],
        redoStack: [],
        lastSavedContent: initialContent,
        savedAt: new Date().toISOString(),
      };

      localStorageMock.setItem(`manual_editor_undo_${manualId}`, JSON.stringify(savedState));

      const { result } = renderHook(() => useUndoRedo(manualId, initialContent));

      expect(result.current.canUndo).toBe(true);
      expect(result.current.undoStack.length).toBe(1);
    });

    it('should not restore expired localStorage data', () => {
      const expiredDate = new Date();
      expiredDate.setHours(expiredDate.getHours() - 25); // 25 hours ago (past 24 hour expiry)

      const savedState = {
        manualId,
        undoStack: [
          {
            id: 'cmd-1',
            timestamp: new Date().toISOString(),
            type: 'text_replace',
            before: initialContent,
            after: 'Modified content',
            description: 'Test edit',
          },
        ],
        redoStack: [],
        lastSavedContent: initialContent,
        savedAt: expiredDate.toISOString(),
      };

      localStorageMock.setItem(`manual_editor_undo_${manualId}`, JSON.stringify(savedState));

      const { result } = renderHook(() => useUndoRedo(manualId, initialContent));

      // Expired data should not be restored
      expect(result.current.canUndo).toBe(false);
      expect(result.current.undoStack.length).toBe(0);
    });
  });

  describe('test_push_state', () => {
    it('should add command to undo stack via pushCommand', () => {
      const { result } = renderHook(() => useUndoRedo(manualId, initialContent));

      const newContent = '# Modified Content';

      act(() => {
        result.current.pushCommand('text_replace', initialContent, newContent, 'Changed title');
      });

      expect(result.current.canUndo).toBe(true);
      expect(result.current.undoStack.length).toBe(1);
      expect(result.current.undoStack[0].before).toBe(initialContent);
      expect(result.current.undoStack[0].after).toBe(newContent);
      expect(result.current.undoStack[0].description).toBe('Changed title');
      expect(result.current.currentContent).toBe(newContent);
    });

    it('should record change via recordChange convenience method', () => {
      const { result } = renderHook(() => useUndoRedo(manualId, initialContent));

      const newContent = '# New Content';

      act(() => {
        result.current.recordChange(newContent, 'Updated document');
      });

      expect(result.current.canUndo).toBe(true);
      expect(result.current.undoStack.length).toBe(1);
      expect(result.current.currentContent).toBe(newContent);
    });

    it('should not record change if content is the same', () => {
      const { result } = renderHook(() => useUndoRedo(manualId, initialContent));

      act(() => {
        result.current.recordChange(initialContent, 'No change');
      });

      expect(result.current.canUndo).toBe(false);
      expect(result.current.undoStack.length).toBe(0);
    });

    it('should clear redo stack when new command is pushed', () => {
      const { result } = renderHook(() => useUndoRedo(manualId, initialContent));

      // Make a change
      act(() => {
        result.current.recordChange('Content 1', 'First edit');
      });

      // Undo it
      act(() => {
        result.current.undo();
      });

      expect(result.current.canRedo).toBe(true);

      // Make a new change - should clear redo stack
      act(() => {
        result.current.recordChange('Content 2', 'New edit');
      });

      expect(result.current.canRedo).toBe(false);
      expect(result.current.redoStack.length).toBe(0);
    });

    it('should limit undo stack to MAX_UNDO_STACK_SIZE', () => {
      const { result } = renderHook(() => useUndoRedo(manualId, initialContent));

      // Push more than 100 commands
      for (let i = 0; i < 105; i++) {
        act(() => {
          result.current.pushCommand('text_replace', `Content ${i}`, `Content ${i + 1}`, `Edit ${i}`);
        });
      }

      // Should be capped at 100
      expect(result.current.undoStack.length).toBe(100);
    });
  });

  describe('test_undo_operation', () => {
    it('should undo the last command', () => {
      const { result } = renderHook(() => useUndoRedo(manualId, initialContent));

      const modifiedContent = '# Modified';

      act(() => {
        result.current.recordChange(modifiedContent, 'Modify');
      });

      expect(result.current.currentContent).toBe(modifiedContent);

      act(() => {
        result.current.undo();
      });

      expect(result.current.currentContent).toBe(initialContent);
      expect(result.current.canUndo).toBe(false);
      expect(result.current.canRedo).toBe(true);
    });

    it('should return the undone command', () => {
      const { result } = renderHook(() => useUndoRedo(manualId, initialContent));

      act(() => {
        result.current.recordChange('Modified', 'Test modification');
      });

      let undoneCommand: any;
      act(() => {
        undoneCommand = result.current.undo();
      });

      expect(undoneCommand).not.toBeNull();
      expect(undoneCommand.description).toBe('Test modification');
    });

    it('should move command from undo stack to redo stack', () => {
      const { result } = renderHook(() => useUndoRedo(manualId, initialContent));

      act(() => {
        result.current.recordChange('Change 1', 'First');
        result.current.recordChange('Change 2', 'Second');
      });

      expect(result.current.undoStack.length).toBe(2);
      expect(result.current.redoStack.length).toBe(0);

      act(() => {
        result.current.undo();
      });

      expect(result.current.undoStack.length).toBe(1);
      expect(result.current.redoStack.length).toBe(1);
      expect(result.current.redoStack[0].description).toBe('Second');
    });
  });

  describe('test_redo_operation', () => {
    it('should redo the last undone command', () => {
      const { result } = renderHook(() => useUndoRedo(manualId, initialContent));

      const modifiedContent = '# Modified';

      act(() => {
        result.current.recordChange(modifiedContent, 'Modify');
      });

      act(() => {
        result.current.undo();
      });

      expect(result.current.currentContent).toBe(initialContent);

      act(() => {
        result.current.redo();
      });

      expect(result.current.currentContent).toBe(modifiedContent);
      expect(result.current.canUndo).toBe(true);
      expect(result.current.canRedo).toBe(false);
    });

    it('should return the redone command', () => {
      const { result } = renderHook(() => useUndoRedo(manualId, initialContent));

      act(() => {
        result.current.recordChange('Modified', 'Test redo');
      });

      act(() => {
        result.current.undo();
      });

      let redoneCommand: any;
      act(() => {
        redoneCommand = result.current.redo();
      });

      expect(redoneCommand).not.toBeNull();
      expect(redoneCommand.description).toBe('Test redo');
    });

    it('should move command from redo stack to undo stack', () => {
      const { result } = renderHook(() => useUndoRedo(manualId, initialContent));

      act(() => {
        result.current.recordChange('Change 1', 'First');
      });

      act(() => {
        result.current.undo();
      });

      expect(result.current.undoStack.length).toBe(0);
      expect(result.current.redoStack.length).toBe(1);

      act(() => {
        result.current.redo();
      });

      expect(result.current.undoStack.length).toBe(1);
      expect(result.current.redoStack.length).toBe(0);
    });
  });

  describe('test_clear_history', () => {
    it('should clear both undo and redo stacks', () => {
      const { result } = renderHook(() => useUndoRedo(manualId, initialContent));

      act(() => {
        result.current.recordChange('Change 1', 'First');
      });

      act(() => {
        result.current.recordChange('Change 2', 'Second');
      });

      act(() => {
        result.current.undo();
      });

      expect(result.current.undoStack.length).toBe(1);
      expect(result.current.redoStack.length).toBe(1);

      act(() => {
        result.current.clear();
      });

      expect(result.current.undoStack.length).toBe(0);
      expect(result.current.redoStack.length).toBe(0);
      expect(result.current.canUndo).toBe(false);
      expect(result.current.canRedo).toBe(false);
    });

    it('should remove localStorage entry on clear', () => {
      const { result } = renderHook(() => useUndoRedo(manualId, initialContent));

      act(() => {
        result.current.recordChange('Change', 'Edit');
      });

      act(() => {
        result.current.clear();
      });

      expect(localStorageMock.removeItem).toHaveBeenCalledWith(`manual_editor_undo_${manualId}`);
    });
  });

  describe('test_cannot_undo_at_start', () => {
    it('should not be able to undo with empty undo stack', () => {
      const { result } = renderHook(() => useUndoRedo(manualId, initialContent));

      expect(result.current.canUndo).toBe(false);

      let undoResult: any;
      act(() => {
        undoResult = result.current.undo();
      });

      expect(undoResult).toBeNull();
      expect(result.current.currentContent).toBe(initialContent);
    });

    it('should not change state when undo is called with empty stack', () => {
      const { result } = renderHook(() => useUndoRedo(manualId, initialContent));

      const initialUndoStack = result.current.undoStack;
      const initialRedoStack = result.current.redoStack;

      act(() => {
        result.current.undo();
      });

      expect(result.current.undoStack).toEqual(initialUndoStack);
      expect(result.current.redoStack).toEqual(initialRedoStack);
    });
  });

  describe('test_cannot_redo_at_end', () => {
    it('should not be able to redo with empty redo stack', () => {
      const { result } = renderHook(() => useUndoRedo(manualId, initialContent));

      expect(result.current.canRedo).toBe(false);

      let redoResult: any;
      act(() => {
        redoResult = result.current.redo();
      });

      expect(redoResult).toBeNull();
    });

    it('should not be able to redo after making a new change', () => {
      const { result } = renderHook(() => useUndoRedo(manualId, initialContent));

      // Create undo history
      act(() => {
        result.current.recordChange('Change 1', 'First');
      });

      act(() => {
        result.current.undo();
      });

      expect(result.current.canRedo).toBe(true);

      // Make new change - clears redo
      act(() => {
        result.current.recordChange('Change 2', 'Second');
      });

      expect(result.current.canRedo).toBe(false);

      let redoResult: any;
      act(() => {
        redoResult = result.current.redo();
      });

      expect(redoResult).toBeNull();
    });
  });

  describe('unsaved changes tracking', () => {
    it('should track unsaved changes', () => {
      const { result } = renderHook(() => useUndoRedo(manualId, initialContent));

      expect(result.current.hasUnsavedChanges).toBe(false);

      act(() => {
        result.current.recordChange('Modified content', 'Edit');
      });

      expect(result.current.hasUnsavedChanges).toBe(true);
    });

    it('should mark content as saved', () => {
      const { result } = renderHook(() => useUndoRedo(manualId, initialContent));

      act(() => {
        result.current.recordChange('Modified content', 'Edit');
      });

      expect(result.current.hasUnsavedChanges).toBe(true);

      act(() => {
        result.current.markAsSaved();
      });

      expect(result.current.hasUnsavedChanges).toBe(false);
    });

    it('should count unsaved changes correctly', () => {
      const { result } = renderHook(() => useUndoRedo(manualId, initialContent));

      expect(result.current.unsavedChangesCount).toBe(0);

      act(() => {
        result.current.recordChange('Change 1', 'First');
        result.current.recordChange('Change 2', 'Second');
      });

      expect(result.current.unsavedChangesCount).toBeGreaterThan(0);
    });
  });

  describe('localStorage persistence', () => {
    it('should save state to localStorage on changes', () => {
      const { result } = renderHook(() => useUndoRedo(manualId, initialContent));

      act(() => {
        result.current.recordChange('Modified', 'Edit');
      });

      // Wait for effect to run
      expect(localStorageMock.setItem).toHaveBeenCalled();

      const storedData = JSON.parse(
        localStorageMock.store[`manual_editor_undo_${manualId}`]
      );
      expect(storedData.manualId).toBe(manualId);
      expect(storedData.undoStack.length).toBe(1);
    });
  });
});
