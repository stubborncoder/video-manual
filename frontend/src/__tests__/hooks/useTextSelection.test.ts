/**
 * Tests for useTextSelection hook
 * Tests text selection detection, clearing, and range calculation
 */

import { renderHook, act } from '@testing-library/react';
import { useTextSelection } from '@/hooks/useTextSelection';
import React from 'react';

// Mock window.getSelection
const createMockSelection = (options: {
  text?: string;
  isCollapsed?: boolean;
  rangeStartContainer?: Node;
  rangeEndContainer?: Node;
  rangeStartOffset?: number;
  rangeEndOffset?: number;
  commonAncestorContainer?: Node;
} = {}) => {
  const mockRange = {
    startContainer: options.rangeStartContainer || document.createTextNode(''),
    endContainer: options.rangeEndContainer || document.createTextNode(''),
    startOffset: options.rangeStartOffset || 0,
    endOffset: options.rangeEndOffset || 0,
    commonAncestorContainer: options.commonAncestorContainer || document.body,
    getClientRects: jest.fn(() => [
      { top: 100, left: 50, width: 200, height: 20 },
    ] as unknown as DOMRectList),
  };

  return {
    toString: jest.fn(() => options.text || ''),
    isCollapsed: options.isCollapsed ?? true,
    getRangeAt: jest.fn(() => mockRange),
    removeAllRanges: jest.fn(),
    rangeCount: 1,
    _mockRange: mockRange,
  };
};

let mockSelection = createMockSelection();

const originalGetSelection = window.getSelection;

beforeAll(() => {
  window.getSelection = jest.fn(() => mockSelection as unknown as Selection);
});

afterAll(() => {
  window.getSelection = originalGetSelection;
});

