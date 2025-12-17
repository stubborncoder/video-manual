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

interface GuideStore {
  // UI State
  isOpen: boolean;
  hasUnread: boolean;
  forceLeftPosition: boolean; // Force button to left side (when another copilot is active)

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

  // Highlight actions
  showHighlight: (targetId: string, duration?: number, label?: string) => void;
  clearHighlight: (targetId: string) => void;
  clearAllHighlights: () => void;
}

export const useGuideStore = create<GuideStore>()(
  persist(
    (set, get) => ({
      // Initial state
      isOpen: false,
      hasUnread: false,
      forceLeftPosition: false,
      messages: [],
      threadId: null,
      currentPage: "",
      pageContext: null,
      isGenerating: false,
      activeHighlights: [],

      // Actions
      toggle: () => {
        const { isOpen } = get();
        set({ isOpen: !isOpen, hasUnread: false });
      },

      open: () => {
        set({ isOpen: true, hasUnread: false });
      },

      close: () => {
        set({ isOpen: false });
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
