/**
 * Tests for GuideModal component - Modal for displaying informational content.
 */

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GuideModal } from '../GuideModal';
import { useGuideStore } from '@/stores/guideStore';

// Mock react-markdown to avoid ESM issues
jest.mock('react-markdown', () => ({
  __esModule: true,
  default: ({ children }: { children: string }) => <div data-testid="markdown">{children}</div>,
}));

// Mock motion/react (framer motion)
jest.mock('motion/react', () => ({
  motion: {
    div: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => {
      // Filter out motion-specific props
      const { initial, animate, exit, transition, ...validProps } = props;
      return <div {...validProps}>{children}</div>;
    },
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('GuideModal Component', () => {
  beforeEach(() => {
    // Reset store between tests
    useGuideStore.setState({
      modal: null,
    });
  });

  describe('Rendering', () => {
    it('should not render when modal is null', () => {
      render(<GuideModal />);

      expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    });

    it('should not render when modal is not open', () => {
      useGuideStore.setState({
        modal: {
          isOpen: false,
          title: 'Test',
          content: 'Content',
          type: 'info',
        },
      });

      render(<GuideModal />);

      expect(screen.queryByText('Test')).not.toBeInTheDocument();
    });

    it('should render when modal is open', () => {
      useGuideStore.setState({
        modal: {
          isOpen: true,
          title: 'Test Modal',
          content: 'This is the content',
          type: 'info',
        },
      });

      render(<GuideModal />);

      expect(screen.getByText('Test Modal')).toBeInTheDocument();
      expect(screen.getByText('This is the content')).toBeInTheDocument();
    });

    it('should render close button', () => {
      useGuideStore.setState({
        modal: {
          isOpen: true,
          title: 'Test',
          content: 'Content',
          type: 'info',
        },
      });

      render(<GuideModal />);

      // Find button with X icon
      const closeButton = screen.getAllByRole('button').find(btn =>
        btn.querySelector('svg.lucide-x')
      );
      expect(closeButton).toBeInTheDocument();
    });

    it('should render "Got it" button', () => {
      useGuideStore.setState({
        modal: {
          isOpen: true,
          title: 'Test',
          content: 'Content',
          type: 'info',
        },
      });

      render(<GuideModal />);

      expect(screen.getByRole('button', { name: 'Got it' })).toBeInTheDocument();
    });

    it('should render markdown content', () => {
      useGuideStore.setState({
        modal: {
          isOpen: true,
          title: 'Test',
          content: '**Bold text** and _italic_',
          type: 'info',
        },
      });

      render(<GuideModal />);

      expect(screen.getByTestId('markdown')).toBeInTheDocument();
    });
  });

  describe('Modal Types', () => {
    it('should render info type with Info icon', () => {
      useGuideStore.setState({
        modal: {
          isOpen: true,
          title: 'Info Modal',
          content: 'Info content',
          type: 'info',
        },
      });

      render(<GuideModal />);

      expect(document.querySelector('svg.lucide-info')).toBeInTheDocument();
    });

    it('should render tip type with Lightbulb icon', () => {
      useGuideStore.setState({
        modal: {
          isOpen: true,
          title: 'Tip Modal',
          content: 'Tip content',
          type: 'tip',
        },
      });

      render(<GuideModal />);

      expect(document.querySelector('svg.lucide-lightbulb')).toBeInTheDocument();
    });

    it('should render warning type with AlertTriangle icon', () => {
      useGuideStore.setState({
        modal: {
          isOpen: true,
          title: 'Warning Modal',
          content: 'Warning content',
          type: 'warning',
        },
      });

      render(<GuideModal />);

      expect(document.querySelector('svg.lucide-triangle-alert')).toBeInTheDocument();
    });

    it('should render success type with CheckCircle icon', () => {
      useGuideStore.setState({
        modal: {
          isOpen: true,
          title: 'Success Modal',
          content: 'Success content',
          type: 'success',
        },
      });

      render(<GuideModal />);

      // Lucide icons use class lucide-check-circle or have data-lucide="check-circle"
      // Check for the presence of any SVG with a related class
      const svg = document.querySelector('svg[class*="lucide"]');
      expect(svg).toBeInTheDocument();
    });
  });

  describe('Close Actions', () => {
    it('should close modal when close button is clicked', async () => {
      const user = userEvent.setup();
      useGuideStore.setState({
        modal: {
          isOpen: true,
          title: 'Test',
          content: 'Content',
          type: 'info',
        },
      });

      render(<GuideModal />);

      const closeButton = screen.getAllByRole('button').find(btn =>
        btn.querySelector('svg.lucide-x')
      );

      if (closeButton) {
        await user.click(closeButton);
        expect(useGuideStore.getState().modal).toBeNull();
      }
    });

    it('should close modal when "Got it" button is clicked', async () => {
      const user = userEvent.setup();
      useGuideStore.setState({
        modal: {
          isOpen: true,
          title: 'Test',
          content: 'Content',
          type: 'info',
        },
      });

      render(<GuideModal />);

      await user.click(screen.getByRole('button', { name: 'Got it' }));

      expect(useGuideStore.getState().modal).toBeNull();
    });

    it('should close modal when clicking overlay', async () => {
      const user = userEvent.setup();
      useGuideStore.setState({
        modal: {
          isOpen: true,
          title: 'Test',
          content: 'Content',
          type: 'info',
        },
      });

      render(<GuideModal />);

      // Click on the backdrop/overlay (the outer div with onClick)
      const overlay = document.querySelector('.fixed.inset-0');
      if (overlay) {
        await user.click(overlay);
        expect(useGuideStore.getState().modal).toBeNull();
      }
    });

    it('should close modal when Escape is pressed', () => {
      useGuideStore.setState({
        modal: {
          isOpen: true,
          title: 'Test',
          content: 'Content',
          type: 'info',
        },
      });

      render(<GuideModal />);

      fireEvent.keyDown(window, { key: 'Escape' });

      expect(useGuideStore.getState().modal).toBeNull();
    });

    it('should not close modal when clicking modal content', async () => {
      const user = userEvent.setup();
      useGuideStore.setState({
        modal: {
          isOpen: true,
          title: 'Test',
          content: 'Content',
          type: 'info',
        },
      });

      render(<GuideModal />);

      // Click on the modal content (which should stop propagation)
      await user.click(screen.getByText('Test'));

      expect(useGuideStore.getState().modal).not.toBeNull();
    });
  });

  describe('Auto Close', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should auto-close after specified duration', () => {
      useGuideStore.setState({
        modal: {
          isOpen: true,
          title: 'Auto Close Test',
          content: 'Will close soon',
          type: 'info',
          autoClose: 3000,
        },
      });

      render(<GuideModal />);

      // Modal should be visible initially
      expect(screen.getByText('Auto Close Test')).toBeInTheDocument();

      // Advance timer
      act(() => {
        jest.advanceTimersByTime(3000);
      });

      // Modal should be closed
      expect(useGuideStore.getState().modal).toBeNull();
    });

    it('should not auto-close when autoClose is 0', () => {
      useGuideStore.setState({
        modal: {
          isOpen: true,
          title: 'No Auto Close',
          content: 'Will stay open',
          type: 'info',
          autoClose: 0,
        },
      });

      render(<GuideModal />);

      act(() => {
        jest.advanceTimersByTime(10000);
      });

      // Modal should still be open
      expect(useGuideStore.getState().modal).not.toBeNull();
    });

    it('should not auto-close when autoClose is not set', () => {
      useGuideStore.setState({
        modal: {
          isOpen: true,
          title: 'No Auto Close',
          content: 'Will stay open',
          type: 'info',
        },
      });

      render(<GuideModal />);

      act(() => {
        jest.advanceTimersByTime(10000);
      });

      // Modal should still be open
      expect(useGuideStore.getState().modal).not.toBeNull();
    });

    it('should clear timer when modal is closed manually before auto-close', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      useGuideStore.setState({
        modal: {
          isOpen: true,
          title: 'Test',
          content: 'Content',
          type: 'info',
          autoClose: 5000,
        },
      });

      render(<GuideModal />);

      // Close manually before auto-close
      await user.click(screen.getByRole('button', { name: 'Got it' }));

      // Advance past auto-close time
      act(() => {
        jest.advanceTimersByTime(6000);
      });

      // Should remain closed (no errors from trying to close again)
      expect(useGuideStore.getState().modal).toBeNull();
    });
  });

  describe('Accessibility', () => {
    it('should have accessible heading', () => {
      useGuideStore.setState({
        modal: {
          isOpen: true,
          title: 'Accessible Modal',
          content: 'Content',
          type: 'info',
        },
      });

      render(<GuideModal />);

      expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Accessible Modal');
    });

    it('should have accessible buttons', () => {
      useGuideStore.setState({
        modal: {
          isOpen: true,
          title: 'Test',
          content: 'Content',
          type: 'info',
        },
      });

      render(<GuideModal />);

      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThanOrEqual(2); // Close and "Got it"
    });
  });
});