beforeEach(() => {
  jest.clearAllMocks();
  mockSelection = createMockSelection();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

// Helper to create a mock container element
const createMockContainer = () => {
  const container = document.createElement('div');
  container.textContent = 'This is some test content for selection testing.';
  document.body.appendChild(container);
  return container;
};

// Helper to clean up container
const cleanupContainer = (container: HTMLElement) => {
  if (container.parentNode) {
    container.parentNode.removeChild(container);
  }
};

describe('useTextSelection', () => {
  let container: HTMLElement;
  let containerRef: React.RefObject<HTMLElement>;

  beforeEach(() => {
    container = createMockContainer();
    containerRef = { current: container };
  });

  afterEach(() => {
    cleanupContainer(container);
  });

  describe('test_detects_selection', () => {
    it('should start with no selection', () => {
      const { result } = renderHook(() =>
        useTextSelection({ containerRef })
      );

      expect(result.current.selection).toBeNull();
      expect(result.current.hasSelection).toBe(false);
    });

    it('should detect text selection on mouseup', () => {
      const textNode = container.firstChild!;
      mockSelection = createMockSelection({
        text: 'test content',
        isCollapsed: false,
        rangeStartContainer: textNode,
        rangeEndContainer: textNode,
        rangeStartOffset: 13,
        rangeEndOffset: 25,
        commonAncestorContainer: container,
      });

      const { result } = renderHook(() =>
        useTextSelection({ containerRef })
      );

      // Simulate mouseup
      act(() => {
        document.dispatchEvent(new MouseEvent('mouseup'));
        jest.advanceTimersByTime(20); // Wait for setTimeout in hook
      });

      expect(result.current.selection).not.toBeNull();
      expect(result.current.selection?.text).toBe('test content');
      expect(result.current.hasSelection).toBe(true);
    });

    it('should detect text selection on shift+keyup', () => {
      const textNode = container.firstChild!;
      mockSelection = createMockSelection({
        text: 'selected',
        isCollapsed: false,
        rangeStartContainer: textNode,
        rangeEndContainer: textNode,
        rangeStartOffset: 0,
        rangeEndOffset: 8,
        commonAncestorContainer: container,
      });

      const { result } = renderHook(() =>
        useTextSelection({ containerRef })
      );

      // Simulate shift+arrow key selection
      act(() => {
        const event = new KeyboardEvent('keyup', { shiftKey: true });
        document.dispatchEvent(event);
        jest.advanceTimersByTime(20);
      });

      expect(result.current.selection).not.toBeNull();
      expect(result.current.selection?.text).toBe('selected');
    });

    it('should not detect selection when disabled', () => {
      const textNode = container.firstChild!;
      mockSelection = createMockSelection({
        text: 'test',
        isCollapsed: false,
        rangeStartContainer: textNode,
        rangeEndContainer: textNode,
        commonAncestorContainer: container,
      });

      const { result } = renderHook(() =>
        useTextSelection({ containerRef, enabled: false })
      );

      act(() => {
        document.dispatchEvent(new MouseEvent('mouseup'));
        jest.advanceTimersByTime(20);
      });

      expect(result.current.selection).toBeNull();
    });

    it('should ignore selection shorter than minLength', () => {
      const textNode = container.firstChild!;
      mockSelection = createMockSelection({
        text: 'ab', // Only 2 characters
        isCollapsed: false,
        rangeStartContainer: textNode,
        rangeEndContainer: textNode,
        commonAncestorContainer: container,
      });

      const { result } = renderHook(() =>
        useTextSelection({ containerRef, minLength: 3 })
      );

      act(() => {
        document.dispatchEvent(new MouseEvent('mouseup'));
        jest.advanceTimersByTime(20);
      });

      expect(result.current.selection).toBeNull();
    });

    it('should ignore collapsed selection', () => {
      mockSelection = createMockSelection({
        text: '',
        isCollapsed: true,
        commonAncestorContainer: container,
      });

      const { result } = renderHook(() =>
        useTextSelection({ containerRef })
      );

      act(() => {
        document.dispatchEvent(new MouseEvent('mouseup'));
        jest.advanceTimersByTime(20);
      });

      expect(result.current.selection).toBeNull();
    });

    it('should ignore selection outside container', () => {
      const outsideContainer = document.createElement('div');
      document.body.appendChild(outsideContainer);

      mockSelection = createMockSelection({
        text: 'outside selection',
        isCollapsed: false,
        commonAncestorContainer: outsideContainer, // Not in our container
      });

      const { result } = renderHook(() =>
        useTextSelection({ containerRef })
      );

      act(() => {
        document.dispatchEvent(new MouseEvent('mouseup'));
        jest.advanceTimersByTime(20);
      });

      expect(result.current.selection).toBeNull();

      document.body.removeChild(outsideContainer);
    });
  });

  describe('test_clears_selection', () => {
    it('should clear selection via clearSelection', () => {
      const textNode = container.firstChild!;
      mockSelection = createMockSelection({
        text: 'test content',
        isCollapsed: false,
        rangeStartContainer: textNode,
        rangeEndContainer: textNode,
        commonAncestorContainer: container,
      });

      const { result } = renderHook(() =>
        useTextSelection({ containerRef })
      );

      // First create a selection
      act(() => {
        document.dispatchEvent(new MouseEvent('mouseup'));
        jest.advanceTimersByTime(20);
      });

      expect(result.current.selection).not.toBeNull();

      // Clear it
      act(() => {
        result.current.clearSelection();
      });

      expect(result.current.selection).toBeNull();
      expect(result.current.hasSelection).toBe(false);
      expect(mockSelection.removeAllRanges).toHaveBeenCalled();
    });

    it('should clear browser selection when clearSelection is called', () => {
      const { result } = renderHook(() =>
        useTextSelection({ containerRef })
      );

      act(() => {
        result.current.clearSelection();
      });

      expect(mockSelection.removeAllRanges).toHaveBeenCalled();
    });
  });

  describe('test_returns_selection_range', () => {
    it('should return selection with start and end offsets', () => {
      const textNode = container.firstChild!;
      mockSelection = createMockSelection({
        text: 'test',
        isCollapsed: false,
        rangeStartContainer: textNode,
        rangeEndContainer: textNode,
        rangeStartOffset: 10,
        rangeEndOffset: 14,
        commonAncestorContainer: container,
      });

      const { result } = renderHook(() =>
        useTextSelection({ containerRef })
      );

      act(() => {
        document.dispatchEvent(new MouseEvent('mouseup'));
        jest.advanceTimersByTime(20);
      });

      expect(result.current.selection).not.toBeNull();
      expect(result.current.selection?.startOffset).toBeDefined();
      expect(result.current.selection?.endOffset).toBeDefined();
    });

    it('should include context around selection', () => {
      const textNode = container.firstChild!;
      mockSelection = createMockSelection({
        text: 'test',
        isCollapsed: false,
        rangeStartContainer: textNode,
        rangeEndContainer: textNode,
        rangeStartOffset: 10,
        rangeEndOffset: 14,
        commonAncestorContainer: container,
      });

      const { result } = renderHook(() =>
        useTextSelection({ containerRef, maxContextLength: 50 })
      );

      act(() => {
        document.dispatchEvent(new MouseEvent('mouseup'));
        jest.advanceTimersByTime(20);
      });

      expect(result.current.selection?.context).toBeDefined();
      expect(result.current.selection?.context.length).toBeGreaterThan(0);
    });

    it('should calculate highlight rectangles', () => {
      const textNode = container.firstChild!;
      mockSelection = createMockSelection({
        text: 'test content',
        isCollapsed: false,
        rangeStartContainer: textNode,
        rangeEndContainer: textNode,
        rangeStartOffset: 0,
        rangeEndOffset: 12,
        commonAncestorContainer: container,
      });

      // Mock container's getBoundingClientRect
      container.getBoundingClientRect = jest.fn(() => ({
        top: 50,
        left: 20,
        width: 500,
        height: 100,
        right: 520,
        bottom: 150,
        x: 20,
        y: 50,
        toJSON: () => {},
      }));

      const { result } = renderHook(() =>
        useTextSelection({ containerRef })
      );

      act(() => {
        document.dispatchEvent(new MouseEvent('mouseup'));
        jest.advanceTimersByTime(20);
      });

      expect(result.current.selection?.highlightRects).toBeDefined();
      expect(result.current.selection?.highlightRects.length).toBeGreaterThan(0);
      // Rects should be relative to container
      expect(result.current.selection?.highlightRects[0].top).toBeDefined();
      expect(result.current.selection?.highlightRects[0].left).toBeDefined();
      expect(result.current.selection?.highlightRects[0].width).toBeDefined();
      expect(result.current.selection?.highlightRects[0].height).toBeDefined();
    });

    it('should not update selection if same text is selected again', () => {
      const textNode = container.firstChild!;
      mockSelection = createMockSelection({
        text: 'same text',
        isCollapsed: false,
        rangeStartContainer: textNode,
        rangeEndContainer: textNode,
        commonAncestorContainer: container,
      });

      const { result } = renderHook(() =>
        useTextSelection({ containerRef })
      );

      // First selection
      act(() => {
        document.dispatchEvent(new MouseEvent('mouseup'));
        jest.advanceTimersByTime(20);
      });

      const firstSelection = result.current.selection;

      // Same selection again
      act(() => {
        document.dispatchEvent(new MouseEvent('mouseup'));
        jest.advanceTimersByTime(20);
      });

      // Should be the same reference (no update)
      expect(result.current.selection).toBe(firstSelection);
    });
  });

  describe('cleanup', () => {
    it('should remove event listeners on unmount', () => {
      const removeEventListenerSpy = jest.spyOn(document, 'removeEventListener');

      const { unmount } = renderHook(() =>
        useTextSelection({ containerRef })
      );

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('mouseup', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('keyup', expect.any(Function));

      removeEventListenerSpy.mockRestore();
    });

    it('should not add listeners when disabled', () => {
      const addEventListenerSpy = jest.spyOn(document, 'addEventListener');

      renderHook(() =>
        useTextSelection({ containerRef, enabled: false })
      );

      expect(addEventListenerSpy).not.toHaveBeenCalledWith('mouseup', expect.any(Function));
      expect(addEventListenerSpy).not.toHaveBeenCalledWith('keyup', expect.any(Function));

      addEventListenerSpy.mockRestore();
    });
  });

  describe('edge cases', () => {
    it('should handle null container ref', () => {
      const nullRef = { current: null };

      const { result } = renderHook(() =>
        useTextSelection({ containerRef: nullRef as any })
      );

      act(() => {
        document.dispatchEvent(new MouseEvent('mouseup'));
        jest.advanceTimersByTime(20);
      });

      expect(result.current.selection).toBeNull();
    });

    it('should handle null getSelection', () => {
      window.getSelection = jest.fn(() => null);

      const { result } = renderHook(() =>
        useTextSelection({ containerRef })
      );

      act(() => {
        document.dispatchEvent(new MouseEvent('mouseup'));
        jest.advanceTimersByTime(20);
      });

      expect(result.current.selection).toBeNull();

      // Restore mock
      window.getSelection = jest.fn(() => mockSelection as unknown as Selection);
    });

    it('should handle keyup without shift key', () => {
      const textNode = container.firstChild!;
      mockSelection = createMockSelection({
        text: 'test',
        isCollapsed: false,
        rangeStartContainer: textNode,
        rangeEndContainer: textNode,
        commonAncestorContainer: container,
      });

      const { result } = renderHook(() =>
        useTextSelection({ containerRef })
      );

      // Keyup without shift - should not trigger selection check
      act(() => {
        const event = new KeyboardEvent('keyup', { shiftKey: false });
        document.dispatchEvent(event);
        jest.advanceTimersByTime(20);
      });

      expect(result.current.selection).toBeNull();
    });
  });
});
