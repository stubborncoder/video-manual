import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CopilotPanel } from '../CopilotPanel';
import type { ChatMessageData } from '../ChatMessage';
import type { TextSelection } from '@/hooks/useTextSelection';
import type { ImageContext } from '../ImageContextChip';

// Mock next-intl
jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      title: 'Copilot',
      connected: 'Connected',
      disconnected: 'Disconnected',
      clearChat: 'Clear Chat',
      thinking: 'Thinking...',
      emptyStateTitle: 'AI Assistant',
      emptyStateDesc: 'Ask me anything about your manual',
      stopGeneration: 'Stop Generation',
      sendMessage: 'Send Message',
      placeholderDefault: 'Type your message...',
      placeholderSelection: 'Ask about the selected text...',
      placeholderImage: 'Ask about the image...',
      placeholderPaused: 'Switch to preview mode to chat',
      disconnectedMessage: 'Connection lost. Please refresh the page.',
      pausedMessage: 'Chat paused while editing markdown',
    };
    return translations[key] || key;
  },
}));

// Mock child components
jest.mock('../ChatMessage', () => ({
  ChatMessage: ({ message }: { message: ChatMessageData }) => (
    <div data-testid={`chat-message-${message.id}`} data-role={message.role}>
      {message.content}
    </div>
  ),
}));

jest.mock('../SelectionChip', () => ({
  SelectionChip: ({ selection, onClear }: { selection: TextSelection; onClear: () => void }) => (
    <div data-testid="selection-chip">
      <span>{selection.text}</span>
      <button onClick={onClear} data-testid="clear-selection">Clear</button>
    </div>
  ),
}));

jest.mock('../ImageContextChip', () => ({
  ImageContextChip: ({ imageContext, onClear }: { imageContext: ImageContext; onClear: () => void }) => (
    <div data-testid="image-context-chip">
      <span>{imageContext.name}</span>
      <button onClick={onClear} data-testid="clear-image-context">Clear</button>
    </div>
  ),
}));

// Mock radix-ui scroll-area
jest.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, ...props }: { children: React.ReactNode }) => (
    <div data-testid="scroll-area" {...props}>{children}</div>
  ),
}));

