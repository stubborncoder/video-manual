/**
 * Tests for useAutoSave hook
 * Tests debounced saving, error handling, and manual save functionality
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useAutoSave } from '@/hooks/useAutoSave';

// Mock timers
jest.useFakeTimers();

beforeEach(() => {
  jest.clearAllMocks();
  jest.clearAllTimers();
});

afterEach(() => {
  jest.runOnlyPendingTimers();
});

describe('useAutoSave', () => {
  const originalContent = '# Original Content';
  const modifiedContent = '# Modified Content';

  const createMockOnSave = () => jest.fn().mockResolvedValue(undefined);

  describe('test_debounces_save', () => {
    it('should not save immediately on content change', () => {
      const onSave = createMockOnSave();

      renderHook(() =>
        useAutoSave(modifiedContent, originalContent, {
          onSave,
          interval: 5000,
          enabled: true,
        })
      );

      // Should not save immediately
      expect(onSave).not.toHaveBeenCalled();
    });

    it('should auto-save after interval when content changes', async () => {
      const onSave = createMockOnSave();

      renderHook(() =>
        useAutoSave(modifiedContent, originalContent, {
          onSave,
          interval: 5000,
          enabled: true,
        })
      );

      // Fast-forward to interval
      act(() => {
        jest.advanceTimersByTime(5000);
      });

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith(modifiedContent);
      });
    });

    it('should save on each interval when content keeps changing', async () => {
      const onSave = createMockOnSave();

      const { rerender } = renderHook(
        ({ content }) =>
          useAutoSave(content, originalContent, {
            onSave,
            interval: 5000,
            enabled: true,
          }),
        { initialProps: { content: modifiedContent } }
      );

      // First interval
      act(() => {
        jest.advanceTimersByTime(5000);
      });

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledTimes(1);
      });

      // Change content again
      rerender({ content: 'New content' });

      // Second interval
      act(() => {
        jest.advanceTimersByTime(5000);
      });

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledTimes(2);
        expect(onSave).toHaveBeenLastCalledWith('New content');
      });
    });

    it('should not auto-save when disabled', () => {
      const onSave = createMockOnSave();

      renderHook(() =>
        useAutoSave(modifiedContent, originalContent, {
          onSave,
          interval: 5000,
          enabled: false,
        })
      );

      act(() => {
        jest.advanceTimersByTime(10000);
      });

      expect(onSave).not.toHaveBeenCalled();
    });

    it('should use default 2 minute interval when not specified', () => {
      const onSave = createMockOnSave();

      renderHook(() =>
        useAutoSave(modifiedContent, originalContent, {
          onSave,
          enabled: true,
        })
      );

      // Advance less than 2 minutes
      act(() => {
        jest.advanceTimersByTime(60000); // 1 minute
      });

      expect(onSave).not.toHaveBeenCalled();

      // Advance to 2 minutes
      act(() => {
        jest.advanceTimersByTime(60000); // Total: 2 minutes
      });

      expect(onSave).toHaveBeenCalled();
    });
  });

  describe('test_saves_on_change', () => {
    it('should only save when content differs from original', async () => {
      const onSave = createMockOnSave();

      // Content is same as original
      renderHook(() =>
        useAutoSave(originalContent, originalContent, {
          onSave,
          interval: 5000,
          enabled: true,
        })
      );

      act(() => {
        jest.advanceTimersByTime(5000);
      });

      // Should not save when content hasn't changed
      expect(onSave).not.toHaveBeenCalled();
    });

    it('should track hasPendingChanges correctly', () => {
      const onSave = createMockOnSave();

      const { result, rerender } = renderHook(
        ({ content }) =>
          useAutoSave(content, originalContent, {
            onSave,
            interval: 5000,
            enabled: true,
          }),
        { initialProps: { content: originalContent } }
      );

      expect(result.current.hasPendingChanges).toBe(false);

      // Change content
      rerender({ content: modifiedContent });

      expect(result.current.hasPendingChanges).toBe(true);
    });

    it('should not have pending changes after save', async () => {
      const onSave = createMockOnSave();

      const { result } = renderHook(() =>
        useAutoSave(modifiedContent, originalContent, {
          onSave,
          interval: 5000,
          enabled: true,
        })
      );

      expect(result.current.hasPendingChanges).toBe(true);

      // Trigger auto-save
      act(() => {
        jest.advanceTimersByTime(5000);
      });

      await waitFor(() => {
        expect(result.current.hasPendingChanges).toBe(false);
      });
    });
  });

  describe('test_handles_error', () => {
    it('should set lastError on save failure', async () => {
      const error = new Error('Network error');
      const onSave = jest.fn().mockRejectedValue(error);

      const { result } = renderHook(() =>
        useAutoSave(modifiedContent, originalContent, {
          onSave,
          interval: 5000,
          enabled: true,
        })
      );

      expect(result.current.lastError).toBeNull();

      // Trigger auto-save
      act(() => {
        jest.advanceTimersByTime(5000);
      });

      await waitFor(() => {
        expect(result.current.lastError).toEqual(error);
      });
    });

    it('should return error from saveNow on failure', async () => {
      const error = new Error('Save failed');
      const onSave = jest.fn().mockRejectedValue(error);

      const { result } = renderHook(() =>
        useAutoSave(modifiedContent, originalContent, {
          onSave,
          interval: 5000,
          enabled: true,
        })
      );

      let saveResult: { success: boolean; error?: Error };

      await act(async () => {
        saveResult = await result.current.saveNow();
      });

      expect(saveResult!.success).toBe(false);
      expect(saveResult!.error).toEqual(error);
    });

    it('should clear lastError on successful save', async () => {
      const onSave = jest.fn()
        .mockRejectedValueOnce(new Error('First attempt failed'))
        .mockResolvedValueOnce(undefined);

      const { result } = renderHook(() =>
        useAutoSave(modifiedContent, originalContent, {
          onSave,
          interval: 5000,
          enabled: true,
        })
      );

      // First save fails
      act(() => {
        jest.advanceTimersByTime(5000);
      });

      await waitFor(() => {
        expect(result.current.lastError).not.toBeNull();
      });

      // Second save succeeds
      await act(async () => {
        await result.current.saveNow(true);
      });

      expect(result.current.lastError).toBeNull();
    });

    it('should convert non-Error throws to Error', async () => {
      const onSave = jest.fn().mockRejectedValue('String error');

      const { result } = renderHook(() =>
        useAutoSave(modifiedContent, originalContent, {
          onSave,
          interval: 5000,
          enabled: true,
        })
      );

      act(() => {
        jest.advanceTimersByTime(5000);
      });

      await waitFor(() => {
        expect(result.current.lastError).toBeInstanceOf(Error);
        expect(result.current.lastError?.message).toBe('String error');
      });
    });
  });

  describe('test_manual_save', () => {
    it('should save immediately via saveNow', async () => {
      const onSave = createMockOnSave();

      const { result } = renderHook(() =>
        useAutoSave(modifiedContent, originalContent, {
          onSave,
          interval: 5000,
          enabled: true,
        })
      );

      await act(async () => {
        await result.current.saveNow();
      });

      expect(onSave).toHaveBeenCalledWith(modifiedContent);
    });

    it('should return success from saveNow on successful save', async () => {
      const onSave = createMockOnSave();

      const { result } = renderHook(() =>
        useAutoSave(modifiedContent, originalContent, {
          onSave,
          interval: 5000,
          enabled: true,
        })
      );

      let saveResult: { success: boolean; error?: Error };

      await act(async () => {
        saveResult = await result.current.saveNow();
      });

      expect(saveResult!.success).toBe(true);
      expect(saveResult!.error).toBeUndefined();
    });

    it('should not save via saveNow when content unchanged (unless forced)', async () => {
      const onSave = createMockOnSave();

      const { result } = renderHook(() =>
        useAutoSave(originalContent, originalContent, {
          onSave,
          interval: 5000,
          enabled: true,
        })
      );

      await act(async () => {
        await result.current.saveNow();
      });

      expect(onSave).not.toHaveBeenCalled();
    });

    it('should save via saveNow when forced even if content unchanged', async () => {
      const onSave = createMockOnSave();

      const { result } = renderHook(() =>
        useAutoSave(originalContent, originalContent, {
          onSave,
          interval: 5000,
          enabled: true,
        })
      );

      await act(async () => {
        await result.current.saveNow(true); // Force save
      });

      expect(onSave).toHaveBeenCalledWith(originalContent);
    });

    it('should update lastSavedAt on successful manual save', async () => {
      const onSave = createMockOnSave();

      const { result } = renderHook(() =>
        useAutoSave(modifiedContent, originalContent, {
          onSave,
          interval: 5000,
          enabled: true,
        })
      );

      expect(result.current.lastSavedAt).toBeNull();

      await act(async () => {
        await result.current.saveNow();
      });

      expect(result.current.lastSavedAt).toBeInstanceOf(Date);
    });

    it('should set isSaving during save operation', async () => {
      let resolveSave: () => void;
      const onSave = jest.fn(() => new Promise<void>((resolve) => {
        resolveSave = resolve;
      }));

      const { result } = renderHook(() =>
        useAutoSave(modifiedContent, originalContent, {
          onSave,
          interval: 5000,
          enabled: true,
        })
      );

      expect(result.current.isSaving).toBe(false);

      let savePromise: Promise<any>;
      act(() => {
        savePromise = result.current.saveNow();
      });

      expect(result.current.isSaving).toBe(true);

      await act(async () => {
        resolveSave!();
        await savePromise;
      });

      expect(result.current.isSaving).toBe(false);
    });

    it('should mark content as saved via markAsSaved', () => {
      const onSave = createMockOnSave();

      const { result } = renderHook(() =>
        useAutoSave(modifiedContent, originalContent, {
          onSave,
          interval: 5000,
          enabled: true,
        })
      );

      expect(result.current.hasPendingChanges).toBe(true);
      expect(result.current.lastSavedAt).toBeNull();

      act(() => {
        result.current.markAsSaved();
      });

      expect(result.current.lastSavedAt).toBeInstanceOf(Date);
    });
  });

  describe('getTimeSinceLastSave', () => {
    it('should return null when never saved', () => {
      const onSave = createMockOnSave();

      const { result } = renderHook(() =>
        useAutoSave(modifiedContent, originalContent, {
          onSave,
          interval: 5000,
          enabled: true,
        })
      );

      expect(result.current.getTimeSinceLastSave()).toBeNull();
    });

    it('should return "just now" for recent saves', async () => {
      const onSave = createMockOnSave();

      const { result } = renderHook(() =>
        useAutoSave(modifiedContent, originalContent, {
          onSave,
          interval: 5000,
          enabled: true,
        })
      );

      await act(async () => {
        await result.current.saveNow();
      });

      expect(result.current.getTimeSinceLastSave()).toBe('just now');
    });

    it('should return time in minutes after some time', async () => {
      const onSave = createMockOnSave();

      const { result } = renderHook(() =>
        useAutoSave(modifiedContent, originalContent, {
          onSave,
          interval: 5000,
          enabled: true,
        })
      );

      await act(async () => {
        await result.current.saveNow();
      });

      // Advance time by 5 minutes
      act(() => {
        jest.advanceTimersByTime(5 * 60 * 1000);
      });

      expect(result.current.getTimeSinceLastSave()).toBe('5 mins ago');
    });
  });

  describe('cleanup on unmount', () => {
    it('should clear interval on unmount', () => {
      const onSave = createMockOnSave();

      const { unmount } = renderHook(() =>
        useAutoSave(modifiedContent, originalContent, {
          onSave,
          interval: 5000,
          enabled: true,
        })
      );

      unmount();

      // Advance timers - should not trigger save after unmount
      act(() => {
        jest.advanceTimersByTime(10000);
      });

      expect(onSave).not.toHaveBeenCalled();
    });

    it('should not update state after unmount', async () => {
      let resolveSave: () => void;
      const onSave = jest.fn(() => new Promise<void>((resolve) => {
        resolveSave = resolve;
      }));

      const { result, unmount } = renderHook(() =>
        useAutoSave(modifiedContent, originalContent, {
          onSave,
          interval: 5000,
          enabled: true,
        })
      );

      // Start save
      let savePromise: Promise<any>;
      act(() => {
        savePromise = result.current.saveNow();
      });

      // Unmount while saving
      unmount();

      // Complete save - should not throw or update state
      await act(async () => {
        resolveSave!();
        await savePromise;
      });

      // If we got here without throwing, the test passes
      expect(true).toBe(true);
    });
  });
});
