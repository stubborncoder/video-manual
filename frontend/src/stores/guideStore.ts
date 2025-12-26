/**
 * Zustand store for Guide Agent state management.
 * Manages the floating guide assistant chat, context awareness, and UI state.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface PageContext {
  currentPage: string;
  pageTitle: string;
  availableActions: string[];
  pageState: Record<string, unknown>;
  selectedItems?: {
    type: "video" | "manual" | "project";
    ids: string[];
  };
}

export interface GuideMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  suggestions?: string[];
}

export interface GuideHighlight {
  targetId: string;
  duration?: number; // ms, 0 or undefined = no auto-dismiss
  label?: string;
}

export interface PendingHighlight {
  target: string;
  duration: number;
}

export type PanelSize = "full" | "medium" | "compact";

// Modal state for informational modals shown by the guide
export interface GuideModalState {
  isOpen: boolean;
  title: string;
  content: string;
  type: "info" | "tip" | "warning" | "success";
  autoClose?: number; // ms, 0 = manual close
}

// Workflow/tour step
export interface WorkflowStep {
  title: string;
  description: string;
  highlight?: string; // Element ID to highlight
  navigate?: string; // Page path to navigate to
}

// Workflow/tour state
export interface WorkflowState {
  isActive: boolean;
  title: string;
  steps: WorkflowStep[];
  currentStepIndex: number;
}

interface GuideStore {
  // UI State
  isOpen: boolean;
  hasUnread: boolean;
  forceLeftPosition: boolean; // Force button to left side (when another copilot is active)
  panelSize: PanelSize; // Panel size: full, medium (1/3), or compact

  // Conversation
  messages: GuideMessage[];
  threadId: string | null;

  // Context
  currentPage: string;
  pageContext: PageContext | null;

  // Connection state
  isGenerating: boolean;

  // Highlights
  activeHighlights: GuideHighlight[];
  pendingHighlight: PendingHighlight | null; // Highlight waiting for animation to complete

  // Modal state (for show_modal action)
  modal: GuideModalState | null;

  // Workflow/tour state (for start_workflow action)
  workflow: WorkflowState | null;

  // Actions
  toggle: () => void;
  open: () => void;
  close: () => void;
  addMessage: (msg: GuideMessage) => void;
  clearMessages: () => void;
  setPageContext: (ctx: PageContext) => void;
  setGenerating: (generating: boolean) => void;
  markAsRead: () => void;
  setForceLeftPosition: (force: boolean) => void;

  // Panel size actions
  setFull: () => void;
  setMedium: () => void;
  setCompact: () => void;

  // Highlight actions
  showHighlight: (targetId: string, duration?: number, label?: string) => void;
  clearHighlight: (targetId: string) => void;
  clearAllHighlights: () => void;
  setPendingHighlight: (highlight: PendingHighlight | null) => void;
  applyPendingHighlight: () => void; // Apply pending highlight after animation

  // Modal actions
  showModal: (title: string, content: string, type?: "info" | "tip" | "warning" | "success", autoClose?: number) => void;
  hideModal: () => void;

  // Workflow actions
  startWorkflow: (title: string, steps: WorkflowStep[]) => void;
  nextWorkflowStep: () => void;
  previousWorkflowStep: () => void;
  cancelWorkflow: () => void;

  // Element interaction
  clickElement: (elementId: string) => void;
}

export const useGuideStore = create<GuideStore>()(
  persist(
    (set, get) => ({
      // Initial state
      isOpen: false,
      hasUnread: false,
      forceLeftPosition: false,
      panelSize: "full",
      messages: [],
      threadId: null,
      currentPage: "",
      pageContext: null,
      isGenerating: false,
      activeHighlights: [],
      pendingHighlight: null,
      modal: null,
      workflow: null,

      // Actions
      toggle: () => {
        const { isOpen } = get();
        set({ isOpen: !isOpen, hasUnread: false, panelSize: "full" });
      },

      open: () => {
        set({ isOpen: true, hasUnread: false, panelSize: "full" });
      },

      close: () => {
        set({ isOpen: false, panelSize: "full" });
      },

      addMessage: (msg: GuideMessage) => {
        const { messages, isOpen } = get();
        set({
          messages: [...messages, msg],
          // Mark as unread if panel is closed and message is from assistant
          hasUnread: !isOpen && msg.role === "assistant",
        });
      },

      clearMessages: () => {
        set({ messages: [], threadId: null });
      },

      setPageContext: (ctx: PageContext) => {
        set({ currentPage: ctx.currentPage, pageContext: ctx });
      },

      setGenerating: (generating: boolean) => {
        set({ isGenerating: generating });
      },

      markAsRead: () => {
        set({ hasUnread: false });
      },

      setForceLeftPosition: (force: boolean) => {
        set({ forceLeftPosition: force });
      },

      // Panel size actions
      setFull: () => {
        set({ panelSize: "full" });
      },

      setMedium: () => {
        set({ panelSize: "medium" });
      },

      setCompact: () => {
        set({ panelSize: "compact" });
      },

      // Highlight actions
      showHighlight: (targetId: string, duration?: number, label?: string) => {
        const { activeHighlights } = get();
        // Remove existing highlight with same targetId if present
        const filtered = activeHighlights.filter((h) => h.targetId !== targetId);
        set({
          activeHighlights: [
            ...filtered,
            { targetId, duration: duration ?? 3000, label },
          ],
        });
      },

      clearHighlight: (targetId: string) => {
        const { activeHighlights } = get();
        set({
          activeHighlights: activeHighlights.filter(
            (h) => h.targetId !== targetId
          ),
        });
      },

      clearAllHighlights: () => {
        set({ activeHighlights: [] });
      },

      setPendingHighlight: (highlight: PendingHighlight | null) => {
        set({ pendingHighlight: highlight });
      },

      applyPendingHighlight: () => {
        const { pendingHighlight, activeHighlights } = get();
        if (pendingHighlight) {
          // Remove existing highlight with same targetId if present
          const filtered = activeHighlights.filter(
            (h) => h.targetId !== pendingHighlight.target
          );
          set({
            activeHighlights: [
              ...filtered,
              {
                targetId: pendingHighlight.target,
                duration: pendingHighlight.duration,
              },
            ],
            pendingHighlight: null,
          });
        }
      },

      // Modal actions
      showModal: (title: string, content: string, type: "info" | "tip" | "warning" | "success" = "info", autoClose?: number) => {
        set({
          modal: {
            isOpen: true,
            title,
            content,
            type,
            autoClose,
          },
        });
      },

      hideModal: () => {
        set({ modal: null });
      },

      // Workflow actions
      startWorkflow: (title: string, steps: WorkflowStep[]) => {
        set({
          workflow: {
            isActive: true,
            title,
            steps,
            currentStepIndex: 0,
          },
          panelSize: "medium", // Resize panel to make room for workflow overlay
        });
      },

      nextWorkflowStep: () => {
        const { workflow } = get();
        if (!workflow) return;

        const nextIndex = workflow.currentStepIndex + 1;
        if (nextIndex >= workflow.steps.length) {
          // Workflow complete
          set({ workflow: null });
          return;
        }

        set({
          workflow: {
            ...workflow,
            currentStepIndex: nextIndex,
          },
        });
      },

      previousWorkflowStep: () => {
        const { workflow } = get();
        if (!workflow || workflow.currentStepIndex === 0) return;

        set({
          workflow: {
            ...workflow,
            currentStepIndex: workflow.currentStepIndex - 1,
          },
        });
      },

      cancelWorkflow: () => {
        set({ workflow: null });
      },

      // Element interaction
      clickElement: (elementId: string) => {
        console.log("[guideStore] clickElement called with:", elementId);
        // First try the guide registry for controlled components
        import("@/lib/guide-registry").then(({ handleGuideClick }) => {
          console.log("[guideStore] Trying handleGuideClick for:", elementId);
          if (handleGuideClick(elementId)) {
            console.log("[guideStore] Registry handled:", elementId);
            return; // Registry handled it
          }
          console.log("[guideStore] Falling back to DOM click for:", elementId);
          // Fallback: Find and click the element by data-guide-id
          const element = document.querySelector(`[data-guide-id="${elementId}"]`) as HTMLElement;
          if (element && element.click) {
            console.log("[guideStore] Found element, clicking:", elementId);
            element.click();
          } else {
            console.log("[guideStore] Element not found:", elementId);
          }
        });
      },
    }),
    {
      name: "guide-storage",
      partialize: (state) => ({
        // Only persist messages and threadId
        messages: state.messages,
        threadId: state.threadId,
      }),
    }
  )
);
