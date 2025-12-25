/**
 * Tests for utils.ts - Utility functions for the application.
 */

import { cn, getInitials } from '@/lib/utils';

describe('utils', () => {
  describe('test_cn_merges_classes', () => {
    it('should merge simple class names', () => {
      const result = cn('class1', 'class2');
      expect(result).toBe('class1 class2');
    });

    it('should handle undefined and null values', () => {
      const result = cn('class1', undefined, null, 'class2');
      expect(result).toBe('class1 class2');
    });

    it('should handle conditional classes with clsx syntax', () => {
      const isActive = true;
      const isDisabled = false;

      const result = cn('base', isActive && 'active', isDisabled && 'disabled');
      expect(result).toBe('base active');
    });

    it('should handle object syntax for conditional classes', () => {
      const result = cn('base', {
        active: true,
        disabled: false,
        highlighted: true,
      });
      expect(result).toBe('base active highlighted');
    });

    it('should handle array syntax', () => {
      const result = cn(['class1', 'class2'], 'class3');
      expect(result).toBe('class1 class2 class3');
    });

    it('should merge Tailwind classes correctly', () => {
      // tailwind-merge should handle conflicting classes
      const result = cn('px-2', 'px-4');
      expect(result).toBe('px-4');
    });

    it('should handle conflicting Tailwind margin classes', () => {
      const result = cn('m-2', 'm-4');
      expect(result).toBe('m-4');
    });

    it('should preserve non-conflicting Tailwind classes', () => {
      const result = cn('px-2', 'py-4', 'text-lg', 'font-bold');
      expect(result).toBe('px-2 py-4 text-lg font-bold');
    });

    it('should handle complex Tailwind class conflicts', () => {
      const result = cn(
        'text-red-500',
        'text-blue-500',
        'bg-white',
        'bg-gray-100'
      );
      expect(result).toBe('text-blue-500 bg-gray-100');
    });

    it('should handle empty strings', () => {
      const result = cn('', 'class1', '', 'class2', '');
      expect(result).toBe('class1 class2');
    });

    it('should return empty string when no classes provided', () => {
      const result = cn();
      expect(result).toBe('');
    });

    it('should handle false and 0 values', () => {
      const result = cn('base', false, 0, 'valid');
      expect(result).toBe('base valid');
    });

    it('should merge responsive variants correctly', () => {
      const result = cn('md:px-2', 'md:px-4');
      expect(result).toBe('md:px-4');
    });

    it('should preserve different responsive variants', () => {
      const result = cn('sm:px-2', 'md:px-4', 'lg:px-6');
      expect(result).toBe('sm:px-2 md:px-4 lg:px-6');
    });

    it('should handle hover states', () => {
      const result = cn('hover:bg-gray-100', 'hover:bg-gray-200');
      expect(result).toBe('hover:bg-gray-200');
    });
  });

  describe('getInitials', () => {
    it('should return initials from full name', () => {
      expect(getInitials('John Doe')).toBe('JD');
    });

    it('should return single initial for single name', () => {
      expect(getInitials('John')).toBe('J');
    });

    it('should handle three or more names', () => {
      expect(getInitials('John Michael Doe')).toBe('JM');
    });

    it('should return fallback for null', () => {
      expect(getInitials(null)).toBe('U');
    });

    it('should return fallback for undefined', () => {
      expect(getInitials(undefined)).toBe('U');
    });

    it('should return fallback for empty string', () => {
      expect(getInitials('')).toBe('U');
    });

    it('should use custom fallback', () => {
      expect(getInitials(null, '?')).toBe('?');
      expect(getInitials('', 'X')).toBe('X');
    });

    it('should return uppercase initials', () => {
      expect(getInitials('john doe')).toBe('JD');
    });

    it('should handle extra spaces', () => {
      expect(getInitials('  John   Doe  ')).toBe('JD');
    });

    it('should return max 2 initials', () => {
      expect(getInitials('Alice Bob Charlie Dave')).toBe('AB');
    });

    it('should handle email-like strings', () => {
      expect(getInitials('john.doe@example.com')).toBe('J');
    });
  });

  describe('test_formatBytes', () => {
    // Note: formatBytes is not in the current utils.ts
    // This test serves as documentation for expected behavior
    // if such a function is added in the future

    it.skip('should format bytes to human readable string', () => {
      // Placeholder for formatBytes tests
      // Example expected behavior:
      // formatBytes(0) -> '0 Bytes'
      // formatBytes(1024) -> '1 KB'
      // formatBytes(1048576) -> '1 MB'
      // formatBytes(1073741824) -> '1 GB'
    });
  });

  describe('test_formatDuration', () => {
    // Note: formatDuration is not in the current utils.ts
    // This test serves as documentation for expected behavior
    // if such a function is added in the future

    it.skip('should format duration in seconds to readable string', () => {
      // Placeholder for formatDuration tests
      // Example expected behavior:
      // formatDuration(30) -> '0:30'
      // formatDuration(90) -> '1:30'
      // formatDuration(3600) -> '1:00:00'
    });
  });
});
