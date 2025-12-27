/**
 * Tests for WorkflowOverlay component - Step-by-step guided workflow overlay.
 */

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WorkflowOverlay } from '../WorkflowOverlay';
import type { WorkflowStep, WorkflowState } from '@/stores/guideStore';

// Mock react-markdown to avoid ESM issues
jest.mock('react-markdown', () => ({
  __esModule: true,
  default: ({ children }: { children: string }) => <div data-testid="markdown">{children}</div>,
}));

// Mock motion/react (framer motion)
jest.mock('motion/react', () => ({
  motion: {
    div: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => {
      const { initial, animate, exit, transition, ...validProps } = props;
      return <div {...validProps}>{children}</div>;
    },
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock next/navigation
const mockRouterPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockRouterPush,
  }),
}));

// Mock sidebar context
jest.mock('@/components/layout/SidebarContext', () => ({
  useSidebar: () => ({ collapsed: false }),
}));

// Mock the guide store to prevent infinite loops
const mockNextWorkflowStep = jest.fn();
const mockPreviousWorkflowStep = jest.fn();
const mockCancelWorkflow = jest.fn();
const mockShowHighlight = jest.fn();
const mockClearAllHighlights = jest.fn();

let mockWorkflow: WorkflowState | null = null;

jest.mock('@/stores/guideStore', () => ({
  useGuideStore: () => ({
    workflow: mockWorkflow,
    nextWorkflowStep: mockNextWorkflowStep,
    previousWorkflowStep: mockPreviousWorkflowStep,
    cancelWorkflow: mockCancelWorkflow,
    showHighlight: mockShowHighlight,
    clearAllHighlights: mockClearAllHighlights,
  }),
}));

const testSteps: WorkflowStep[] = [
  {
    title: 'Step 1',
    description: 'First step description',
    highlight: 'element-1',
  },
  {
    title: 'Step 2',
    description: 'Second step description',
    navigate: '/dashboard/videos',
  },
  {
    title: 'Step 3',
    description: 'Third step description with **markdown**',
    highlight: 'element-2',
    navigate: '/dashboard/manuals',
  },
];

