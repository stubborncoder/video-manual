"use client";

import { useEffect, useCallback, useState, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useGuideStore } from "@/stores/guideStore";
import { GuideButton } from "./GuideButton";
import { GuidePanel } from "./GuidePanel";
import { HighlightOverlay } from "./HighlightOverlay";
import type { GuideMessage, PageContext } from "@/stores/guideStore";
import type { GuideEvent } from "@/lib/guide-api";

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
  const router = useRouter();
  const { addMessage, clearMessages, setPageContext, messages, showHighlight, clearAllHighlights } = useGuideStore();
  const [suggestions, setSuggestions] = useState<string[]>([]);
  // Track if we've triggered any actions during current response
  const hasActionsRef = useRef<boolean>(false);

  // Update page context when pathname changes
  useEffect(() => {
    const pageTitle = getPageTitle(pathname);
    const contextualSuggestions = getSuggestionsForPage(pathname);

    const context: PageContext = {
      currentPage: pathname,
      pageTitle,
      availableActions: [],
      pageState: {},
    };

    setPageContext(context);
    setSuggestions(contextualSuggestions);

    // Clear highlights when navigating to a new page
    clearAllHighlights();
  }, [pathname, setPageContext, clearAllHighlights]);

  // Fetch initial greeting from backend when chat is empty
  // This allows the guide agent to check user profile and provide personalized greeting
  const hasInitialized = useRef(false);
  useEffect(() => {
    const initializeGreeting = async () => {
      if (messages.length === 0 && !hasInitialized.current) {
        hasInitialized.current = true;

        const { setGenerating, addMessage: addMsg } = useGuideStore.getState();
        setGenerating(true);

        let greetingContent = "";
        const greetingMessageId = `msg_${Date.now()}_greeting`;

        try {
          const { streamGuideChat } = await import("@/lib/guide-api");
          const pageTitle = getPageTitle(pathname);

          await streamGuideChat(
            {
              message: "Hello",
              page_context: {
                currentPage: pathname,
                pageTitle,
                availableActions: [],
                pageState: {},
              },
            },
            (token: string) => {
              greetingContent += token;

              const { messages: currentMessages } = useGuideStore.getState();
              const existingMessage = currentMessages.find((m) => m.id === greetingMessageId);

              if (existingMessage) {
                useGuideStore.setState({
                  messages: currentMessages.map((m) =>
                    m.id === greetingMessageId
                      ? { ...m, content: greetingContent }
                      : m
                  ),
                });
              } else {
                addMsg({
                  id: greetingMessageId,
                  role: "assistant",
                  content: greetingContent,
                  timestamp: new Date(),
                  suggestions: getSuggestionsForPage(pathname),
                });
              }
            },
            () => {}, // onAction - ignore actions during greeting
            () => {
              setGenerating(false);
            },
            (error: Error) => {
              console.error("Failed to get greeting:", error);
              setGenerating(false);
              // Fallback to static greeting if backend fails
              addMsg({
                id: greetingMessageId,
                role: "assistant",
                content: "Welcome to vDocs! How can I help you today?",
                timestamp: new Date(),
                suggestions: getSuggestionsForPage(pathname),
              });
            }
          );
        } catch (error) {
          console.error("Failed to initialize guide:", error);
          setGenerating(false);
          // Fallback to static greeting
          addMsg({
            id: `msg_${Date.now()}_greeting`,
            role: "assistant",
            content: "Welcome to vDocs! How can I help you today?",
            timestamp: new Date(),
            suggestions: getSuggestionsForPage(pathname),
          });
        }
      }
    };

    initializeGreeting();
  }, []); // Only run once on mount

  const handleSendMessage = useCallback(
    async (content: string) => {
      const { pageContext, setGenerating, addMessage: addMsg, showHighlight: highlight } = useGuideStore.getState();

      // Clear previous highlights and reset tracking
      clearAllHighlights();
      hasActionsRef.current = false;

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

      // Create assistant message for streaming
      let assistantContent = "";
      const assistantMessageId = `msg_${Date.now()}_assistant`;

      try {
        const { streamGuideChat } = await import("@/lib/guide-api");

        await streamGuideChat(
          {
            message: content,
            page_context: pageContext,
          },
          // onToken - handle text chunks
          (token: string) => {
            assistantContent += token;

            // Update or create assistant message
            const { messages } = useGuideStore.getState();
            const existingMessage = messages.find((m) => m.id === assistantMessageId);

            if (existingMessage) {
              useGuideStore.setState({
                messages: messages.map((m) =>
                  m.id === assistantMessageId
                    ? { ...m, content: assistantContent }
                    : m
                ),
              });
            } else {
              addMsg({
                id: assistantMessageId,
                role: "assistant",
                content: assistantContent,
                timestamp: new Date(),
              });
            }
          },
          // onAction - handle action events
          (event: GuideEvent) => {
            if (event.action === "highlight" && event.target) {
              hasActionsRef.current = true;
              highlight(event.target, event.duration || 5000);
            } else if (event.action === "navigate" && event.to) {
              hasActionsRef.current = true;
              // Navigate after a short delay to let user see the message
              setTimeout(() => {
                router.push(event.to!);
              }, 500);
            }
          },
          // onComplete
          () => {
            setGenerating(false);

            // If there were highlight actions, minimize panel so user can see them
            if (hasActionsRef.current) {
              useGuideStore.setState({ isOpen: false, hasUnread: true });
            }
          },
          // onError
          (error: Error) => {
            console.error("Guide chat error:", error);
            setGenerating(false);

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
    [clearAllHighlights, router]
  );

  const handleClearChat = useCallback(async () => {
    // Clear frontend state
    clearMessages();

    // Clear backend session
    try {
      const { clearGuideSession } = await import("@/lib/guide-api");
      await clearGuideSession();
    } catch (error) {
      console.error("Failed to clear guide session:", error);
    }

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
      <HighlightOverlay />
    </TooltipProvider>
  );
}
