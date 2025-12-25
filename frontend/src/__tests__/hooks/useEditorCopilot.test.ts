/**
 * Tests for useEditorCopilot hook
 * Tests WebSocket connection, message handling, streaming responses, and change management
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useEditorCopilot } from '@/hooks/useEditorCopilot';

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  url: string;

  send = jest.fn();
  close = jest.fn(() => {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent('close'));
    }
  });

  constructor(url: string) {
    this.url = url;
    // Auto-open after creation
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
    }, 0);
  }

  simulateMessage(data: object) {
    if (this.onmessage) {
      this.onmessage(new MessageEvent('message', { data: JSON.stringify(data) }));
    }
  }

  simulateClose() {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent('close'));
    }
  }

  simulateError() {
    if (this.onerror) {
      this.onerror(new Event('error'));
    }
  }
}

// Track WebSocket instances
let mockWebSocketInstances: MockWebSocket[] = [];
const originalWebSocket = global.WebSocket;

beforeAll(() => {
  (global as any).WebSocket = jest.fn((url: string) => {
    const ws = new MockWebSocket(url);
    mockWebSocketInstances.push(ws);
    return ws;
  });
  (global.WebSocket as any).OPEN = MockWebSocket.OPEN;
  (global.WebSocket as any).CLOSED = MockWebSocket.CLOSED;
  (global.WebSocket as any).CONNECTING = MockWebSocket.CONNECTING;
  (global.WebSocket as any).CLOSING = MockWebSocket.CLOSING;
});

afterAll(() => {
  global.WebSocket = originalWebSocket;
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  mockWebSocketInstances = [];
  Object.defineProperty(document, 'cookie', {
    writable: true,
    value: '',
  });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useEditorCopilot', () => {
  const defaultProps = {
    manualId: 'manual-001',
    language: 'en',
    documentContent: '# Test Document\n\nContent here.',
  };

  describe('test_initial_state', () => {
    it('should initialize with optimistically connected state', () => {
      const { result } = renderHook(() => useEditorCopilot(defaultProps));

      // Starts optimistically connected to prevent flicker
      expect(result.current.isConnected).toBe(true);
      expect(result.current.isGenerating).toBe(false);
      expect(result.current.messages).toEqual([]);
      expect(result.current.pendingChanges).toEqual([]);
    });

    it('should connect to WebSocket on mount', async () => {
      renderHook(() => useEditorCopilot(defaultProps));

      await waitFor(() => {
        expect(mockWebSocketInstances.length).toBe(1);
      });

      expect(mockWebSocketInstances[0].url).toContain('/api/ws/editor/manual-001');
      expect(mockWebSocketInstances[0].url).toContain('language=en');
    });

    it('should include user_id in WebSocket URL if cookie is set', async () => {
      Object.defineProperty(document, 'cookie', {
        writable: true,
        value: 'session_user_id=user-123',
      });

      renderHook(() => useEditorCopilot(defaultProps));

      await waitFor(() => {
        expect(mockWebSocketInstances.length).toBe(1);
      });

      expect(mockWebSocketInstances[0].url).toContain('user_id=user-123');
    });
  });

  describe('test_send_message', () => {
    it('should send message via WebSocket', async () => {
      const { result } = renderHook(() => useEditorCopilot(defaultProps));

      await waitFor(() => {
        expect(mockWebSocketInstances.length).toBe(1);
      });

      const ws = mockWebSocketInstances[0];

      act(() => {
        result.current.sendMessage('Hello AI', null);
      });

      expect(ws.send).toHaveBeenCalled();
      const sentData = JSON.parse(ws.send.mock.calls[0][0]);
      expect(sentData.type).toBe('chat_message');
      expect(sentData.content).toBe('Hello AI');
      expect(sentData.document_content).toBe(defaultProps.documentContent);
    });

    it('should add user message to chat history', async () => {
      const { result } = renderHook(() => useEditorCopilot(defaultProps));

      await waitFor(() => {
        expect(mockWebSocketInstances.length).toBe(1);
      });

      act(() => {
        result.current.sendMessage('Test message', null);
      });

      expect(result.current.messages.length).toBe(1);
      expect(result.current.messages[0].role).toBe('user');
      expect(result.current.messages[0].content).toBe('Test message');
    });

    it('should include selection context when provided', async () => {
      const { result } = renderHook(() => useEditorCopilot(defaultProps));

      await waitFor(() => {
        expect(mockWebSocketInstances.length).toBe(1);
      });

      const ws = mockWebSocketInstances[0];
      const selection = {
        text: 'selected text',
        startOffset: 10,
        endOffset: 22,
        context: 'surrounding context',
        highlightRects: [],
      };

      act(() => {
        result.current.sendMessage('Fix this', selection);
      });

      const sentData = JSON.parse(ws.send.mock.calls[0][0]);
      expect(sentData.selection).toEqual({
        text: 'selected text',
        startOffset: 10,
        endOffset: 22,
        context: 'surrounding context',
      });
    });

    it('should include image context when provided', async () => {
      const { result } = renderHook(() => useEditorCopilot(defaultProps));

      await waitFor(() => {
        expect(mockWebSocketInstances.length).toBe(1);
      });

      const ws = mockWebSocketInstances[0];
      const imageContext = { url: 'http://example.com/image.png', name: 'screenshot.png' };

      act(() => {
        result.current.sendMessage('What is this?', null, imageContext);
      });

      const sentData = JSON.parse(ws.send.mock.calls[0][0]);
      expect(sentData.image).toEqual({
        url: 'http://example.com/image.png',
        name: 'screenshot.png',
      });
    });

    it('should set isGenerating to true when sending message', async () => {
      const { result } = renderHook(() => useEditorCopilot(defaultProps));

      await waitFor(() => {
        expect(mockWebSocketInstances.length).toBe(1);
      });

      expect(result.current.isGenerating).toBe(false);

      act(() => {
        result.current.sendMessage('Test', null);
      });

      expect(result.current.isGenerating).toBe(true);
    });

    it('should not send message if WebSocket is not connected', async () => {
      const { result } = renderHook(() => useEditorCopilot(defaultProps));

      await waitFor(() => {
        expect(mockWebSocketInstances.length).toBe(1);
      });

      const ws = mockWebSocketInstances[0];
      ws.readyState = MockWebSocket.CLOSED;

      act(() => {
        result.current.sendMessage('Test', null);
      });

      expect(ws.send).not.toHaveBeenCalled();
    });
  });

  describe('test_handles_streaming_response', () => {
    it('should handle agent_thinking messages', async () => {
      const { result } = renderHook(() => useEditorCopilot(defaultProps));

      await waitFor(() => {
        expect(mockWebSocketInstances.length).toBe(1);
      });

      const ws = mockWebSocketInstances[0];

      await act(async () => {
        ws.simulateMessage({ type: 'agent_thinking', content: 'Let me think...' });
      });

      expect(result.current.messages.length).toBe(1);
      expect(result.current.messages[0].role).toBe('assistant');
      expect(result.current.messages[0].content).toBe('Let me think...');
      expect(result.current.messages[0].isStreaming).toBe(true);
    });

    it('should append to existing streaming message', async () => {
      const { result } = renderHook(() => useEditorCopilot(defaultProps));

      await waitFor(() => {
        expect(mockWebSocketInstances.length).toBe(1);
      });

      const ws = mockWebSocketInstances[0];

      await act(async () => {
        ws.simulateMessage({ type: 'agent_thinking', content: 'First ' });
      });

      await act(async () => {
        ws.simulateMessage({ type: 'agent_thinking', content: 'second' });
      });

      expect(result.current.messages.length).toBe(1);
      expect(result.current.messages[0].content).toBe('First second');
    });

    it('should handle chat_response with streaming', async () => {
      const { result } = renderHook(() => useEditorCopilot(defaultProps));

      await waitFor(() => {
        expect(mockWebSocketInstances.length).toBe(1);
      });

      const ws = mockWebSocketInstances[0];

      await act(async () => {
        ws.simulateMessage({ type: 'chat_response', content: 'Hello', done: false });
      });

      expect(result.current.messages.length).toBe(1);
      expect(result.current.messages[0].isStreaming).toBe(true);

      await act(async () => {
        ws.simulateMessage({ type: 'chat_response', content: 'Hello, how can I help?', done: true });
      });

      expect(result.current.messages[0].isStreaming).toBe(false);
      expect(result.current.messages[0].content).toBe('Hello, how can I help?');
      expect(result.current.isGenerating).toBe(false);
    });

    it('should handle tool_call messages', async () => {
      const { result } = renderHook(() => useEditorCopilot(defaultProps));

      await waitFor(() => {
        expect(mockWebSocketInstances.length).toBe(1);
      });

      const ws = mockWebSocketInstances[0];

      await act(async () => {
        ws.simulateMessage({
          type: 'tool_call',
          tool: 'replace_text',
          args: { start: 0, end: 10, text: 'New text' },
        });
      });

      const toolMessage = result.current.messages.find((m) => m.role === 'tool');
      expect(toolMessage).toBeDefined();
      expect(toolMessage?.toolName).toBe('replace_text');
      expect(toolMessage?.toolArgs).toEqual({ start: 0, end: 10, text: 'New text' });
    });

    it('should handle error messages', async () => {
      const { result } = renderHook(() => useEditorCopilot(defaultProps));

      await waitFor(() => {
        expect(mockWebSocketInstances.length).toBe(1);
      });

      const ws = mockWebSocketInstances[0];

      await act(async () => {
        ws.simulateMessage({ type: 'error', message: 'Something went wrong' });
      });

      const errorMessage = result.current.messages.find((m) => m.role === 'system');
      expect(errorMessage).toBeDefined();
      expect(errorMessage?.error).toBe('Something went wrong');
      expect(result.current.isGenerating).toBe(false);
    });
  });

  describe('test_handles_pending_changes', () => {
    it('should add pending change to list', async () => {
      const onPendingChange = jest.fn();
      const { result } = renderHook(() =>
        useEditorCopilot({ ...defaultProps, onPendingChange })
      );

      await waitFor(() => {
        expect(mockWebSocketInstances.length).toBe(1);
      });

      const ws = mockWebSocketInstances[0];

      await act(async () => {
        ws.simulateMessage({
          type: 'pending_change',
          change: {
            id: 'change-001',
            type: 'text_replace',
            start_line: 1,
            end_line: 2,
            original_content: 'old',
            new_content: 'new',
            reason: 'Fix typo',
          },
        });
      });

      expect(result.current.pendingChanges.length).toBe(1);
      expect(result.current.pendingChanges[0].id).toBe('change-001');
      expect(result.current.pendingChanges[0].type).toBe('text_replace');
      expect(result.current.pendingChanges[0].status).toBe('pending');
      expect(onPendingChange).toHaveBeenCalled();
    });

    it('should convert snake_case to camelCase', async () => {
      const { result } = renderHook(() => useEditorCopilot(defaultProps));

      await waitFor(() => {
        expect(mockWebSocketInstances.length).toBe(1);
      });

      const ws = mockWebSocketInstances[0];

      await act(async () => {
        ws.simulateMessage({
          type: 'pending_change',
          change: {
            change_id: 'change-002',
            type: 'text_insert',
            after_line: 5,
            new_content: 'inserted text',
          },
        });
      });

      expect(result.current.pendingChanges[0].id).toBe('change-002');
      expect(result.current.pendingChanges[0].afterLine).toBe(5);
      expect(result.current.pendingChanges[0].newContent).toBe('inserted text');
    });

    it('should add tool_result message for pending change', async () => {
      const { result } = renderHook(() => useEditorCopilot(defaultProps));

      await waitFor(() => {
        expect(mockWebSocketInstances.length).toBe(1);
      });

      const ws = mockWebSocketInstances[0];

      await act(async () => {
        ws.simulateMessage({
          type: 'pending_change',
          change: {
            id: 'change-003',
            type: 'text_replace',
            start_line: 1,
            end_line: 1,
          },
        });
      });

      const toolResultMessage = result.current.messages.find((m) => m.role === 'tool_result');
      expect(toolResultMessage).toBeDefined();
      expect(toolResultMessage?.toolResult?.changeId).toBe('change-003');
    });
  });

  describe('test_accept_change', () => {
    it('should update change status to accepted', async () => {
      const onChangeAccepted = jest.fn();
      const { result } = renderHook(() =>
        useEditorCopilot({ ...defaultProps, onChangeAccepted })
      );

      await waitFor(() => {
        expect(mockWebSocketInstances.length).toBe(1);
      });

      const ws = mockWebSocketInstances[0];

      // Add a pending change
      await act(async () => {
        ws.simulateMessage({
          type: 'pending_change',
          change: {
            id: 'change-accept',
            type: 'text_replace',
            start_line: 1,
            end_line: 1,
            new_content: 'new',
          },
        });
      });

      expect(result.current.pendingChanges[0].status).toBe('pending');

      // Accept the change
      act(() => {
        result.current.acceptChange('change-accept');
      });

      expect(result.current.pendingChanges[0].status).toBe('accepted');
      expect(onChangeAccepted).toHaveBeenCalled();
    });

    it('should send accept_change message to server', async () => {
      const { result } = renderHook(() => useEditorCopilot(defaultProps));

      await waitFor(() => {
        expect(mockWebSocketInstances.length).toBe(1);
      });

      const ws = mockWebSocketInstances[0];

      // Add pending change
      await act(async () => {
        ws.simulateMessage({
          type: 'pending_change',
          change: { id: 'change-001', type: 'text_replace' },
        });
      });

      ws.send.mockClear();

      // Accept
      act(() => {
        result.current.acceptChange('change-001');
      });

      expect(ws.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'accept_change', change_id: 'change-001' })
      );
    });

    it('should not accept already accepted change', async () => {
      const onChangeAccepted = jest.fn();
      const { result } = renderHook(() =>
        useEditorCopilot({ ...defaultProps, onChangeAccepted })
      );

      await waitFor(() => {
        expect(mockWebSocketInstances.length).toBe(1);
      });

      const ws = mockWebSocketInstances[0];

      // Add and accept a change
      await act(async () => {
        ws.simulateMessage({
          type: 'pending_change',
          change: { id: 'change-001', type: 'text_replace' },
        });
      });

      act(() => {
        result.current.acceptChange('change-001');
      });

      onChangeAccepted.mockClear();
      ws.send.mockClear();

      // Try to accept again
      act(() => {
        result.current.acceptChange('change-001');
      });

      // Should not call again for non-pending change
      expect(onChangeAccepted).not.toHaveBeenCalled();
    });

    it('should handle change_accepted message from server', async () => {
      const { result } = renderHook(() => useEditorCopilot(defaultProps));

      await waitFor(() => {
        expect(mockWebSocketInstances.length).toBe(1);
      });

      const ws = mockWebSocketInstances[0];

      // Add pending change
      await act(async () => {
        ws.simulateMessage({
          type: 'pending_change',
          change: { id: 'change-server', type: 'text_replace' },
        });
      });

      // Server confirms acceptance
      await act(async () => {
        ws.simulateMessage({ type: 'change_accepted', change_id: 'change-server' });
      });

      expect(result.current.pendingChanges[0].status).toBe('accepted');
    });
  });

  describe('test_reject_change', () => {
    it('should update change status to rejected', async () => {
      const { result } = renderHook(() => useEditorCopilot(defaultProps));

      await waitFor(() => {
        expect(mockWebSocketInstances.length).toBe(1);
      });

      const ws = mockWebSocketInstances[0];

      // Add pending change
      await act(async () => {
        ws.simulateMessage({
          type: 'pending_change',
          change: { id: 'change-reject', type: 'text_replace' },
        });
      });

      // Reject
      act(() => {
        result.current.rejectChange('change-reject');
      });

      expect(result.current.pendingChanges[0].status).toBe('rejected');
    });

    it('should send reject_change message to server', async () => {
      const { result } = renderHook(() => useEditorCopilot(defaultProps));

      await waitFor(() => {
        expect(mockWebSocketInstances.length).toBe(1);
      });

      const ws = mockWebSocketInstances[0];

      // Add pending change
      await act(async () => {
        ws.simulateMessage({
          type: 'pending_change',
          change: { id: 'change-001', type: 'text_replace' },
        });
      });

      ws.send.mockClear();

      // Reject
      act(() => {
        result.current.rejectChange('change-001');
      });

      expect(ws.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'reject_change', change_id: 'change-001' })
      );
    });

    it('should handle change_rejected message from server', async () => {
      const { result } = renderHook(() => useEditorCopilot(defaultProps));

      await waitFor(() => {
        expect(mockWebSocketInstances.length).toBe(1);
      });

      const ws = mockWebSocketInstances[0];

      // Add pending change
      await act(async () => {
        ws.simulateMessage({
          type: 'pending_change',
          change: { id: 'change-server-reject', type: 'text_replace' },
        });
      });

      // Server confirms rejection
      await act(async () => {
        ws.simulateMessage({ type: 'change_rejected', change_id: 'change-server-reject' });
      });

      expect(result.current.pendingChanges[0].status).toBe('rejected');
    });
  });

  describe('stopGeneration', () => {
    it('should send cancel message and stop generating', async () => {
      const { result } = renderHook(() => useEditorCopilot(defaultProps));

      await waitFor(() => {
        expect(mockWebSocketInstances.length).toBe(1);
      });

      const ws = mockWebSocketInstances[0];

      // Start generating
      act(() => {
        result.current.sendMessage('Test', null);
      });

      expect(result.current.isGenerating).toBe(true);

      ws.send.mockClear();

      // Stop
      act(() => {
        result.current.stopGeneration();
      });

      expect(ws.send).toHaveBeenCalledWith(JSON.stringify({ type: 'cancel_generation' }));
      expect(result.current.isGenerating).toBe(false);
    });

    it('should mark streaming messages as complete', async () => {
      const { result } = renderHook(() => useEditorCopilot(defaultProps));

      await waitFor(() => {
        expect(mockWebSocketInstances.length).toBe(1);
      });

      const ws = mockWebSocketInstances[0];

      // Create streaming message
      await act(async () => {
        ws.simulateMessage({ type: 'agent_thinking', content: 'Thinking...' });
      });

      expect(result.current.messages[0].isStreaming).toBe(true);

      // Stop
      act(() => {
        result.current.stopGeneration();
      });

      expect(result.current.messages[0].isStreaming).toBe(false);
    });
  });

  describe('clearChat', () => {
    it('should clear all messages and pending changes', async () => {
      const { result } = renderHook(() => useEditorCopilot(defaultProps));

      await waitFor(() => {
        expect(mockWebSocketInstances.length).toBe(1);
      });

      const ws = mockWebSocketInstances[0];

      // Add some state
      await act(async () => {
        ws.simulateMessage({ type: 'agent_thinking', content: 'Message' });
        ws.simulateMessage({
          type: 'pending_change',
          change: { id: 'change-1', type: 'text_replace' },
        });
      });

      expect(result.current.messages.length).toBeGreaterThan(0);
      expect(result.current.pendingChanges.length).toBeGreaterThan(0);

      act(() => {
        result.current.clearChat();
      });

      expect(result.current.messages).toEqual([]);
      expect(result.current.pendingChanges).toEqual([]);
    });
  });

  describe('connection management', () => {
    it('should reconnect after disconnect', async () => {
      renderHook(() => useEditorCopilot(defaultProps));

      await waitFor(() => {
        expect(mockWebSocketInstances.length).toBe(1);
      });

      const ws1 = mockWebSocketInstances[0];

      // Simulate disconnect
      await act(async () => {
        ws1.simulateClose();
      });

      // Advance timers for reconnect (3 seconds)
      act(() => {
        jest.advanceTimersByTime(3500);
      });

      await waitFor(() => {
        expect(mockWebSocketInstances.length).toBe(2);
      });
    });

    it('should disconnect on unmount', async () => {
      const { unmount } = renderHook(() => useEditorCopilot(defaultProps));

      await waitFor(() => {
        expect(mockWebSocketInstances.length).toBe(1);
      });

      const ws = mockWebSocketInstances[0];

      unmount();

      expect(ws.close).toHaveBeenCalled();
    });

    it('should delay showing disconnected state', async () => {
      const { result } = renderHook(() => useEditorCopilot(defaultProps));

      await waitFor(() => {
        expect(mockWebSocketInstances.length).toBe(1);
      });

      const ws = mockWebSocketInstances[0];

      // Simulate disconnect
      await act(async () => {
        ws.simulateClose();
      });

      // Should still appear connected (1.5 second delay)
      expect(result.current.isConnected).toBe(true);

      // Advance past delay
      act(() => {
        jest.advanceTimersByTime(2000);
      });

      expect(result.current.isConnected).toBe(false);
    });
  });
});
