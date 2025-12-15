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

interface GuideStore {
  // UI State
  isOpen: boolean;
  hasUnread: boolean;

  // Conversation
  messages: GuideMessage[];
  threadId: string | null;

  // Context
  currentPage: string;
  pageContext: PageContext | null;

  // Connection state
  isGenerating: boolean;

  // Actions
  toggle: () => void;
  open: () => void;
  close: () => void;
  addMessage: (msg: GuideMessage) => void;
  clearMessages: () => void;
  setPageContext: (ctx: PageContext) => void;
  setGenerating: (generating: boolean) => void;
  markAsRead: () => void;
}

export const useGuideStore = create<GuideStore>()(
  persist(
    (set, get) => ({
      // Initial state
      isOpen: false,
      hasUnread: false,
      messages: [],
      threadId: null,
      currentPage: "",
      pageContext: null,
      isGenerating: false,

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
