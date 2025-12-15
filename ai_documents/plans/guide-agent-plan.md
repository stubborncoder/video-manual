# vDocs Guide Agent - Comprehensive Implementation Plan

## Executive Summary

This plan outlines the creation of an innovative, floating AI assistant for vDocs that provides contextual help, guides users through tasks, and can interact with the UI on their behalf. The implementation leverages existing patterns in the codebase including the `@assistant-ui/react` components, Zustand state management, and the established WebSocket architecture.

---

## 1. UI Design

### 1.1 Floating Button/Avatar

**Position:** Bottom-right corner of the viewport, floating above all content

```
Design Specifications:
- Position: fixed, bottom: 24px, right: 24px
- Size: 56px diameter (idle), scales to 64px on hover
- Z-index: 50 (above page content, below modals)
- Animation: Gentle pulse effect when there are suggestions
```

**Visual Design:**
- Circular button with the vDocs primary color gradient background
- Icon: Use a friendly bot/assistant icon from `lucide-react` (e.g., `Bot`, `Sparkles`, or custom SVG)
- Badge indicator for unread messages/suggestions (red dot with count)
- Subtle shadow for elevation

**States:**
1. **Idle** - Standard appearance with subtle hover effect
2. **Active/Open** - Slight scale up, chat panel visible
3. **Has Notification** - Pulsing badge with notification count
4. **Thinking** - Animated loading indicator

### 1.2 Chat Panel Expansion

**Expansion Behavior:**
- Opens as a slide-up panel from the button position
- Size: 400px width x 600px height (desktop), full-screen on mobile
- Animation: Spring-based animation using `motion/react` (already in dependencies)

**Panel Layout:**
```
+------------------------------------------+
|  [vDocs Guide]              [Minimize] X |
+------------------------------------------+
|                                          |
|  Message Area (ScrollArea)               |
|  - User messages (right-aligned)         |
|  - Assistant messages (left-aligned)     |
|  - Action cards (highlight, navigate)    |
|  - Tool call indicators                  |
|                                          |
+------------------------------------------+
|  Context chip: "Viewing: Videos Page"    |
+------------------------------------------+
|  [Suggestion chips...]                   |
+------------------------------------------+
|  [ Type your question...        ] [Send] |
+------------------------------------------+
```

### 1.3 Visual Design System

Following existing patterns from the codebase:
- Use `@/components/ui/` primitives (Button, ScrollArea, Badge, Tooltip, Avatar)
- Colors from the existing theme (primary, muted, destructive, etc.)
- Typography: DM Sans for body, DM Serif Display for headers
- Dark mode support via `next-themes` (already configured)

---

## 2. Client-side Tools

### 2.1 Navigation Tool

```typescript
interface NavigateToolArgs {
  page: "dashboard" | "videos" | "manuals" | "projects" | "templates" | "trash" | "profile";
  params?: Record<string, string>;  // e.g., { id: "manual-123" }
}
```

**Implementation:**
- Uses Next.js `useRouter` for client-side navigation
- Provides feedback in chat: "Navigating to Videos page..."
- Can include URL params for deep linking

### 2.2 UI Highlighting Tool

```typescript
interface HighlightToolArgs {
  selector: string;           // CSS selector or data-attribute
  message?: string;           // Tooltip message to show
  duration?: number;          // How long to highlight (ms)
  style?: "pulse" | "outline" | "spotlight";
}
```

**Implementation:**
- Creates an overlay element with pointer-events: none
- Uses `getBoundingClientRect()` to position around target
- Spotlight mode dims the rest of the page
- Auto-dismiss after duration or on user click

### 2.3 Dialog/Modal Control Tool

```typescript
interface OpenDialogToolArgs {
  dialogId: string;           // Registered dialog ID
  props?: Record<string, unknown>;
}
```

**Pre-registered dialogs:**
- `upload-video` - Video upload dialog
- `create-project` - New project dialog
- `export-manual` - Export dialog with options
- `compile-project` - Compilation settings
- `process-video` - Video processing dialog

### 2.4 Form Fill Tool

```typescript
interface FillFormToolArgs {
  fields: Array<{
    selector: string;
    value: string | number | boolean;
  }>;
  requireConfirmation?: boolean;  // Default: true
}
```

**Implementation:**
- Shows preview of changes before applying
- User must confirm with "Apply" button
- Handles input, textarea, select, checkbox elements
- Dispatches proper React events for controlled components

### 2.5 Action Trigger Tool

```typescript
interface TriggerActionToolArgs {
  action:
    | "upload-video"
    | "process-video"
    | "export-manual"
    | "create-project"
    | "compile-project"
    | "evaluate-manual";
  params?: Record<string, unknown>;
  requireConfirmation?: boolean;
}
```

### 2.6 Tooltip/Annotation Tool

```typescript
interface ShowAnnotationToolArgs {
  annotations: Array<{
    selector: string;
    content: string;
    position?: "top" | "bottom" | "left" | "right";
  }>;
  sequential?: boolean;  // Show one at a time
}
```

