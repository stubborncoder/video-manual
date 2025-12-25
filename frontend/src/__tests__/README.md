# Frontend Test Suite

This directory and co-located `__tests__` folders contain the frontend test suite for the vDocs platform. Tests are written using Jest with React Testing Library.

## Test Statistics

- **Total Tests**: 448
- **Test Files**: 17
- **Skipped**: 2

## Directory Structure

Tests follow a co-location pattern, with `__tests__` folders alongside the code they test:

```
frontend/src/
├── __tests__/                    # Global tests (hooks, stores)
│   ├── README.md                 # This file
│   ├── hooks/                    # Custom hook tests
│   │   ├── useAutoSave.test.ts
│   │   ├── useEditorCopilot.test.ts
│   │   ├── useKeyboardShortcuts.test.ts
│   │   ├── useTextSelection.test.ts
│   │   ├── useUndoRedo.test.ts
│   │   └── useWebSocket.test.ts
│   ├── stores/                   # Zustand store tests
│   │   ├── authStore.test.ts
│   │   ├── guideStore.test.ts
│   │   └── jobsStore.test.ts
│   └── utils/                    # Test utilities
│       ├── mocks.ts              # Shared mocks
│       └── test-utils.tsx        # Custom render helpers
├── app/
│   └── dashboard/projects/
│       └── __tests__/
│           └── page.test.tsx     # Projects page tests
├── components/
│   ├── editor/
│   │   └── __tests__/
│   │       └── CopilotPanel.test.tsx
│   ├── guide/
│   │   └── __tests__/
│   │       └── GuidePanel.test.tsx
│   ├── layout/
│   │   └── __tests__/
│   │       └── Sidebar.test.tsx
│   └── ui/
│       └── __tests__/
│           ├── alert-dialog.test.tsx
│           └── dialog.test.tsx
└── lib/
    └── __tests__/
        ├── api.test.ts           # API client tests
        └── utils.test.ts         # Utility function tests
```

## Test Categories

### Hook Tests (`__tests__/hooks/`)
Tests for custom React hooks:
- **useAutoSave**: Auto-save functionality with debouncing
- **useEditorCopilot**: AI copilot integration
- **useKeyboardShortcuts**: Keyboard shortcut handling
- **useTextSelection**: Text selection tracking
- **useUndoRedo**: Undo/redo state management with localStorage persistence
- **useWebSocket**: WebSocket connection management

### Store Tests (`__tests__/stores/`)
Tests for Zustand state stores:
- **authStore**: Authentication state, login/logout
- **guideStore**: Guide panel state
- **jobsStore**: Background job tracking

### Component Tests
Tests for React components:
- **CopilotPanel**: AI assistant panel interactions
- **GuidePanel**: User guide rendering
- **Sidebar**: Navigation, user menu, collapsible state
- **AlertDialog**: Confirmation dialogs
- **Dialog**: Modal dialogs

### Page Tests
Tests for Next.js pages:
- **Projects Page**: Project listing, creation, deletion

### Library Tests (`lib/__tests__/`)
Tests for utility libraries:
- **api.ts**: API client, request handling, error responses
- **utils.ts**: Utility functions (cn, formatting, etc.)

## Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test -- useUndoRedo.test.ts

# Run tests in watch mode
npm test -- --watch

# Run tests matching pattern
npm test -- --testNamePattern="should handle"

# Update snapshots
npm test -- --updateSnapshot
```

## Test Utilities

### Custom Render (`utils/test-utils.tsx`)
Wraps components with required providers for testing.

### Shared Mocks (`utils/mocks.ts`)
Common mocks for:
- Next.js router
- Supabase client
- API client
- WebSocket

## Key Testing Patterns

### Mocking External Dependencies
```typescript
// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => '/dashboard',
}));

// Mock Radix UI components
jest.mock('@radix-ui/react-avatar', () => ({
  Root: ({ children }) => <div>{children}</div>,
}));
```

### Testing Hooks
```typescript
import { renderHook, act } from '@testing-library/react';

const { result } = renderHook(() => useMyHook());
act(() => {
  result.current.doSomething();
});
expect(result.current.value).toBe(expected);
```

### State Batching
When testing hooks with sequential state updates, use separate `act()` blocks:
```typescript
act(() => {
  result.current.firstAction();
});
act(() => {
  result.current.secondAction(); // Depends on first
});
```

## CI Integration

Tests run automatically on pull requests via GitHub Actions:
- Linting with ESLint
- Test execution with coverage
- Build verification

See `.github/workflows/ci.yml` for the workflow configuration.

## Known Limitations

1. **jsdom**: Some browser APIs (e.g., `isContentEditable`) require manual mocking
2. **ESM Modules**: Some packages (react-markdown) need explicit mocks
3. **Radix UI**: Avatar components don't render images without load events
