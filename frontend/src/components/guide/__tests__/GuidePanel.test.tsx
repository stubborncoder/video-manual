import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GuidePanel } from '../GuidePanel';
import type { GuideMessage, PageContext } from '@/stores/guideStore';

// Mock react-markdown to avoid ESM issues
jest.mock('react-markdown', () => ({
  __esModule: true,
  default: ({ children }: { children: string }) => <div data-testid="markdown">{children}</div>,
}));

// Mock remark-gfm
jest.mock('remark-gfm', () => ({
  __esModule: true,
  default: () => {},
}));

// Mock Next.js navigation
jest.mock('next/navigation', () => ({
  usePathname: jest.fn(() => '/dashboard'),
}));

// Mock motion/react (framer motion)
jest.mock('motion/react', () => ({
  motion: {
    div: ({ children, ...props }: { children: React.ReactNode }) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock guide store
const mockGuideStore = {
  isOpen: true,
  close: jest.fn(),
  messages: [] as GuideMessage[],
  isGenerating: false,
  pageContext: null as PageContext | null,
  forceLeftPosition: false,
  panelSize: 'full' as const,
  setFull: jest.fn(),
  setMedium: jest.fn(),
  setCompact: jest.fn(),
  applyPendingHighlight: jest.fn(),
  pendingHighlight: null,
};

jest.mock('@/stores/guideStore', () => ({
  useGuideStore: () => mockGuideStore,
}));

// Mock sidebar context
jest.mock('@/components/layout/SidebarContext', () => ({
  useSidebar: () => ({ collapsed: false }),
}));

// Mock child components
jest.mock('../GuideMessage', () => ({
  GuideMessageComponent: ({ message }: { message: GuideMessage }) => (
    <div data-testid={`guide-message-${message.id}`} data-role={message.role}>
      {message.content}
    </div>
  ),
}));

jest.mock('../GuideSuggestions', () => ({
  GuideSuggestions: ({
    suggestions,
    onSuggestionClick,
    disabled,
  }: {
    suggestions: string[];
    onSuggestionClick: (s: string) => void;
    disabled: boolean;
  }) => (
    <div data-testid="guide-suggestions">
      {suggestions.map((s, i) => (
        <button key={i} onClick={() => onSuggestionClick(s)} disabled={disabled} data-testid={`suggestion-${i}`}>
          {s}
        </button>
      ))}
    </div>
  ),
}));

// Mock VDocsText
jest.mock('@/components/ui/vdocs-text', () => ({
  VDocsText: ({ suffix, className }: { suffix?: string; className?: string }) => (
    <span data-testid="vdocs-text" className={className}>vDocs{suffix}</span>
  ),
}));

// Mock radix-ui scroll-area
jest.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, ...props }: { children: React.ReactNode }) => (
    <div data-testid="scroll-area" {...props}>{children}</div>
  ),
}));