---

## 3. Context Awareness

### 3.1 Page Context Provider

Create a React context that tracks the current page and available actions:

```typescript
interface PageContext {
  currentPage: string;
  pageTitle: string;
  availableActions: string[];
  pageState: Record<string, unknown>;
  selectedItems?: {
    type: "video" | "manual" | "project";
    ids: string[];
  };
}
```

**Implementation Location:** `/frontend/src/components/providers/GuideContextProvider.tsx`

### 3.2 State Access

Leverage existing Zustand stores:
- `authStore` - User info, authentication status
- `jobsStore` - Processing jobs, status

Create new store: `guideStore.ts`
```typescript
interface GuideState {
  isOpen: boolean;
  messages: ChatMessage[];
  currentContext: PageContext;
  pendingActions: PendingAction[];
  highlightedElements: HighlightedElement[];

  // Actions
  openGuide: () => void;
  closeGuide: () => void;
  setContext: (context: PageContext) => void;
  addMessage: (message: ChatMessage) => void;
  executeAction: (action: PendingAction) => void;
}
```

### 3.3 Context Detection Strategy

Each page exports a context hook:

```typescript
// In each page component
export function usePageContext(): PageContext {
  const router = useRouter();
  const pathname = usePathname();

  return {
    currentPage: pathname,
    pageTitle: "Videos",
    availableActions: ["upload", "process", "delete", "filter"],
    pageState: {
      videoCount: videos.length,
      filterActive: !!filterProjectId,
      // ... other relevant state
    }
  };
}
```

---

## 4. Conversation Flow

### 4.1 Greeting and Onboarding

**First-time users:**
```
"Welcome to vDocs! I'm your documentation assistant.
I can help you:
- Upload and process videos into manuals
- Navigate the app and find features
- Answer questions about your documentation

What would you like to do today?"
```

**Returning users:**
```
"Welcome back! You have 3 videos ready to process.
Would you like me to help you create documentation?"
```

### 4.2 Contextual Suggestions

Based on current page, show relevant quick actions:

**Videos Page:**
- "Upload a new video"
- "Process selected video"
- "How does video processing work?"

**Manuals Page:**
- "Export this manual"
- "Evaluate documentation quality"
- "Add another language"

**Projects Page:**
- "Create a new project"
- "Compile project documentation"
- "Organize chapters"

### 4.3 Common Question Templates

Store pre-defined Q&A pairs for immediate responses:
- "How do I upload a video?" -> Show step-by-step with highlights
- "What formats can I export?" -> List formats with actions
- "How long does processing take?" -> Explain the pipeline

### 4.4 Human Handoff

When the agent cannot help:
```
"I'm not able to help with this specific issue.
Would you like to:
- [Search our documentation]
- [Contact support]
- [Report a bug]"
```

---

## 5. Technical Architecture

### 5.1 Component Structure

```
frontend/src/
├── components/
│   └── guide/
│       ├── GuideProvider.tsx       # Context provider
│       ├── GuideButton.tsx         # Floating button
│       ├── GuidePanel.tsx          # Chat panel
│       ├── GuideMessage.tsx        # Individual message
│       ├── GuideSuggestions.tsx    # Quick action chips
│       ├── HighlightOverlay.tsx    # Element highlighting
│       ├── ActionConfirmation.tsx  # Confirmation dialogs
│       └── tools/
│           ├── navigate.ts
│           ├── highlight.ts
│           ├── openDialog.ts
│           ├── fillForm.ts
│           └── triggerAction.ts
├── stores/
│   └── guideStore.ts              # Zustand store
├── hooks/
│   └── useGuideAgent.ts           # WebSocket + LLM integration
└── lib/
    └── guide-tools.ts             # Tool definitions for LLM
```

### 5.2 State Management

Use Zustand following existing patterns:

```typescript
// /frontend/src/stores/guideStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface GuideStore {
  // UI State
  isOpen: boolean;
  isMinimized: boolean;
  hasUnread: boolean;

  // Conversation
  messages: GuideMessage[];
  threadId: string | null;

  // Context
  currentPage: string;
  pageContext: PageContext | null;

  // Pending Actions
  pendingHighlights: HighlightConfig[];
  pendingConfirmation: ActionConfirmation | null;

  // Actions
  toggle: () => void;
  minimize: () => void;
  addMessage: (msg: GuideMessage) => void;
  clearMessages: () => void;
  setPageContext: (ctx: PageContext) => void;
  showHighlight: (config: HighlightConfig) => void;
  clearHighlights: () => void;
  requestConfirmation: (action: ActionConfirmation) => void;
  confirmAction: () => void;
  cancelAction: () => void;
}
```

### 5.3 API Integration

**Option A: Direct LLM API (Recommended for Phase 1)**
- Use Claude API directly from the backend
- Implement as a new FastAPI endpoint: `/api/guide/chat`
- Stream responses using SSE (Server-Sent Events)