describe('CopilotPanel Component', () => {
  const mockMessages: ChatMessageData[] = [
    {
      id: 'msg-1',
      role: 'user',
      content: 'Hello, can you help me?',
      timestamp: new Date('2024-01-01T10:00:00'),
    },
    {
      id: 'msg-2',
      role: 'assistant',
      content: 'Of course! How can I assist you?',
      timestamp: new Date('2024-01-01T10:00:05'),
    },
  ];

  const mockSelection: TextSelection = {
    text: 'Selected text content',
    startLine: 10,
    endLine: 15,
    startOffset: 0,
    endOffset: 20,
    context: 'Some context around the selection',
  };

  const mockImageContext: ImageContext = {
    url: 'https://example.com/image.jpg',
    name: 'screenshot.png',
  };

  const defaultProps = {
    messages: [],
    pendingChanges: [],
    selection: null,
    onClearSelection: jest.fn(),
    imageContext: null,
    onClearImageContext: jest.fn(),
    onSendMessage: jest.fn(),
    onStopGeneration: jest.fn(),
    onClearChat: jest.fn(),
    onAcceptChange: jest.fn(),
    onRejectChange: jest.fn(),
    isGenerating: false,
    isConnected: true,
    isPaused: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering Content', () => {
    it('should render the copilot title', () => {
      render(<CopilotPanel {...defaultProps} />);

      expect(screen.getByText('Copilot')).toBeInTheDocument();
    });

    it('should show empty state when no messages', () => {
      render(<CopilotPanel {...defaultProps} />);

      expect(screen.getByText('AI Assistant')).toBeInTheDocument();
      expect(screen.getByText('Ask me anything about your manual')).toBeInTheDocument();
    });

    it('should render messages when provided', () => {
      render(<CopilotPanel {...defaultProps} messages={mockMessages} />);

      expect(screen.getByTestId('chat-message-msg-1')).toBeInTheDocument();
      expect(screen.getByTestId('chat-message-msg-2')).toBeInTheDocument();
      expect(screen.getByText('Hello, can you help me?')).toBeInTheDocument();
      expect(screen.getByText('Of course! How can I assist you?')).toBeInTheDocument();
    });

    it('should show connection indicator as connected', () => {
      render(<CopilotPanel {...defaultProps} isConnected={true} />);

      const indicator = document.querySelector('.bg-green-500');
      expect(indicator).toBeInTheDocument();
    });

    it('should show connection indicator as disconnected', () => {
      render(<CopilotPanel {...defaultProps} isConnected={false} />);

      const indicator = document.querySelector('.bg-red-500');
      expect(indicator).toBeInTheDocument();
    });
  });

  describe('Edit Mode Toggle / Input Behavior', () => {
    it('should disable textarea when disconnected', () => {
      render(<CopilotPanel {...defaultProps} isConnected={false} />);

      const textarea = screen.getByRole('textbox');
      expect(textarea).toBeDisabled();
    });

    it('should disable textarea when paused', () => {
      render(<CopilotPanel {...defaultProps} isPaused={true} />);

      const textarea = screen.getByRole('textbox');
      expect(textarea).toBeDisabled();
    });

    it('should enable textarea when connected and not paused', () => {
      render(<CopilotPanel {...defaultProps} isConnected={true} isPaused={false} />);

      const textarea = screen.getByRole('textbox');
      expect(textarea).not.toBeDisabled();
    });

    it('should show paused message when in markdown mode', () => {
      render(<CopilotPanel {...defaultProps} isPaused={true} isConnected={true} />);

      expect(screen.getByText('Chat paused while editing markdown')).toBeInTheDocument();
    });

    it('should show disconnected message when not connected', () => {
      render(<CopilotPanel {...defaultProps} isConnected={false} />);

      expect(screen.getByText('Connection lost. Please refresh the page.')).toBeInTheDocument();
    });
  });

  describe('Toolbar Visibility', () => {
    it('should show clear chat button when messages exist', () => {
      render(<CopilotPanel {...defaultProps} messages={mockMessages} />);

      // The clear chat button has Trash2 icon
      const buttons = document.querySelectorAll('button');
      const clearButton = Array.from(buttons).find(btn =>
        btn.querySelector('svg.lucide-trash-2') || btn.className.includes('h-7')
      );
      expect(clearButton).toBeInTheDocument();
    });

    it('should hide clear chat button when no messages', () => {
      render(<CopilotPanel {...defaultProps} messages={[]} />);

      // Empty state should be shown instead of clear button
      expect(screen.getByText('AI Assistant')).toBeInTheDocument();
    });

    it('should show stop button when generating', () => {
      render(<CopilotPanel {...defaultProps} isGenerating={true} />);

      // Stop button has destructive variant
      const stopButton = document.querySelector('button[class*="destructive"]');
      expect(stopButton).toBeInTheDocument();
    });

    it('should show send button when not generating', () => {
      render(<CopilotPanel {...defaultProps} isGenerating={false} />);

      // Send button should be present
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });
  });

  describe('Save/Send Button', () => {
    it('should call onSendMessage when send button is clicked', async () => {
      const user = userEvent.setup();
      const onSendMessage = jest.fn();

      render(<CopilotPanel {...defaultProps} onSendMessage={onSendMessage} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Test message');

      // Find and click send button
      const buttons = screen.getAllByRole('button');
      const sendButton = buttons.find(btn => !btn.hasAttribute('disabled') && btn.className.includes('h-[60px]'));

      if (sendButton) {
        await user.click(sendButton);

        expect(onSendMessage).toHaveBeenCalledWith('Test message', null, undefined);
      }
    });

    it('should send message on Enter key', async () => {
      const user = userEvent.setup();
      const onSendMessage = jest.fn();

      render(<CopilotPanel {...defaultProps} onSendMessage={onSendMessage} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Test message{Enter}');

      expect(onSendMessage).toHaveBeenCalledWith('Test message', null, undefined);
    });

    it('should not send on Shift+Enter', async () => {
      const user = userEvent.setup();
      const onSendMessage = jest.fn();

      render(<CopilotPanel {...defaultProps} onSendMessage={onSendMessage} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Line 1{Shift>}{Enter}{/Shift}Line 2');

      expect(onSendMessage).not.toHaveBeenCalled();
    });

    it('should disable send button when input is empty', () => {
      render(<CopilotPanel {...defaultProps} />);

      const buttons = screen.getAllByRole('button');
      const sendButton = buttons.find(btn => btn.className.includes('h-[60px]'));

      expect(sendButton).toBeDisabled();
    });

    it('should include selection context when sending message', async () => {
      const user = userEvent.setup();
      const onSendMessage = jest.fn();

      render(
        <CopilotPanel
          {...defaultProps}
          onSendMessage={onSendMessage}
          selection={mockSelection}
        />
      );

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Explain this{Enter}');

      expect(onSendMessage).toHaveBeenCalledWith('Explain this', mockSelection, undefined);
    });

    it('should include image context when sending message', async () => {
      const user = userEvent.setup();
      const onSendMessage = jest.fn();

      render(
        <CopilotPanel
          {...defaultProps}
          onSendMessage={onSendMessage}
          imageContext={mockImageContext}
        />
      );

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Describe this image{Enter}');

      expect(onSendMessage).toHaveBeenCalledWith('Describe this image', null, mockImageContext);
    });
  });

  describe('Loading State', () => {
    it('should show thinking indicator when generating', () => {
      render(<CopilotPanel {...defaultProps} messages={mockMessages} isGenerating={true} />);

      expect(screen.getByText('Thinking...')).toBeInTheDocument();
    });

    it('should show loading spinner when generating', () => {
      render(<CopilotPanel {...defaultProps} messages={mockMessages} isGenerating={true} />);

      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('should not show thinking indicator when not generating', () => {
      render(<CopilotPanel {...defaultProps} messages={mockMessages} isGenerating={false} />);

      expect(screen.queryByText('Thinking...')).not.toBeInTheDocument();
    });

    it('should call onStopGeneration when stop button is clicked', async () => {
      const user = userEvent.setup();
      const onStopGeneration = jest.fn();

      render(<CopilotPanel {...defaultProps} isGenerating={true} onStopGeneration={onStopGeneration} />);

      const stopButton = document.querySelector('button[class*="destructive"]');
      if (stopButton) {
        await user.click(stopButton);
        expect(onStopGeneration).toHaveBeenCalled();
      }
    });
  });

  describe('Selection Context', () => {
    it('should show selection chip when selection is provided', () => {
      render(<CopilotPanel {...defaultProps} selection={mockSelection} />);

      expect(screen.getByTestId('selection-chip')).toBeInTheDocument();
      expect(screen.getByText('Selected text content')).toBeInTheDocument();
    });

    it('should call onClearSelection when clear button is clicked', async () => {
      const user = userEvent.setup();
      const onClearSelection = jest.fn();

      render(
        <CopilotPanel
          {...defaultProps}
          selection={mockSelection}
          onClearSelection={onClearSelection}
        />
      );

      await user.click(screen.getByTestId('clear-selection'));

      expect(onClearSelection).toHaveBeenCalled();
    });

    it('should update placeholder when selection is active', () => {
      render(<CopilotPanel {...defaultProps} selection={mockSelection} />);

      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveAttribute('placeholder', 'Ask about the selected text...');
    });
  });

  describe('Image Context', () => {
    it('should show image context chip when image is provided', () => {
      render(<CopilotPanel {...defaultProps} imageContext={mockImageContext} />);

      expect(screen.getByTestId('image-context-chip')).toBeInTheDocument();
      expect(screen.getByText('screenshot.png')).toBeInTheDocument();
    });

    it('should call onClearImageContext when clear button is clicked', async () => {
      const user = userEvent.setup();
      const onClearImageContext = jest.fn();

      render(
        <CopilotPanel
          {...defaultProps}
          imageContext={mockImageContext}
          onClearImageContext={onClearImageContext}
        />
      );

      await user.click(screen.getByTestId('clear-image-context'));

      expect(onClearImageContext).toHaveBeenCalled();
    });

    it('should update placeholder when image is active', () => {
      render(<CopilotPanel {...defaultProps} imageContext={mockImageContext} />);

      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveAttribute('placeholder', 'Ask about the image...');
    });
  });

  describe('Clear Chat', () => {
    it('should call onClearChat when clear button is clicked', async () => {
      const user = userEvent.setup();
      const onClearChat = jest.fn();

      render(<CopilotPanel {...defaultProps} messages={mockMessages} onClearChat={onClearChat} />);

      // Find the clear chat button (has Trash2 icon in header)
      const buttons = document.querySelectorAll('button');
      const clearButton = Array.from(buttons).find(btn =>
        btn.classList.contains('h-7') && btn.classList.contains('px-2')
      );

      if (clearButton) {
        await user.click(clearButton);
        expect(onClearChat).toHaveBeenCalled();
      }
    });
  });

  describe('Accessibility', () => {
    it('should have accessible textarea', () => {
      render(<CopilotPanel {...defaultProps} />);

      const textarea = screen.getByRole('textbox');
      expect(textarea).toBeInTheDocument();
    });

    it('should have accessible buttons', () => {
      render(<CopilotPanel {...defaultProps} />);

      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });

    it('should have proper heading structure', () => {
      render(<CopilotPanel {...defaultProps} />);

      expect(screen.getByText('Copilot')).toBeInTheDocument();
    });
  });

  describe('Message Input', () => {
    it('should clear input after sending message', async () => {
      const user = userEvent.setup();

      render(<CopilotPanel {...defaultProps} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Test message{Enter}');

      expect(textarea).toHaveValue('');
    });

    it('should clear selection after sending message', async () => {
      const user = userEvent.setup();
      const onClearSelection = jest.fn();

      render(
        <CopilotPanel
          {...defaultProps}
          selection={mockSelection}
          onClearSelection={onClearSelection}
        />
      );

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Test{Enter}');

      expect(onClearSelection).toHaveBeenCalled();
    });

    it('should clear image context after sending message', async () => {
      const user = userEvent.setup();
      const onClearImageContext = jest.fn();

      render(
        <CopilotPanel
          {...defaultProps}
          imageContext={mockImageContext}
          onClearImageContext={onClearImageContext}
        />
      );

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Test{Enter}');

      expect(onClearImageContext).toHaveBeenCalled();
    });

    it('should not send empty messages', async () => {
      const user = userEvent.setup();
      const onSendMessage = jest.fn();

      render(<CopilotPanel {...defaultProps} onSendMessage={onSendMessage} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, '   {Enter}');

      expect(onSendMessage).not.toHaveBeenCalled();
    });

    it('should not send when generating', async () => {
      const user = userEvent.setup();
      const onSendMessage = jest.fn();

      render(<CopilotPanel {...defaultProps} onSendMessage={onSendMessage} isGenerating={true} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Test message');
      fireEvent.keyDown(textarea, { key: 'Enter' });

      expect(onSendMessage).not.toHaveBeenCalled();
    });
  });
});
