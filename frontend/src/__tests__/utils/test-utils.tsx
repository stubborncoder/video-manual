/**
 * Test utilities for React component testing.
 * Provides custom render functions with providers and mock utilities.
 */

import React, { ReactElement, ReactNode } from 'react';
import { render, RenderOptions, RenderResult } from '@testing-library/react';

// Mock Next.js router
const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  prefetch: jest.fn(),
  back: jest.fn(),
  forward: jest.fn(),
  refresh: jest.fn(),
  pathname: '/dashboard',
  query: {},
  asPath: '/dashboard',
  route: '/dashboard',
  basePath: '',
  isLocaleDomain: false,
  isReady: true,
  isPreview: false,
};

// Mock Next.js navigation
jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  usePathname: () => '/dashboard',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

// Mock Next.js Link
jest.mock('next/link', () => {
  return function MockLink({ children, href, ...props }: { children: ReactNode; href: string }) {
    return <a href={href} {...props}>{children}</a>;
  };
});

// Mock Next.js Image
jest.mock('next/image', () => {
  return function MockImage({ src, alt, ...props }: { src: string; alt: string }) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} {...props} />;
  };
});

/**
 * Wrapper component with all providers.
 */
interface AllProvidersProps {
  children: ReactNode;
}

function AllProviders({ children }: AllProvidersProps): ReactElement {
  return (
    <>
      {children}
    </>
  );
}

/**
 * Custom render function that wraps components with all providers.
 */
function customRender(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
): RenderResult {
  return render(ui, { wrapper: AllProviders, ...options });
}

/**
 * Reset all mocks between tests.
 */
export function resetMocks(): void {
  jest.clearAllMocks();
  mockRouter.push.mockClear();
  mockRouter.replace.mockClear();
  mockRouter.prefetch.mockClear();
  mockRouter.back.mockClear();
}

/**
 * Get the mock router for assertions.
 */
export function getMockRouter() {
  return mockRouter;
}

/**
 * Wait for async operations to complete.
 */
export async function waitForAsync(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Create a mock WebSocket for testing.
 */
export function createMockWebSocket() {
  const handlers: { [key: string]: ((event: MessageEvent) => void)[] } = {
    open: [],
    message: [],
    close: [],
    error: [],
  };

  const mockWs = {
    readyState: WebSocket.CONNECTING,
    send: jest.fn(),
    close: jest.fn(),
    addEventListener: jest.fn((event: string, handler: (event: MessageEvent) => void) => {
      if (!handlers[event]) handlers[event] = [];
      handlers[event].push(handler);
    }),
    removeEventListener: jest.fn((event: string, handler: (event: MessageEvent) => void) => {
      if (handlers[event]) {
        handlers[event] = handlers[event].filter((h) => h !== handler);
      }
    }),
    // Simulate events
    simulateOpen: () => {
      mockWs.readyState = WebSocket.OPEN;
      handlers.open?.forEach((h) => h(new Event('open') as any));
    },
    simulateMessage: (data: any) => {
      const event = new MessageEvent('message', { data: JSON.stringify(data) });
      handlers.message?.forEach((h) => h(event));
    },
    simulateClose: (code = 1000, reason = '') => {
      mockWs.readyState = WebSocket.CLOSED;
      handlers.close?.forEach((h) => h(new CloseEvent('close', { code, reason }) as any));
    },
    simulateError: () => {
      handlers.error?.forEach((h) => h(new Event('error') as any));
    },
  };

  return mockWs;
}

/**
 * Create a mock SSE EventSource for testing.
 */
export function createMockEventSource() {
  const handlers: { [key: string]: ((event: MessageEvent) => void)[] } = {};

  const mockEs = {
    readyState: EventSource.CONNECTING,
    close: jest.fn(),
    addEventListener: jest.fn((event: string, handler: (event: MessageEvent) => void) => {
      if (!handlers[event]) handlers[event] = [];
      handlers[event].push(handler);
    }),
    removeEventListener: jest.fn(),
    // Simulate events
    simulateOpen: () => {
      mockEs.readyState = EventSource.OPEN;
      handlers.open?.forEach((h) => h(new Event('open') as any));
    },
    simulateMessage: (data: any, event = 'message') => {
      const msgEvent = new MessageEvent(event, { data: JSON.stringify(data) });
      handlers[event]?.forEach((h) => h(msgEvent));
    },
    simulateError: () => {
      handlers.error?.forEach((h) => h(new Event('error') as any));
    },
  };

  return mockEs;
}

// Re-export everything from testing-library
export * from '@testing-library/react';

// Override render with custom render
export { customRender as render };
