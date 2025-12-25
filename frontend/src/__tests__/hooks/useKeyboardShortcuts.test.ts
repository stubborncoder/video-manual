/**
 * Tests for useKeyboardShortcuts hook
 * Tests shortcut registration, callback triggering, and cleanup
 */

import { renderHook, act } from '@testing-library/react';
import { useKeyboardShortcuts, createEditorShortcuts } from '@/hooks/useKeyboardShortcuts';

beforeEach(() => {
  jest.clearAllMocks();
});

// Helper to create keyboard events
const createKeyboardEvent = (
  key: string,
  options: {
    ctrlKey?: boolean;
    shiftKey?: boolean;
    altKey?: boolean;
    metaKey?: boolean;
    target?: EventTarget;
  } = {}
): KeyboardEvent => {
  return new KeyboardEvent('keydown', {
    key,
    ctrlKey: options.ctrlKey ?? false,
    shiftKey: options.shiftKey ?? false,
    altKey: options.altKey ?? false,
    metaKey: options.metaKey ?? false,
    bubbles: true,
    cancelable: true,
  });
};

describe('useKeyboardShortcuts', () => {
  describe('test_registers_shortcuts', () => {
    it('should register keyboard event listener on mount', () => {
      const addEventListenerSpy = jest.spyOn(document, 'addEventListener');

      const onSave = jest.fn();
      renderHook(() =>
        useKeyboardShortcuts({
          shortcuts: [{ key: 's', ctrl: true, action: onSave }],
        })
      );

      expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

      addEventListenerSpy.mockRestore();
    });

    it('should handle multiple shortcuts', () => {
      const onSave = jest.fn();
      const onUndo = jest.fn();
      const onRedo = jest.fn();

      renderHook(() =>
        useKeyboardShortcuts({
          shortcuts: [
            { key: 's', ctrl: true, action: onSave },
            { key: 'z', ctrl: true, action: onUndo },
            { key: 'z', ctrl: true, shift: true, action: onRedo },
          ],
        })
      );

      // Test Ctrl+S
      act(() => {
        document.dispatchEvent(createKeyboardEvent('s', { ctrlKey: true }));
      });
      expect(onSave).toHaveBeenCalledTimes(1);

      // Test Ctrl+Z
      act(() => {
        document.dispatchEvent(createKeyboardEvent('z', { ctrlKey: true }));
      });
      expect(onUndo).toHaveBeenCalledTimes(1);

      // Test Ctrl+Shift+Z
      act(() => {
        document.dispatchEvent(createKeyboardEvent('z', { ctrlKey: true, shiftKey: true }));
      });
      expect(onRedo).toHaveBeenCalledTimes(1);
    });

    it('should not register shortcuts when disabled', () => {
      const onSave = jest.fn();

      renderHook(() =>
        useKeyboardShortcuts({
          shortcuts: [{ key: 's', ctrl: true, action: onSave }],
          enabled: false,
        })
      );

      act(() => {
        document.dispatchEvent(createKeyboardEvent('s', { ctrlKey: true }));
      });

      expect(onSave).not.toHaveBeenCalled();
    });
  });

  describe('test_triggers_callback', () => {
    it('should trigger callback for matching shortcut', () => {
      const onAction = jest.fn();

      renderHook(() =>
        useKeyboardShortcuts({
          shortcuts: [{ key: 's', ctrl: true, action: onAction }],
        })
      );

      act(() => {
        document.dispatchEvent(createKeyboardEvent('s', { ctrlKey: true }));
      });

      expect(onAction).toHaveBeenCalledTimes(1);
    });

    it('should not trigger callback for non-matching key', () => {
      const onAction = jest.fn();

      renderHook(() =>
        useKeyboardShortcuts({
          shortcuts: [{ key: 's', ctrl: true, action: onAction }],
        })
      );

      // Different key
      act(() => {
        document.dispatchEvent(createKeyboardEvent('a', { ctrlKey: true }));
      });

      expect(onAction).not.toHaveBeenCalled();
    });

    it('should not trigger callback when modifier keys do not match', () => {
      const onAction = jest.fn();

      renderHook(() =>
        useKeyboardShortcuts({
          shortcuts: [{ key: 's', ctrl: true, action: onAction }],
        })
      );

      // No Ctrl key
      act(() => {
        document.dispatchEvent(createKeyboardEvent('s'));
      });

      expect(onAction).not.toHaveBeenCalled();
    });

    it('should match case-insensitively', () => {
      const onAction = jest.fn();

      renderHook(() =>
        useKeyboardShortcuts({
          shortcuts: [{ key: 's', ctrl: true, action: onAction }],
        })
      );

      act(() => {
        document.dispatchEvent(createKeyboardEvent('S', { ctrlKey: true }));
      });

      expect(onAction).toHaveBeenCalledTimes(1);
    });

    it('should support metaKey (Cmd) as ctrl on Mac', () => {
      const onAction = jest.fn();

      renderHook(() =>
        useKeyboardShortcuts({
          shortcuts: [{ key: 's', ctrl: true, action: onAction }],
        })
      );

      // Cmd+S (macOS)
      act(() => {
        document.dispatchEvent(createKeyboardEvent('s', { metaKey: true }));
      });

      expect(onAction).toHaveBeenCalledTimes(1);
    });

    it('should support alt modifier', () => {
      const onAction = jest.fn();

      renderHook(() =>
        useKeyboardShortcuts({
          shortcuts: [{ key: 'n', alt: true, action: onAction }],
        })
      );

      act(() => {
        document.dispatchEvent(createKeyboardEvent('n', { altKey: true }));
      });

      expect(onAction).toHaveBeenCalledTimes(1);
    });

    it('should require exact modifier match', () => {
      const onAction = jest.fn();

      renderHook(() =>
        useKeyboardShortcuts({
          shortcuts: [{ key: 's', ctrl: true, shift: false, action: onAction }],
        })
      );

      // Extra shift modifier should not match
      act(() => {
        document.dispatchEvent(createKeyboardEvent('s', { ctrlKey: true, shiftKey: true }));
      });

      expect(onAction).not.toHaveBeenCalled();
    });
  });

  describe('test_prevents_default', () => {
    it('should prevent default by default', () => {
      const onAction = jest.fn();

      renderHook(() =>
        useKeyboardShortcuts({
          shortcuts: [{ key: 's', ctrl: true, action: onAction }],
        })
      );

      const event = createKeyboardEvent('s', { ctrlKey: true });
      const preventDefaultSpy = jest.spyOn(event, 'preventDefault');

      act(() => {
        document.dispatchEvent(event);
      });

      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('should not prevent default when preventDefault is false', () => {
      const onAction = jest.fn();

      renderHook(() =>
        useKeyboardShortcuts({
          shortcuts: [{ key: 's', ctrl: true, action: onAction, preventDefault: false }],
        })
      );

      const event = createKeyboardEvent('s', { ctrlKey: true });
      const preventDefaultSpy = jest.spyOn(event, 'preventDefault');

      act(() => {
        document.dispatchEvent(event);
      });

      expect(preventDefaultSpy).not.toHaveBeenCalled();
    });
  });

  describe('test_cleanup_on_unmount', () => {
    it('should remove event listener on unmount', () => {
      const removeEventListenerSpy = jest.spyOn(document, 'removeEventListener');

      const { unmount } = renderHook(() =>
        useKeyboardShortcuts({
          shortcuts: [{ key: 's', ctrl: true, action: jest.fn() }],
        })
      );

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

      removeEventListenerSpy.mockRestore();
    });

    it('should not trigger callbacks after unmount', () => {
      const onAction = jest.fn();

      const { unmount } = renderHook(() =>
        useKeyboardShortcuts({
          shortcuts: [{ key: 's', ctrl: true, action: onAction }],
        })
      );

      unmount();

      act(() => {
        document.dispatchEvent(createKeyboardEvent('s', { ctrlKey: true }));
      });

      expect(onAction).not.toHaveBeenCalled();
    });
  });

  describe('input handling', () => {
    it('should skip non-ctrl shortcuts when in input element', () => {
      const onAction = jest.fn();

      renderHook(() =>
        useKeyboardShortcuts({
          shortcuts: [{ key: 'Escape', action: onAction }],
        })
      );

      // Create input element
      const input = document.createElement('input');
      document.body.appendChild(input);

      // Dispatch event with input as target
      const event = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(event, 'target', { value: input });

      act(() => {
        document.dispatchEvent(event);
      });

      expect(onAction).not.toHaveBeenCalled();

      document.body.removeChild(input);
    });

    it('should allow ctrl shortcuts in input elements', () => {
      const onSave = jest.fn();

      renderHook(() =>
        useKeyboardShortcuts({
          shortcuts: [{ key: 's', ctrl: true, action: onSave }],
        })
      );

      // Create input element
      const input = document.createElement('input');
      document.body.appendChild(input);

      // Dispatch Ctrl+S with input as target
      const event = new KeyboardEvent('keydown', {
        key: 's',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(event, 'target', { value: input });

      act(() => {
        document.dispatchEvent(event);
      });

      expect(onSave).toHaveBeenCalledTimes(1);

      document.body.removeChild(input);
    });

    it('should skip shortcuts in textarea elements', () => {
      const onAction = jest.fn();

      renderHook(() =>
        useKeyboardShortcuts({
          shortcuts: [{ key: 'Enter', action: onAction }],
        })
      );

      const textarea = document.createElement('textarea');
      document.body.appendChild(textarea);

      const event = new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(event, 'target', { value: textarea });

      act(() => {
        document.dispatchEvent(event);
      });

      expect(onAction).not.toHaveBeenCalled();

      document.body.removeChild(textarea);
    });

    it('should skip shortcuts in contentEditable elements', () => {
      const onAction = jest.fn();

      renderHook(() =>
        useKeyboardShortcuts({
          shortcuts: [{ key: 'Enter', action: onAction }],
        })
      );

      const div = document.createElement('div');
      div.contentEditable = 'true';
      document.body.appendChild(div);
      div.focus();

      // In jsdom, we need to mock isContentEditable since it may not work properly
      // Create event with a mocked target that has isContentEditable = true
      const event = new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        cancelable: true,
      });

      // Define isContentEditable on the div element for jsdom compatibility
      Object.defineProperty(div, 'isContentEditable', {
        value: true,
        writable: false,
      });

      act(() => {
        div.dispatchEvent(event);
      });

      expect(onAction).not.toHaveBeenCalled();

      document.body.removeChild(div);
    });
  });

  describe('edge cases', () => {
    it('should handle undefined event.key', () => {
      const onAction = jest.fn();

      renderHook(() =>
        useKeyboardShortcuts({
          shortcuts: [{ key: 's', ctrl: true, action: onAction }],
        })
      );

      const event = new KeyboardEvent('keydown', {
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      // Override key to be undefined
      Object.defineProperty(event, 'key', { value: undefined });

      act(() => {
        document.dispatchEvent(event);
      });

      expect(onAction).not.toHaveBeenCalled();
    });

    it('should skip shortcuts with undefined key', () => {
      const onAction = jest.fn();

      renderHook(() =>
        useKeyboardShortcuts({
          shortcuts: [{ key: undefined as any, ctrl: true, action: onAction }],
        })
      );

      act(() => {
        document.dispatchEvent(createKeyboardEvent('s', { ctrlKey: true }));
      });

      expect(onAction).not.toHaveBeenCalled();
    });

    it('should update shortcuts when they change', () => {
      const onAction1 = jest.fn();
      const onAction2 = jest.fn();

      const { rerender } = renderHook(
        ({ shortcuts }) => useKeyboardShortcuts({ shortcuts }),
        { initialProps: { shortcuts: [{ key: 's', ctrl: true, action: onAction1 }] } }
      );

      act(() => {
        document.dispatchEvent(createKeyboardEvent('s', { ctrlKey: true }));
      });
      expect(onAction1).toHaveBeenCalledTimes(1);

      // Update shortcuts
      rerender({ shortcuts: [{ key: 's', ctrl: true, action: onAction2 }] });

      act(() => {
        document.dispatchEvent(createKeyboardEvent('s', { ctrlKey: true }));
      });
      expect(onAction2).toHaveBeenCalledTimes(1);
    });
  });
});

describe('createEditorShortcuts', () => {
  it('should create undo shortcut when handler provided', () => {
    const onUndo = jest.fn();
    const shortcuts = createEditorShortcuts({ onUndo });

    expect(shortcuts).toContainEqual(
      expect.objectContaining({
        key: 'z',
        ctrl: true,
        shift: false,
        action: onUndo,
      })
    );
  });

  it('should create redo shortcuts when handler provided', () => {
    const onRedo = jest.fn();
    const shortcuts = createEditorShortcuts({ onRedo });

    // Should have both Ctrl+Shift+Z and Ctrl+Y
    expect(shortcuts).toContainEqual(
      expect.objectContaining({
        key: 'z',
        ctrl: true,
        shift: true,
        action: onRedo,
      })
    );
    expect(shortcuts).toContainEqual(
      expect.objectContaining({
        key: 'y',
        ctrl: true,
        action: onRedo,
      })
    );
  });

  it('should create save shortcut when handler provided', () => {
    const onSave = jest.fn();
    const shortcuts = createEditorShortcuts({ onSave });

    expect(shortcuts).toContainEqual(
      expect.objectContaining({
        key: 's',
        ctrl: true,
        action: onSave,
      })
    );
  });

  it('should only include shortcuts for provided handlers', () => {
    const onSave = jest.fn();
    const shortcuts = createEditorShortcuts({ onSave });

    expect(shortcuts.length).toBe(1);
    expect(shortcuts[0].key).toBe('s');
  });

  it('should return empty array when no handlers provided', () => {
    const shortcuts = createEditorShortcuts({});

    expect(shortcuts).toEqual([]);
  });

  it('should create all shortcuts when all handlers provided', () => {
    const shortcuts = createEditorShortcuts({
      onUndo: jest.fn(),
      onRedo: jest.fn(),
      onSave: jest.fn(),
    });

    // 1 undo + 2 redo + 1 save = 4 shortcuts
    expect(shortcuts.length).toBe(4);
  });
});