describe('WorkflowOverlay Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWorkflow = null;
  });

  describe('Rendering', () => {
    it('should not render when workflow is null', () => {
      mockWorkflow = null;
      render(<WorkflowOverlay />);

      expect(screen.queryByText('Step 1')).not.toBeInTheDocument();
    });

    it('should not render when workflow is not active', () => {
      mockWorkflow = {
        isActive: false,
        title: 'Test Workflow',
        steps: testSteps,
        currentStepIndex: 0,
      };

      render(<WorkflowOverlay />);

      expect(screen.queryByText('Test Workflow')).not.toBeInTheDocument();
    });

    it('should render when workflow is active', () => {
      mockWorkflow = {
        isActive: true,
        title: 'Test Workflow',
        steps: testSteps,
        currentStepIndex: 0,
      };

      render(<WorkflowOverlay />);

      expect(screen.getByText('Test Workflow')).toBeInTheDocument();
      expect(screen.getByText('Step 1')).toBeInTheDocument();
    });

    it('should render workflow title', () => {
      mockWorkflow = {
        isActive: true,
        title: 'My Custom Workflow',
        steps: testSteps,
        currentStepIndex: 0,
      };

      render(<WorkflowOverlay />);

      expect(screen.getByText('My Custom Workflow')).toBeInTheDocument();
    });

    it('should render current step title', () => {
      mockWorkflow = {
        isActive: true,
        title: 'Test',
        steps: testSteps,
        currentStepIndex: 1,
      };

      render(<WorkflowOverlay />);

      expect(screen.getByRole('heading', { name: 'Step 2' })).toBeInTheDocument();
    });

    it('should render current step description with markdown', () => {
      mockWorkflow = {
        isActive: true,
        title: 'Test',
        steps: testSteps,
        currentStepIndex: 0,
      };

      render(<WorkflowOverlay />);

      expect(screen.getByTestId('markdown')).toHaveTextContent('First step description');
    });
  });

  describe('Progress Display', () => {
    it('should display step count', () => {
      mockWorkflow = {
        isActive: true,
        title: 'Test',
        steps: testSteps,
        currentStepIndex: 0,
      };

      render(<WorkflowOverlay />);

      expect(screen.getByText('Step 1 of 3')).toBeInTheDocument();
    });

    it('should update step count when step changes', () => {
      mockWorkflow = {
        isActive: true,
        title: 'Test',
        steps: testSteps,
        currentStepIndex: 1,
      };

      render(<WorkflowOverlay />);

      expect(screen.getByText('Step 2 of 3')).toBeInTheDocument();
    });

    it('should display progress percentage', () => {
      mockWorkflow = {
        isActive: true,
        title: 'Test',
        steps: testSteps,
        currentStepIndex: 0,
      };

      render(<WorkflowOverlay />);

      // First step is 33% (1/3 * 100)
      expect(screen.getByText('33%')).toBeInTheDocument();
    });

    it('should show 100% on last step', () => {
      mockWorkflow = {
        isActive: true,
        title: 'Test',
        steps: testSteps,
        currentStepIndex: 2,
      };

      render(<WorkflowOverlay />);

      expect(screen.getByText('100%')).toBeInTheDocument();
    });
  });

  describe('Navigation Controls', () => {
    it('should render Back and Next buttons', () => {
      mockWorkflow = {
        isActive: true,
        title: 'Test',
        steps: testSteps,
        currentStepIndex: 1,
      };

      render(<WorkflowOverlay />);

      expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument();
    });

    it('should disable Back button on first step', () => {
      mockWorkflow = {
        isActive: true,
        title: 'Test',
        steps: testSteps,
        currentStepIndex: 0,
      };

      render(<WorkflowOverlay />);

      expect(screen.getByRole('button', { name: /back/i })).toBeDisabled();
    });

    it('should enable Back button on subsequent steps', () => {
      mockWorkflow = {
        isActive: true,
        title: 'Test',
        steps: testSteps,
        currentStepIndex: 1,
      };

      render(<WorkflowOverlay />);

      expect(screen.getByRole('button', { name: /back/i })).not.toBeDisabled();
    });

    it('should show "Finish" instead of "Next" on last step', () => {
      mockWorkflow = {
        isActive: true,
        title: 'Test',
        steps: testSteps,
        currentStepIndex: 2,
      };

      render(<WorkflowOverlay />);

      expect(screen.queryByRole('button', { name: /next/i })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /finish/i })).toBeInTheDocument();
    });

    it('should call nextWorkflowStep when Next is clicked', async () => {
      const user = userEvent.setup();
      mockWorkflow = {
        isActive: true,
        title: 'Test',
        steps: testSteps,
        currentStepIndex: 0,
      };

      render(<WorkflowOverlay />);

      await user.click(screen.getByRole('button', { name: /next/i }));

      expect(mockNextWorkflowStep).toHaveBeenCalled();
    });

    it('should call previousWorkflowStep when Back is clicked', async () => {
      const user = userEvent.setup();
      mockWorkflow = {
        isActive: true,
        title: 'Test',
        steps: testSteps,
        currentStepIndex: 2,
      };

      render(<WorkflowOverlay />);

      await user.click(screen.getByRole('button', { name: /back/i }));

      expect(mockPreviousWorkflowStep).toHaveBeenCalled();
    });

    it('should call nextWorkflowStep when Finish is clicked', async () => {
      const user = userEvent.setup();
      mockWorkflow = {
        isActive: true,
        title: 'Test',
        steps: testSteps,
        currentStepIndex: 2,
      };

      render(<WorkflowOverlay />);

      await user.click(screen.getByRole('button', { name: /finish/i }));

      expect(mockNextWorkflowStep).toHaveBeenCalled();
    });
  });

  describe('Cancel Workflow', () => {
    it('should render close button', () => {
      mockWorkflow = {
        isActive: true,
        title: 'Test',
        steps: testSteps,
        currentStepIndex: 0,
      };

      render(<WorkflowOverlay />);

      const closeButton = screen.getAllByRole('button').find(btn =>
        btn.querySelector('svg.lucide-x')
      );
      expect(closeButton).toBeInTheDocument();
    });

    it('should call cancelWorkflow when close button is clicked', async () => {
      const user = userEvent.setup();
      mockWorkflow = {
        isActive: true,
        title: 'Test',
        steps: testSteps,
        currentStepIndex: 0,
      };

      render(<WorkflowOverlay />);

      const closeButton = screen.getAllByRole('button').find(btn =>
        btn.querySelector('svg.lucide-x')
      );

      if (closeButton) {
        await user.click(closeButton);
        expect(mockCancelWorkflow).toHaveBeenCalled();
      }
    });

    it('should call cancelWorkflow when Escape is pressed', () => {
      mockWorkflow = {
        isActive: true,
        title: 'Test',
        steps: testSteps,
        currentStepIndex: 1,
      };

      render(<WorkflowOverlay />);

      fireEvent.keyDown(window, { key: 'Escape' });

      expect(mockCancelWorkflow).toHaveBeenCalled();
    });
  });

  describe('Step Actions', () => {
    it('should navigate when step has navigate property', async () => {
      mockWorkflow = {
        isActive: true,
        title: 'Test',
        steps: testSteps,
        currentStepIndex: 1, // Step 2 has navigate
      };

      render(<WorkflowOverlay />);

      // Wait for effect to run
      await waitFor(() => {
        expect(mockRouterPush).toHaveBeenCalledWith('/dashboard/videos');
      });
    });

    it('should call showHighlight when step has highlight property', async () => {
      mockWorkflow = {
        isActive: true,
        title: 'Test',
        steps: testSteps,
        currentStepIndex: 0, // Step 1 has highlight
      };

      render(<WorkflowOverlay />);

      // Wait for effect to run (highlight has timeout)
      await waitFor(() => {
        expect(mockShowHighlight).toHaveBeenCalledWith('element-1', 0);
      }, { timeout: 200 });
    });

    it('should call clearAllHighlights on step change', async () => {
      mockWorkflow = {
        isActive: true,
        title: 'Test',
        steps: testSteps,
        currentStepIndex: 0,
      };

      render(<WorkflowOverlay />);

      await waitFor(() => {
        expect(mockClearAllHighlights).toHaveBeenCalled();
      });
    });
  });

  describe('Sidebar Positioning', () => {
    it('should have correct class when sidebar is not collapsed', () => {
      mockWorkflow = {
        isActive: true,
        title: 'Test',
        steps: testSteps,
        currentStepIndex: 0,
      };

      render(<WorkflowOverlay />);

      const overlay = document.querySelector('.fixed.bottom-32');
      expect(overlay).toHaveClass('left-72');
    });
  });

  describe('Multiple Steps Workflow', () => {
    it('should handle single step workflow', () => {
      const singleStep: WorkflowStep[] = [
        {
          title: 'Only Step',
          description: 'This is the only step',
        },
      ];

      mockWorkflow = {
        isActive: true,
        title: 'Single Step',
        steps: singleStep,
        currentStepIndex: 0,
      };

      render(<WorkflowOverlay />);

      expect(screen.getByText('Step 1 of 1')).toBeInTheDocument();
      expect(screen.getByText('100%')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /finish/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /back/i })).toBeDisabled();
    });

    // Note: Empty steps array is not a valid workflow state - the component
    // requires at least one step. This is validated at the API level.
  });
});
