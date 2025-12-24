"use client";

import { useEffect, useCallback, useState, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useGuideStore } from "@/stores/guideStore";
import { useLocale } from "@/components/providers/I18nProvider";
import { GuideButton } from "./GuideButton";
import { GuidePanel } from "./GuidePanel";
import { HighlightOverlay } from "./HighlightOverlay";
import type { GuideMessage, PageContext } from "@/stores/guideStore";
import type { GuideEvent } from "@/lib/guide-api";

interface GuideProviderProps {
  children: React.ReactNode;
}

/**
 * Get suggestion translation keys based on the current page
 */
function getSuggestionKeysForPage(pathname: string): string[] {
  if (pathname.includes("/videos")) {
    return ["videos.upload", "videos.processing", "videos.formats"];
  }
  if (pathname.includes("/manuals")) {
    return ["manuals.export", "manuals.edit", "manuals.languages"];
  }
  if (pathname.includes("/projects")) {
    return ["projects.create", "projects.organize", "projects.compile"];
  }
  if (pathname.includes("/dashboard")) {
    return ["dashboard.getStarted", "dashboard.capabilities", "dashboard.createDocs", "dashboard.whatsNew"];
  }
  return ["default.getStarted", "default.features", "default.whatsNew"];
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
  const { locale } = useLocale();
  const t = useTranslations("guide");
  const { addMessage, clearMessages, setPageContext, messages, showHighlight, clearAllHighlights, isOpen } = useGuideStore();
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [whatsNewLabel, setWhatsNewLabel] = useState<string>("");
  // Track if we've triggered any actions during current response
  const hasActionsRef = useRef<boolean>(false);
  // Store current suggestions and translated strings for use in callbacks
  const suggestionsRef = useRef<string[]>([]);
  const fallbackGreetingRef = useRef(t("fallbackGreeting"));
  const chatClearedRef = useRef(t("chatCleared"));

  // Update page context when pathname changes
  useEffect(() => {
    const pageTitle = getPageTitle(pathname);
    const suggestionKeys = getSuggestionKeysForPage(pathname);
    const translatedSuggestions = suggestionKeys.map(key => t(key));

    const context: PageContext = {
      currentPage: pathname,
      pageTitle,
      availableActions: [],
      pageState: {},
    };

    setPageContext(context);
    setSuggestions(translatedSuggestions);
    suggestionsRef.current = translatedSuggestions;
    fallbackGreetingRef.current = t("fallbackGreeting");
    chatClearedRef.current = t("chatCleared");

    // Set "What's new" label - always use the full version
    setWhatsNewLabel(t("dashboard.whatsNew"));

    // Clear highlights when navigating to a new page
    clearAllHighlights();
  }, [pathname, setPageContext, clearAllHighlights, t]);

  // Fetch initial greeting from backend when user opens the guide panel
  // Only triggers when panel is opened AND chat is empty (first interaction)
  const hasInitialized = useRef(false);
  useEffect(() => {
    const initializeGreeting = async () => {
      // Only initialize when user explicitly opens the panel and chat is empty
      if (!isOpen || messages.length > 0 || hasInitialized.current) {
        return;
      }
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
            language: locale,
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
                suggestions: suggestionsRef.current,
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
              content: fallbackGreetingRef.current,
              timestamp: new Date(),
              suggestions: suggestionsRef.current,
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
          content: fallbackGreetingRef.current,
          timestamp: new Date(),
          suggestions: suggestionsRef.current,
        });
      }
    };

    initializeGreeting();
  }, [isOpen]); // Run when panel is opened

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
            language: locale,
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
              // Store pending highlight, will be applied after panel resize animation
              useGuideStore.getState().setPendingHighlight({
                target: event.target,
                duration: event.duration || 5000,
              });
              useGuideStore.getState().setCompact();
            } else if (event.action === "navigate" && event.to) {
              hasActionsRef.current = true;
              // First minimize panel, then navigate
              useGuideStore.getState().setCompact();
              setTimeout(() => {
                router.push(event.to!);
              }, 500);
            }
          },
          // onComplete
          () => {
            setGenerating(false);
            // Panel resize already handled in onAction when actions occur
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
    [clearAllHighlights, router, locale]
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
      content: chatClearedRef.current,
      timestamp: new Date(),
      suggestions: suggestionsRef.current,
    };
    addMessage(greetingMessage);
  }, [clearMessages, addMessage]);

  return (
    <TooltipProvider delayDuration={0}>
      {children}
      <GuideButton />
      <GuidePanel
        onSendMessage={handleSendMessage}
        onClearChat={handleClearChat}
        suggestions={suggestions}
        whatsNewLabel={whatsNewLabel}
      />
      <HighlightOverlay />
    </TooltipProvider>
  );
}
