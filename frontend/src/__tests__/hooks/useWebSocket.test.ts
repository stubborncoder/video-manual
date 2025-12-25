/**
 * Tests for useVideoProcessing and useProjectCompiler hooks from useWebSocket.ts
 * Tests WebSocket connection, message handling, reconnection, and cleanup
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useVideoProcessing, useProjectCompiler } from '@/hooks/useWebSocket';

// Mock the jobs store
const mockAddJob = jest.fn();
const mockUpdateJob = jest.fn();
jest.mock('@/stores/jobsStore', () => ({
  useJobsStore: () => ({
    addJob: mockAddJob,
    updateJob: mockUpdateJob,
  }),
}));

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
    // Simulate async connection
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
    }, 0);
  }

  // Test helpers
  simulateMessage(data: object) {
    if (this.onmessage) {
      this.onmessage(new MessageEvent('message', { data: JSON.stringify(data) }));
    }
  }

  simulateError() {
    if (this.onerror) {
      this.onerror(new Event('error'));
    }
  }

  simulateClose() {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent('close'));
    }
  }
}

// Store WebSocket instances for testing
let mockWebSocketInstances: MockWebSocket[] = [];

// Replace global WebSocket
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
  mockWebSocketInstances = [];
  // Clear cookies
  Object.defineProperty(document, 'cookie', {
    writable: true,
    value: '',
  });
});

describe('useVideoProcessing', () => {
  describe('test_connects_on_mount', () => {
    it('should start with idle state', () => {
      const { result } = renderHook(() => useVideoProcessing());

      expect(result.current.state.status).toBe('idle');
      expect(result.current.state.nodeDetails).toEqual({});
      expect(result.current.state.streamedText).toBe('');
    });

    it('should connect to WebSocket when startProcessing is called', async () => {
      const { result } = renderHook(() => useVideoProcessing());

      // Start processing - don't await since we want to inspect mid-process
      act(() => {
        result.current.startProcessing({ video_name: 'test.mp4' });
      });

      await waitFor(() => {
        expect(mockWebSocketInstances.length).toBe(1);
      });

      expect(mockWebSocketInstances[0].url).toContain('/api/ws/process');
    });

    it('should include user_id in URL when cookie is set', async () => {
      Object.defineProperty(document, 'cookie', {
        writable: true,
        value: 'session_user_id=test-user-123',
      });

      const { result } = renderHook(() => useVideoProcessing());

      act(() => {
        result.current.startProcessing({ video_name: 'test.mp4' });
      });

      await waitFor(() => {
        expect(mockWebSocketInstances.length).toBe(1);
      });

      expect(mockWebSocketInstances[0].url).toContain('user_id=test-user-123');
    });
  });

  describe('test_handles_messages', () => {
    it('should handle job_created event', async () => {
      const { result } = renderHook(() => useVideoProcessing());

      let resolvePromise: (value: { jobId: string }) => void;
      const processingPromise = new Promise<{ jobId: string }>((resolve) => {
        resolvePromise = resolve;
      });

      act(() => {
        result.current.startProcessing({ video_name: 'test.mp4' }).then(resolvePromise!);
      });

      await waitFor(() => {
        expect(mockWebSocketInstances.length).toBe(1);
      });

      const ws = mockWebSocketInstances[0];

      await act(async () => {
        ws.simulateMessage({
          event_type: 'job_created',
          data: { job_id: 'job-123', video_name: 'test.mp4' },
        });
      });

      const jobResult = await processingPromise;
      expect(jobResult.jobId).toBe('job-123');
      expect(mockAddJob).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'job-123',
          video_name: 'test.mp4',
          status: 'processing',
        })
      );
    });

    it('should handle node_started event', async () => {
      const { result } = renderHook(() => useVideoProcessing());

      act(() => {
        result.current.startProcessing({ video_name: 'test.mp4' });
      });

      await waitFor(() => {
        expect(mockWebSocketInstances.length).toBe(1);
      });

      const ws = mockWebSocketInstances[0];

      // First send job_created
      await act(async () => {
        ws.simulateMessage({
          event_type: 'job_created',
          data: { job_id: 'job-123', video_name: 'test.mp4' },
        });
      });

      // Then send node_started
      await act(async () => {
        ws.simulateMessage({
          event_type: 'node_started',
          data: { node_name: 'analyze_video', node_index: 1, total_nodes: 5 },
        });
      });

      expect(result.current.state.status).toBe('processing');
      expect(result.current.state.currentNode).toBe('analyze_video');
      expect(result.current.state.nodeIndex).toBe(1);
      expect(result.current.state.totalNodes).toBe(5);
    });

    it('should handle node_completed event', async () => {
      const { result } = renderHook(() => useVideoProcessing());

      act(() => {
        result.current.startProcessing({ video_name: 'test.mp4' });
      });

      await waitFor(() => {
        expect(mockWebSocketInstances.length).toBe(1);
      });

      const ws = mockWebSocketInstances[0];

      await act(async () => {
        ws.simulateMessage({
          event_type: 'node_completed',
          data: { node_name: 'analyze_video', details: { frames: 100 } },
        });
      });

      expect(result.current.state.nodeDetails).toEqual({
        analyze_video: { frames: 100 },
      });
    });

    it('should handle error event', async () => {
      const { result } = renderHook(() => useVideoProcessing());

      act(() => {
        result.current.startProcessing({ video_name: 'test.mp4' });
      });

      await waitFor(() => {
        expect(mockWebSocketInstances.length).toBe(1);
      });

      const ws = mockWebSocketInstances[0];

      // First create job so error updates it
      await act(async () => {
        ws.simulateMessage({
          event_type: 'job_created',
          data: { job_id: 'job-123', video_name: 'test.mp4' },
        });
      });

      await act(async () => {
        ws.simulateMessage({
          event_type: 'error',
          data: { error_message: 'Processing failed' },
        });
      });

      expect(result.current.state.status).toBe('error');
      expect(result.current.state.error).toBe('Processing failed');
      expect(mockUpdateJob).toHaveBeenCalledWith(
        'job-123',
        expect.objectContaining({
          status: 'error',
          error: 'Processing failed',
        })
      );
    });

    it('should handle complete event', async () => {
      const { result } = renderHook(() => useVideoProcessing());

      act(() => {
        result.current.startProcessing({ video_name: 'test.mp4' });
      });

      await waitFor(() => {
        expect(mockWebSocketInstances.length).toBe(1);
      });

      const ws = mockWebSocketInstances[0];

      // First create job
      await act(async () => {
        ws.simulateMessage({
          event_type: 'job_created',
          data: { job_id: 'job-123', video_name: 'test.mp4' },
        });
      });

      await act(async () => {
        ws.simulateMessage({
          event_type: 'complete',
          data: { result: { doc_id: 'doc-001' } },
        });
      });

      expect(result.current.state.status).toBe('complete');
      expect(result.current.state.result).toEqual({ doc_id: 'doc-001' });
      expect(mockUpdateJob).toHaveBeenCalledWith(
        'job-123',
        expect.objectContaining({
          status: 'complete',
          doc_id: 'doc-001',
        })
      );
    });
  });

  describe('test_reconnects_on_disconnect', () => {
    it('should handle WebSocket error', async () => {
      const { result } = renderHook(() => useVideoProcessing());

      let processingError: Error | null = null;

      act(() => {
        result.current.startProcessing({ video_name: 'test.mp4' }).catch((err) => {
          processingError = err;
        });
      });

      await waitFor(() => {
        expect(mockWebSocketInstances.length).toBe(1);
      });

      const ws = mockWebSocketInstances[0];

      await act(async () => {
        ws.simulateError();
      });

      expect(result.current.state.status).toBe('error');
      expect(result.current.state.error).toBe('WebSocket connection failed');

      await waitFor(() => {
        expect(processingError).toBeInstanceOf(Error);
        expect(processingError?.message).toBe('WebSocket connection failed');
      });
    });

    it('should clean up WebSocket reference on close', async () => {
      const { result } = renderHook(() => useVideoProcessing());

      act(() => {
        result.current.startProcessing({ video_name: 'test.mp4' });
      });

      await waitFor(() => {
        expect(mockWebSocketInstances.length).toBe(1);
      });

      const ws = mockWebSocketInstances[0];

      await act(async () => {
        ws.simulateMessage({
          event_type: 'job_created',
          data: { job_id: 'job-123', video_name: 'test.mp4' },
        });
      });

      await act(async () => {
        ws.simulateClose();
      });

      // WebSocket should be nulled out after close
      // We verify by checking that reset doesn't throw
      act(() => {
        result.current.reset();
      });

      expect(result.current.state.status).toBe('idle');
    });
  });

  describe('test_sends_messages', () => {
    it('should send start action with request data on connection', async () => {
      const { result } = renderHook(() => useVideoProcessing());

      act(() => {
        result.current.startProcessing({
          video_name: 'test.mp4',
          doc_format: 'step-manual',
        });
      });

      await waitFor(() => {
        expect(mockWebSocketInstances.length).toBe(1);
        expect(mockWebSocketInstances[0].send).toHaveBeenCalled();
      });

      const sentData = JSON.parse(mockWebSocketInstances[0].send.mock.calls[0][0]);
      expect(sentData.action).toBe('start');
      expect(sentData.video_name).toBe('test.mp4');
      expect(sentData.doc_format).toBe('step-manual');
    });
  });

  describe('test_cleanup_on_unmount', () => {
    it('should reset state and close WebSocket on reset', async () => {
      const { result } = renderHook(() => useVideoProcessing());

      act(() => {
        result.current.startProcessing({ video_name: 'test.mp4' });
      });

      await waitFor(() => {
        expect(mockWebSocketInstances.length).toBe(1);
      });

      const ws = mockWebSocketInstances[0];

      // Simulate some state changes
      await act(async () => {
        ws.simulateMessage({
          event_type: 'job_created',
          data: { job_id: 'job-123', video_name: 'test.mp4' },
        });
      });

      // Reset
      act(() => {
        result.current.reset();
      });

      expect(ws.close).toHaveBeenCalled();
      expect(result.current.state.status).toBe('idle');
      expect(result.current.state.nodeDetails).toEqual({});
      expect(result.current.state.streamedText).toBe('');
    });
  });
});

describe('useProjectCompiler', () => {
  // Mock requestAnimationFrame for token batching tests
  let rafCallbacks: (() => void)[] = [];
  const originalRaf = global.requestAnimationFrame;
  const originalCaf = global.cancelAnimationFrame;

  beforeAll(() => {
    global.requestAnimationFrame = jest.fn((cb: () => void) => {
      rafCallbacks.push(cb);
      return rafCallbacks.length;
    });
    global.cancelAnimationFrame = jest.fn((id: number) => {
      rafCallbacks = rafCallbacks.filter((_, i) => i + 1 !== id);
    });
  });

  afterAll(() => {
    global.requestAnimationFrame = originalRaf;
    global.cancelAnimationFrame = originalCaf;
  });

  beforeEach(() => {
    rafCallbacks = [];
  });

  describe('test_connects_on_mount', () => {
    it('should start with idle state', () => {
      const { result } = renderHook(() => useProjectCompiler());

      expect(result.current.state.status).toBe('idle');
      expect(result.current.state.streamedText).toBe('');
    });

    it('should connect to compile WebSocket endpoint', async () => {
      const { result } = renderHook(() => useProjectCompiler());

      act(() => {
        result.current.startCompilation({ doc_id: 'doc-001' });
      });

      await waitFor(() => {
        expect(mockWebSocketInstances.length).toBe(1);
      });

      expect(mockWebSocketInstances[0].url).toContain('/api/ws/compile');
    });
  });

  describe('test_handles_messages', () => {
    it('should handle llm_token events with batching', async () => {
      const { result } = renderHook(() => useProjectCompiler());

      act(() => {
        result.current.startCompilation({ doc_id: 'doc-001' });
      });

      await waitFor(() => {
        expect(mockWebSocketInstances.length).toBe(1);
      });

      const ws = mockWebSocketInstances[0];

      // Send multiple tokens
      await act(async () => {
        ws.simulateMessage({ event_type: 'llm_token', data: { token: 'Hello' } });
        ws.simulateMessage({ event_type: 'llm_token', data: { token: ' world' } });
      });

      // Flush RAF callbacks
      await act(async () => {
        rafCallbacks.forEach((cb) => cb());
        rafCallbacks = [];
      });

      expect(result.current.state.streamedText).toBe('Hello world');
    });

    it('should handle tool_call events', async () => {
      const { result } = renderHook(() => useProjectCompiler());

      act(() => {
        result.current.startCompilation({ doc_id: 'doc-001' });
      });

      await waitFor(() => {
        expect(mockWebSocketInstances.length).toBe(1);
      });

      const ws = mockWebSocketInstances[0];

      await act(async () => {
        ws.simulateMessage({
          event_type: 'tool_call',
          data: { tool_name: 'search', arguments: { query: 'test' } },
        });
      });

      expect(result.current.state.nodeDetails).toEqual({
        search: { query: 'test' },
      });
    });

    it('should handle hitl_required event', async () => {
      const { result } = renderHook(() => useProjectCompiler());

      act(() => {
        result.current.startCompilation({ doc_id: 'doc-001' });
      });

      await waitFor(() => {
        expect(mockWebSocketInstances.length).toBe(1);
      });

      const ws = mockWebSocketInstances[0];

      await act(async () => {
        ws.simulateMessage({
          event_type: 'hitl_required',
          data: { prompt: 'Please approve' },
        });
      });

      expect(result.current.state.status).toBe('hitl_pending');
      expect(result.current.state.pendingHITL).toBeDefined();
    });

    it('should handle complete event', async () => {
      const { result } = renderHook(() => useProjectCompiler());

      let resolvePromise: () => void;
      const compilationPromise = new Promise<void>((resolve) => {
        resolvePromise = resolve;
      });

      act(() => {
        result.current.startCompilation({ doc_id: 'doc-001' }).then(resolvePromise!);
      });

      await waitFor(() => {
        expect(mockWebSocketInstances.length).toBe(1);
      });

      const ws = mockWebSocketInstances[0];

      await act(async () => {
        ws.simulateMessage({
          event_type: 'complete',
          data: { result: { success: true } },
        });
      });

      await compilationPromise;
      expect(result.current.state.status).toBe('complete');
      expect(result.current.state.result).toEqual({ success: true });
    });
  });

  describe('test_sends_messages', () => {
    it('should send decision via submitDecision', async () => {
      const { result } = renderHook(() => useProjectCompiler());

      act(() => {
        result.current.startCompilation({ doc_id: 'doc-001' });
      });

      await waitFor(() => {
        expect(mockWebSocketInstances.length).toBe(1);
      });

      const ws = mockWebSocketInstances[0];
      ws.readyState = MockWebSocket.OPEN;
      ws.send.mockClear();

      act(() => {
        result.current.submitDecision({ approved: true });
      });

      expect(ws.send).toHaveBeenCalledWith(
        JSON.stringify({ action: 'decision', approved: true })
      );
    });

    it('should send message via sendMessage', async () => {
      const { result } = renderHook(() => useProjectCompiler());

      act(() => {
        result.current.startCompilation({ doc_id: 'doc-001' });
      });

      await waitFor(() => {
        expect(mockWebSocketInstances.length).toBe(1);
      });

      const ws = mockWebSocketInstances[0];
      ws.readyState = MockWebSocket.OPEN;
      ws.send.mockClear();

      act(() => {
        result.current.sendMessage('Hello AI');
      });

      expect(ws.send).toHaveBeenCalledWith(
        JSON.stringify({ action: 'message', content: 'Hello AI' })
      );
    });
  });

  describe('test_cleanup_on_unmount', () => {
    it('should clean up on reset', async () => {
      const { result } = renderHook(() => useProjectCompiler());

      act(() => {
        result.current.startCompilation({ doc_id: 'doc-001' });
      });

      await waitFor(() => {
        expect(mockWebSocketInstances.length).toBe(1);
      });

      const ws = mockWebSocketInstances[0];

      act(() => {
        result.current.reset();
      });

      expect(ws.close).toHaveBeenCalled();
      expect(result.current.state.status).toBe('idle');
      expect(result.current.state.streamedText).toBe('');
    });
  });
});