**Option B: LangGraph Agent (Recommended for Phase 3+)**
- Create a new LangGraph agent for the guide
- WebSocket connection similar to existing editor copilot
- Tool execution through structured outputs

**Endpoint Design:**
```python
# Backend: /api/guide/chat
@router.post("/guide/chat")
async def guide_chat(
    request: GuideChatRequest,
    user_id: str = Depends(get_current_user)
):
    """Stream guide responses with tool calls."""
    return StreamingResponse(
        generate_guide_response(request, user_id),
        media_type="text/event-stream"
    )
```

### 5.4 Tool Execution Framework

```typescript
// /frontend/src/lib/guide-tools.ts

type ToolName =
  | "navigate"
  | "highlight_element"
  | "open_dialog"
  | "fill_form"
  | "trigger_action"
  | "show_annotation";

interface ToolCall {
  name: ToolName;
  arguments: Record<string, unknown>;
}

interface ToolExecutor {
  name: ToolName;
  execute: (args: Record<string, unknown>) => Promise<ToolResult>;
  requiresConfirmation?: boolean;
}

const toolExecutors: Record<ToolName, ToolExecutor> = {
  navigate: {
    name: "navigate",
    execute: async ({ page, params }) => {
      router.push(buildPath(page, params));
      return { success: true };
    },
    requiresConfirmation: false,
  },
  highlight_element: {
    name: "highlight_element",
    execute: async ({ selector, message, duration, style }) => {
      guideStore.getState().showHighlight({ selector, message, duration, style });
      return { success: true };
    },
    requiresConfirmation: false,
  },
  // ... other tools
};
```

---

## 6. Implementation Phases

### Phase 1: Basic Chat with Page Context

**Deliverables:**
1. `GuideButton` - Floating button component
2. `GuidePanel` - Basic chat interface
3. `GuideProvider` - Context provider in layout
4. `guideStore.ts` - Basic Zustand store
5. `/api/guide/chat` - Backend endpoint
6. Page context hooks for main pages

**Features:**
- Open/close chat panel
- Send messages and receive responses
- Display current page context
- Basic greeting and suggestions
- Message persistence (session-based)

### Phase 2: UI Highlighting and Navigation

**Deliverables:**
1. `HighlightOverlay` component
2. Navigation tool implementation
3. Highlight tool implementation
4. Annotation tool implementation
5. Tool call rendering in chat

**Features:**
- Navigate to any page via chat
- Highlight UI elements on request
- Show tooltips/annotations
- Sequential guided tours
- "Show me where X is" functionality

### Phase 3: Action Execution with Confirmation

**Deliverables:**
1. `ActionConfirmation` dialog
2. Dialog control tool
3. Form fill tool
4. Action trigger tool
5. Action preview system

**Features:**
- Open dialogs via chat
- Fill forms with confirmation
- Trigger actions (upload, export, etc.)
- Preview changes before applying
- Undo recent actions

### Phase 4: Proactive Suggestions

**Deliverables:**
1. Activity tracking system
2. Suggestion engine
3. Notification system
4. Onboarding flow

**Features:**
- First-time user onboarding tour
- Proactive tips based on user behavior
- "You might want to try..." suggestions
- Idle-time helpful hints
- Feature discovery prompts

---

## 7. System Prompt for Guide Agent

```
You are a helpful documentation assistant for vDocs, an AI-powered application that creates step-by-step documentation from videos.

## Your Role
- Help users navigate the application
- Explain features and workflows
- Guide users through tasks step-by-step
- Execute actions on behalf of users (with permission)

## Available Pages
- Dashboard: Overview of recent activity
- Videos: Upload and manage source videos
- Manuals: View and edit generated documentation
- Projects: Organize manuals into collections
- Templates: Manage export templates
- Trash: Recover deleted items

## Available Tools
1. navigate(page, params) - Go to a specific page
2. highlight_element(selector, message) - Highlight a UI element
3. open_dialog(dialogId, props) - Open a modal dialog
4. fill_form(fields) - Fill form fields (requires confirmation)
5. trigger_action(action, params) - Execute an action
6. show_annotation(annotations) - Show helpful tooltips

## Guidelines
- Be concise but helpful
- Use tools to show rather than just tell
- Always explain what you're about to do
- Ask for confirmation before executing actions
- Provide relevant suggestions based on context

## Current Context
Page: {current_page}
Available Actions: {available_actions}
User State: {user_state}
```

---

## 8. Critical Files for Implementation

- `/frontend/src/app/dashboard/layout.tsx` - Dashboard layout where GuideProvider should be added as a wrapper around existing DashboardContent
- `/frontend/src/stores/authStore.ts` - Pattern to follow for creating guideStore.ts with Zustand
- `/frontend/src/hooks/useEditorCopilot.ts` - WebSocket and chat state management pattern to follow for the guide agent hook
- `/frontend/src/components/editor/CopilotPanel.tsx` - Chat UI pattern to follow for the guide panel design
- `/frontend/src/components/ui/sheet.tsx` - Full-page panel pattern that could be adapted for the guide panel on mobile