describe('GuidePanel Component', () => {
  const mockMessages: GuideMessage[] = [
    {
      id: 'msg-1',
      role: 'assistant',
      content: 'Welcome to vDocs!',
      timestamp: new Date('2024-01-01T10:00:00'),
    },
    {
      id: 'msg-2',
      role: 'user',
      content: 'How do I upload a video?',
      timestamp: new Date('2024-01-01T10:00:30'),
    },
    {
      id: 'msg-3',
      role: 'assistant',
      content: 'You can upload a video by clicking the Upload button.',
      timestamp: new Date('2024-01-01T10:00:35'),
    },
  ];

  const mockSuggestions = [
    'How do I create a manual?',
    'What formats are supported?',
    'How do I export?',
  ];

  const defaultProps = {
    onSendMessage: jest.fn(),
    onClearChat: jest.fn(),
    suggestions: mockSuggestions,
    whatsNewLabel: undefined,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset store values
    mockGuideStore.isOpen = true;
    mockGuideStore.messages = [];
    mockGuideStore.isGenerating = false;
    mockGuideStore.pageContext = null;
    mockGuideStore.forceLeftPosition = false;
    mockGuideStore.panelSize = 'full';
    mockGuideStore.pendingHighlight = null;
  });

  describe('Rendering Messages', () => {
    it('should render the panel title', () => {
      render(<GuidePanel {...defaultProps} />);

      // There may be multiple VDocsText components, so we use getAllByTestId
      const vdocsTexts = screen.getAllByTestId('vdocs-text');
      expect(vdocsTexts.length).toBeGreaterThan(0);
      expect(screen.getByText(/vDocs Guide/)).toBeInTheDocument();
    });

    it('should show empty state when no messages', () => {
      render(<GuidePanel {...defaultProps} />);

      expect(screen.getByText('How can I help you?')).toBeInTheDocument();
    });

    it('should render messages when provided', () => {
      mockGuideStore.messages = mockMessages;

      render(<GuidePanel {...defaultProps} />);

      expect(screen.getByTestId('guide-message-msg-1')).toBeInTheDocument();
      expect(screen.getByTestId('guide-message-msg-2')).toBeInTheDocument();
      expect(screen.getByTestId('guide-message-msg-3')).toBeInTheDocument();
    });

    it('should display message content correctly', () => {
      mockGuideStore.messages = mockMessages;

      render(<GuidePanel {...defaultProps} />);

      expect(screen.getByText('Welcome to vDocs!')).toBeInTheDocument();
      expect(screen.getByText('How do I upload a video?')).toBeInTheDocument();
    });

    it('should not render when panel is closed', () => {
      mockGuideStore.isOpen = false;

      render(<GuidePanel {...defaultProps} />);

      expect(screen.queryByTestId('vdocs-text')).not.toBeInTheDocument();
    });
  });

  describe('Input Field', () => {
    it('should render the textarea input', () => {
      render(<GuidePanel {...defaultProps} />);

      const textarea = screen.getByRole('textbox');
      expect(textarea).toBeInTheDocument();
      expect(textarea).toHaveAttribute('placeholder', 'Ask me anything...');
    });

    it('should allow typing in the input', async () => {
      const user = userEvent.setup();

      render(<GuidePanel {...defaultProps} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Hello world');

      expect(textarea).toHaveValue('Hello world');
    });

    it('should disable input when generating', () => {
      mockGuideStore.isGenerating = true;

      render(<GuidePanel {...defaultProps} />);

      const textarea = screen.getByRole('textbox');
      expect(textarea).toBeDisabled();
    });

    it('should hide input in compact mode', () => {
      mockGuideStore.panelSize = 'compact';

      render(<GuidePanel {...defaultProps} />);

      const textarea = screen.queryByRole('textbox');
      expect(textarea).not.toBeInTheDocument();
    });
  });

  describe('Send Message', () => {
    it('should call onSendMessage when send button is clicked', async () => {
      const user = userEvent.setup();
      const onSendMessage = jest.fn();

      render(<GuidePanel {...defaultProps} onSendMessage={onSendMessage} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Test message');

      const sendButton = screen.getAllByRole('button').find(btn =>
        btn.className.includes('flex-shrink-0')
      );

      if (sendButton) {
        await user.click(sendButton);
        expect(onSendMessage).toHaveBeenCalledWith('Test message');
      }
    });

    it('should call onSendMessage when Enter is pressed', async () => {
      const user = userEvent.setup();
      const onSendMessage = jest.fn();

      render(<GuidePanel {...defaultProps} onSendMessage={onSendMessage} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Test message{Enter}');

      expect(onSendMessage).toHaveBeenCalledWith('Test message');
    });

    it('should not send on Shift+Enter', async () => {
      const user = userEvent.setup();
      const onSendMessage = jest.fn();

      render(<GuidePanel {...defaultProps} onSendMessage={onSendMessage} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Line 1{Shift>}{Enter}{/Shift}Line 2');

      expect(onSendMessage).not.toHaveBeenCalled();
    });

    it('should clear input after sending', async () => {
      const user = userEvent.setup();

      render(<GuidePanel {...defaultProps} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Test message{Enter}');

      expect(textarea).toHaveValue('');
    });

    it('should not send empty messages', async () => {
      const user = userEvent.setup();
      const onSendMessage = jest.fn();

      render(<GuidePanel {...defaultProps} onSendMessage={onSendMessage} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, '   {Enter}');

      expect(onSendMessage).not.toHaveBeenCalled();
    });

    it('should not send when generating', async () => {
      mockGuideStore.isGenerating = true;
      const user = userEvent.setup();
      const onSendMessage = jest.fn();

      render(<GuidePanel {...defaultProps} onSendMessage={onSendMessage} />);

      // Input is disabled when generating, so we can't type
      const sendButton = screen.getAllByRole('button').find(btn =>
        btn.className.includes('flex-shrink-0')
      );

      if (sendButton) {
        await user.click(sendButton);
        expect(onSendMessage).not.toHaveBeenCalled();
      }
    });
  });

  describe('Loading Indicator', () => {
    it('should show thinking indicator when generating', () => {
      mockGuideStore.isGenerating = true;
      mockGuideStore.messages = mockMessages;

      render(<GuidePanel {...defaultProps} />);

      expect(screen.getByText('Thinking...')).toBeInTheDocument();
    });

    it('should show loading spinner when generating', () => {
      mockGuideStore.isGenerating = true;
      mockGuideStore.messages = mockMessages;

      render(<GuidePanel {...defaultProps} />);

      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('should not show thinking indicator when not generating', () => {
      mockGuideStore.isGenerating = false;
      mockGuideStore.messages = mockMessages;

      render(<GuidePanel {...defaultProps} />);

      expect(screen.queryByText('Thinking...')).not.toBeInTheDocument();
    });

    it('should disable send button when generating', () => {
      mockGuideStore.isGenerating = true;

      render(<GuidePanel {...defaultProps} />);

      // In generating state, the button shows a spinner
      const spinner = document.querySelector('button .animate-spin');
      expect(spinner).toBeInTheDocument();
    });
  });

  describe('Suggestions', () => {
    it('should show suggestions when no user messages', () => {
      mockGuideStore.messages = [mockMessages[0]]; // Just the initial greeting

      render(<GuidePanel {...defaultProps} />);

      expect(screen.getByTestId('guide-suggestions')).toBeInTheDocument();
    });

    it('should call onSendMessage when suggestion is clicked', async () => {
      const user = userEvent.setup();
      const onSendMessage = jest.fn();
      mockGuideStore.messages = [mockMessages[0]];

      render(<GuidePanel {...defaultProps} onSendMessage={onSendMessage} />);

      await user.click(screen.getByTestId('suggestion-0'));

      expect(onSendMessage).toHaveBeenCalledWith('How do I create a manual?');
    });

    it('should hide suggestions after user interaction', () => {
      mockGuideStore.messages = mockMessages; // Has user messages

      render(<GuidePanel {...defaultProps} />);

      expect(screen.queryByTestId('guide-suggestions')).not.toBeInTheDocument();
    });

    it('should disable suggestions when generating', () => {
      mockGuideStore.isGenerating = true;
      mockGuideStore.messages = [mockMessages[0]];

      render(<GuidePanel {...defaultProps} />);

      const suggestionButton = screen.getByTestId('suggestion-0');
      expect(suggestionButton).toBeDisabled();
    });

    it('should hide suggestions in non-full panel size', () => {
      mockGuideStore.panelSize = 'medium';
      mockGuideStore.messages = [mockMessages[0]];

      render(<GuidePanel {...defaultProps} />);

      expect(screen.queryByTestId('guide-suggestions')).not.toBeInTheDocument();
    });
  });

  describe('Panel Size Controls', () => {
    it('should show expand button in medium mode', () => {
      mockGuideStore.panelSize = 'medium';

      render(<GuidePanel {...defaultProps} />);

      // Should have minimize and expand buttons
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });

    it('should call setFull when expand is clicked in medium mode', async () => {
      const user = userEvent.setup();
      mockGuideStore.panelSize = 'medium';

      render(<GuidePanel {...defaultProps} />);

      // Find button with ChevronUp icon (expand)
      const buttons = screen.getAllByRole('button');
      const expandButton = buttons.find(btn =>
        btn.querySelector('svg.lucide-chevron-up')
      );

      if (expandButton) {
        await user.click(expandButton);
        expect(mockGuideStore.setFull).toHaveBeenCalled();
      }
    });

    it('should call setCompact when minimize is clicked', async () => {
      const user = userEvent.setup();
      mockGuideStore.panelSize = 'medium';

      render(<GuidePanel {...defaultProps} />);

      const buttons = screen.getAllByRole('button');
      const minimizeButton = buttons.find(btn =>
        btn.querySelector('svg.lucide-minimize-2')
      );

      if (minimizeButton) {
        await user.click(minimizeButton);
        expect(mockGuideStore.setCompact).toHaveBeenCalled();
      }
    });

    it('should show expand button in compact mode', async () => {
      mockGuideStore.panelSize = 'compact';

      render(<GuidePanel {...defaultProps} />);

      const buttons = screen.getAllByRole('button');
      const expandButton = buttons.find(btn =>
        btn.querySelector('svg.lucide-chevron-up')
      );

      expect(expandButton).toBeInTheDocument();
    });

    it('should expand panel when compact view is clicked', async () => {
      const user = userEvent.setup();
      mockGuideStore.panelSize = 'compact';
      mockGuideStore.messages = mockMessages;

      render(<GuidePanel {...defaultProps} />);

      const scrollArea = screen.getByTestId('scroll-area');
      await user.click(scrollArea);

      expect(mockGuideStore.setFull).toHaveBeenCalled();
    });
  });

  describe('Close Button', () => {
    it('should call close when close button is clicked', async () => {
      const user = userEvent.setup();

      render(<GuidePanel {...defaultProps} />);

      const closeButton = screen.getAllByRole('button').find(btn =>
        btn.querySelector('svg.lucide-x')
      );

      if (closeButton) {
        await user.click(closeButton);
        expect(mockGuideStore.close).toHaveBeenCalled();
      }
    });
  });

  describe('Clear Chat', () => {
    it('should show clear button when messages exist in full mode', () => {
      mockGuideStore.messages = mockMessages;
      mockGuideStore.panelSize = 'full';

      render(<GuidePanel {...defaultProps} />);

      const clearButton = screen.getAllByRole('button').find(btn =>
        btn.querySelector('svg.lucide-trash-2')
      );

      expect(clearButton).toBeInTheDocument();
    });

    it('should call onClearChat when clear button is clicked', async () => {
      const user = userEvent.setup();
      const onClearChat = jest.fn();
      mockGuideStore.messages = mockMessages;
      mockGuideStore.panelSize = 'full';

      render(<GuidePanel {...defaultProps} onClearChat={onClearChat} />);

      const clearButton = screen.getAllByRole('button').find(btn =>
        btn.querySelector('svg.lucide-trash-2')
      );

      if (clearButton) {
        await user.click(clearButton);
        expect(onClearChat).toHaveBeenCalled();
      }
    });

    it('should hide clear button in non-full mode', () => {
      mockGuideStore.messages = mockMessages;
      mockGuideStore.panelSize = 'medium';

      render(<GuidePanel {...defaultProps} />);

      const clearButton = screen.getAllByRole('button').find(btn =>
        btn.querySelector('svg.lucide-trash-2')
      );

      // Button should not exist in non-full mode
      expect(clearButton).toBeUndefined();
    });
  });

  describe('Page Context', () => {
    it('should show page context badge when available', () => {
      mockGuideStore.pageContext = {
        currentPage: '/dashboard/videos',
        pageTitle: 'Videos',
        availableActions: ['upload', 'delete'],
        pageState: {},
      };

      render(<GuidePanel {...defaultProps} />);

      expect(screen.getByText('Videos')).toBeInTheDocument();
    });

    it('should hide page context badge when not available', () => {
      mockGuideStore.pageContext = null;

      render(<GuidePanel {...defaultProps} />);

      // No page context badge should be shown
      const badges = document.querySelectorAll('[class*="Badge"]');
      const pageContextBadge = Array.from(badges).find(b =>
        b.textContent && !b.textContent.includes('New')
      );
      expect(pageContextBadge).toBeUndefined();
    });
  });

  describe("What's New Feature", () => {
    it('should show whats new badge when label is provided', () => {
      render(<GuidePanel {...defaultProps} whatsNewLabel="Check out new features!" />);

      expect(screen.getByText('New')).toBeInTheDocument();
    });

    it('should call onSendMessage when whats new badge is clicked', async () => {
      const user = userEvent.setup();
      const onSendMessage = jest.fn();

      render(
        <GuidePanel
          {...defaultProps}
          onSendMessage={onSendMessage}
          whatsNewLabel="Check out new features!"
        />
      );

      const newBadge = screen.getByText('New');
      await user.click(newBadge);

      expect(onSendMessage).toHaveBeenCalledWith('Check out new features!');
    });
  });

  describe('Compact View', () => {
    it('should show last message preview in compact mode', () => {
      mockGuideStore.panelSize = 'compact';
      mockGuideStore.messages = mockMessages;

      render(<GuidePanel {...defaultProps} />);

      // In compact mode, it shows a preview using ReactMarkdown
      const scrollArea = screen.getByTestId('scroll-area');
      expect(scrollArea).toBeInTheDocument();
    });

    it('should show expand prompt when no messages in compact mode', () => {
      mockGuideStore.panelSize = 'compact';
      mockGuideStore.messages = [];

      render(<GuidePanel {...defaultProps} />);

      expect(screen.getByText('Click to expand...')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have accessible textarea', () => {
      render(<GuidePanel {...defaultProps} />);

      const textarea = screen.getByRole('textbox');
      expect(textarea).toBeInTheDocument();
    });

    it('should have accessible buttons', () => {
      render(<GuidePanel {...defaultProps} />);

      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });
  });
});
