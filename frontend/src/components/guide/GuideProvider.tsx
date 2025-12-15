"use client";

import { useEffect, useCallback, useState } from "react";
import { usePathname } from "next/navigation";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useGuideStore } from "@/stores/guideStore";
import { GuideButton } from "./GuideButton";
import { GuidePanel } from "./GuidePanel";
import type { GuideMessage, PageContext } from "@/stores/guideStore";

interface GuideProviderProps {
  children: React.ReactNode;
}

/**
 * Get contextual suggestions based on the current page
 */
function getSuggestionsForPage(pathname: string): string[] {
  if (pathname.includes("/videos")) {
    return [
      "How do I upload a video?",
      "How does video processing work?",
      "What video formats are supported?",
    ];
  }
  if (pathname.includes("/manuals")) {
    return [
      "How do I export a manual?",
      "How can I edit documentation?",
      "What languages are available?",
    ];
  }
  if (pathname.includes("/projects")) {
    return [
      "How do I create a project?",
      "How do I organize manuals?",
      "How do I compile a project?",
    ];
  }
  if (pathname.includes("/dashboard")) {
    return [
      "Show me how to get started",
      "What can I do with vDocs?",
      "How do I create documentation?",
    ];
  }
  return [
    "How do I get started?",
    "What features are available?",
    "Show me around the app",
  ];
}

/**
 * Get page title from pathname
 */
function getPageTitle(pathname: string): string {
  if (pathname.includes("/videos")) return "Videos";
  if (pathname.includes("/manuals")) return "Manuals";
  if (pathname.includes("/projects")) return "Projects";
  if (pathname.includes("/templates")) return "Templates";
  if (pathname.includes("/trash")) return "Trash";
  if (pathname.includes("/profile")) return "Profile";
  if (pathname.includes("/dashboard")) return "Dashboard";
  return "vDocs";
}

/**
 * Provider component that wraps the dashboard layout
 * Provides the guide agent functionality throughout the app
 */
export function GuideProvider({ children }: GuideProviderProps) {
  const pathname = usePathname();
  const { addMessage, clearMessages, setPageContext, messages } = useGuideStore();
  const [suggestions, setSuggestions] = useState<string[]>([]);

  // Update page context when pathname changes
  useEffect(() => {
    const pageTitle = getPageTitle(pathname);
    const contextualSuggestions = getSuggestionsForPage(pathname);

    const context: PageContext = {
      currentPage: pathname,
      pageTitle,
      availableActions: [], // Will be populated by page-specific hooks in Phase 2
      pageState: {},
    };

    setPageContext(context);
    setSuggestions(contextualSuggestions);
  }, [pathname, setPageContext]);

  // Show greeting message if chat is empty
  useEffect(() => {
    if (messages.length === 0) {
      const greetingMessage: GuideMessage = {
        id: `msg_${Date.now()}`,
        role: "assistant",
        content: "Welcome to vDocs! I'm your documentation assistant. I can help you upload videos, create manuals, organize projects, and navigate the app. What would you like to do today?",
        timestamp: new Date(),
        suggestions: getSuggestionsForPage(pathname),
      };
      addMessage(greetingMessage);
    }
  }, []); // Only run once on mount

  const handleSendMessage = useCallback(
    async (content: string) => {
      const { pageContext, setGenerating, addMessage: addMsg } = useGuideStore.getState();

      // Add user message
      const userMessage: GuideMessage = {
        id: `msg_${Date.now()}`,
        role: "user",
        content,
        timestamp: new Date(),
      };
      addMsg(userMessage);

      // Set generating state
      setGenerating(true);

      // Stream response from API
      let assistantContent = "";
      const assistantMessageId = `msg_${Date.now()}_assistant`;

      try {
        const { streamGuideChat } = await import("@/lib/guide-api");

        await streamGuideChat(
          {
            message: content,
            page_context: pageContext,
          },
          (chunk: string) => {
            // Accumulate chunks
            assistantContent += chunk;

            // Update or create assistant message
            const { messages } = useGuideStore.getState();
            const existingMessage = messages.find((m) => m.id === assistantMessageId);

            if (existingMessage) {
              // Update existing message
              useGuideStore.setState({
                messages: messages.map((m) =>
                  m.id === assistantMessageId
                    ? { ...m, content: assistantContent }
                    : m
                ),
              });
            } else {
              // Create new message
              addMsg({
                id: assistantMessageId,
                role: "assistant",
                content: assistantContent,
                timestamp: new Date(),
              });
            }
          },
          () => {
            // Complete
            setGenerating(false);
          },
          (error: Error) => {
            // Error
            console.error("Guide chat error:", error);
            setGenerating(false);

            // Add error message
            addMsg({
              id: `msg_${Date.now()}_error`,
              role: "system",
              content: `Error: ${error.message}. Please try again.`,
              timestamp: new Date(),
            });
          }
        );
      } catch (error) {
        console.error("Failed to send message:", error);
        setGenerating(false);

        addMsg({
          id: `msg_${Date.now()}_error`,
          role: "system",
          content: "Failed to send message. Please check your connection and try again.",
          timestamp: new Date(),
        });
      }
    },
    []
  );

  const handleClearChat = useCallback(() => {
    clearMessages();
    // Re-add greeting message
    const greetingMessage: GuideMessage = {
      id: `msg_${Date.now()}`,
      role: "assistant",
      content: "Chat cleared. How can I help you?",
      timestamp: new Date(),
      suggestions: getSuggestionsForPage(pathname),
    };
    addMessage(greetingMessage);
  }, [clearMessages, addMessage, pathname]);

  return (
    <TooltipProvider delayDuration={0}>
      {children}
      <GuideButton />
      <GuidePanel
        onSendMessage={handleSendMessage}
        onClearChat={handleClearChat}
        suggestions={suggestions}
      />
    </TooltipProvider>
  );
}
