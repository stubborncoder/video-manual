"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { X, Send, Loader2, Trash2, Bot, ChevronUp, ChevronDown, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useGuideStore } from "@/stores/guideStore";
import { useSidebar } from "@/components/layout/SidebarContext";
import { GuideMessageComponent } from "./GuideMessage";
import { GuideSuggestions } from "./GuideSuggestions";
import { cn } from "@/lib/utils";

/**
 * Check if the current page has another copilot agent (editor/compiler)
 * On these pages, the guide panel should be on the left to avoid overlap
 */
function hasCopilotAgent(pathname: string): boolean {
  if (pathname.includes("/edit")) return true;
  if (pathname.includes("/compile")) return true;
  return false;
}

interface GuidePanelProps {
  onSendMessage: (content: string) => void;
  onClearChat?: () => void;
  suggestions?: string[];
}

/**
 * The guide agent chat panel
 * Positioned bottom-right normally, bottom-left on pages with other copilot agents
 */
export function GuidePanel({
  onSendMessage,
  onClearChat,
  suggestions = [],
}: GuidePanelProps) {
  const pathname = usePathname();
  const {
    isOpen,
    close,
    messages,
    isGenerating,
    pageContext,
    forceLeftPosition,
    panelSize,
    setFull,
    setMedium,
    setCompact,
    applyPendingHighlight,
    pendingHighlight,
  } = useGuideStore();
  const { collapsed: sidebarCollapsed } = useSidebar();

  const [inputValue, setInputValue] = useState("");

  // Position on left side when on pages with other copilot agents
  // OR when explicitly forced (e.g., when project view or compiler is active)
  const positionLeft = hasCopilotAgent(pathname) || forceLeftPosition;
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when messages change or panel opens
  useEffect(() => {
    if (!isOpen) return;

    // Small delay to ensure DOM is ready after mount/remount
    const timeoutId = setTimeout(() => {
      if (scrollAreaRef.current) {
        const scrollContainer = scrollAreaRef.current.querySelector(
          "[data-radix-scroll-area-viewport]"
        );
        if (scrollContainer) {
          scrollContainer.scrollTop = scrollContainer.scrollHeight;
        }
      }
    }, 50);

    return () => clearTimeout(timeoutId);
  }, [messages, isOpen]);

  // Focus textarea when panel opens
  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isOpen]);

  // Apply pending highlight when panel minimizes
  useEffect(() => {
    if (pendingHighlight && panelSize !== "full") {
      // Small delay to ensure layout animation has started
      const timer = setTimeout(() => {
        applyPendingHighlight();
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [panelSize, pendingHighlight, applyPendingHighlight]);

  const handleSend = useCallback(() => {
    const content = inputValue.trim();
    if (!content || isGenerating) return;

    onSendMessage(content);
    setInputValue("");
  }, [inputValue, isGenerating, onSendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleSuggestionClick = useCallback(
    (suggestion: string) => {
      if (isGenerating) return;
      onSendMessage(suggestion);
    },
    [isGenerating, onSendMessage]
  );

  const hasMessages = messages.length > 0;
  // Only show suggestions when there's just the initial greeting (no user interaction yet)
  const showSuggestions = messages.length <= 1 && suggestions.length > 0 && panelSize === "full";

  // Get last assistant message for compact view
  const lastAssistantMessage = [...messages].reverse().find(m => m.role === "assistant");

  // Height classes based on panel size
  const heightClasses = {
    full: "top-4 bottom-24",
    medium: "h-[calc(33vh)] bottom-24",
    compact: "h-[160px] bottom-24",
  };

  const isMinimized = panelSize !== "full";

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <motion.div
          key={positionLeft ? "left" : "right"}
          layout
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{
            duration: 0.2,
            ease: "easeOut",
            layout: { duration: 0.2 },
          }}
          onLayoutAnimationComplete={() => {
            // Apply any pending highlight after resize animation completes
            applyPendingHighlight();
          }}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "fixed z-[60] transition-[left] duration-200",
            heightClasses[panelSize],
            // When on left side, position past the sidebar
            // Collapsed sidebar: w-16 (64px) -> left-20 (80px)
            // Expanded sidebar: w-64 (256px) -> left-72 (288px)
            positionLeft
              ? sidebarCollapsed ? "left-20" : "left-72"
              : "right-6",
            "w-[400px]",
            "bg-background border rounded-lg shadow-2xl",
            "flex flex-col overflow-hidden"
          )}
        >
          {/* Header */}
          <div className="border-b px-4 py-3 flex items-center justify-between bg-muted/30 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <Bot className="h-4 w-4 text-primary shrink-0" />
              <span className="font-semibold shrink-0">vDocs Guide</span>
              {/* Page context chip - inline in header */}
              {pageContext && (
                <Badge variant="outline" className="text-xs truncate ml-1">
                  {pageContext.pageTitle}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {/* Clear chat - only in full mode */}
              {panelSize === "full" && hasMessages && onClearChat && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onClearChat}
                      className="h-7 w-7 p-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Clear chat</TooltipContent>
                </Tooltip>
              )}
              {/* Size toggle buttons */}
              {panelSize === "medium" && (
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={setCompact}
                        className="h-7 w-7 p-0"
                      >
                        <Minimize2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Minimize</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={setFull}
                        className="h-7 w-7 p-0"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Expand</TooltipContent>
                  </Tooltip>
                </>
              )}
              {panelSize === "compact" && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={setFull}
                      className="h-7 w-7 p-0"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Expand</TooltipContent>
                </Tooltip>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={close}
                className="h-7 w-7 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Messages - different layouts based on panel size */}
          {panelSize === "compact" ? (
            /* Compact view - show only last message preview */
            <div
              className="flex-1 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors overflow-hidden"
              onClick={setFull}
            >
              {lastAssistantMessage ? (
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {lastAssistantMessage.content}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  Click to expand...
                </p>
              )}
            </div>
          ) : (
            /* Full/Medium view - show scrollable messages */
            <ScrollArea ref={scrollAreaRef} className="flex-1 min-h-0">
              {hasMessages ? (
                <div className="py-2">
                  {messages.map((message) => (
                    <GuideMessageComponent key={message.id} message={message} />
                  ))}
                  {/* Thinking indicator */}
                  {isGenerating && (
                    <div className="px-4 py-3">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                          <Bot className="h-4 w-4" />
                        </div>
                        <div className="flex items-center gap-2 py-2">
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          <span className="text-sm text-muted-foreground">
                            Thinking...
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-full flex items-center justify-center p-6">
                  <div className="text-center text-muted-foreground">
                    <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="font-medium mb-2">How can I help you?</p>
                    <p className="text-sm max-w-[280px]">
                      Ask me anything about vDocs or get help with your
                      documentation workflow.
                    </p>
                  </div>
                </div>
              )}
            </ScrollArea>
          )}

          {/* Suggestions - only shown before first user message */}
          {showSuggestions && (
            <GuideSuggestions
              suggestions={suggestions}
              onSuggestionClick={handleSuggestionClick}
              disabled={isGenerating}
            />
          )}

          {/* Input area - hidden in compact mode */}
          {panelSize !== "compact" && (
            <div className={cn("border-t", panelSize === "medium" ? "p-2" : "p-4")}>
              <div className="flex gap-2">
                <Textarea
                  ref={textareaRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask me anything..."
                  className={cn(
                    "resize-none",
                    panelSize === "medium" ? "min-h-[40px]" : "min-h-[60px]"
                  )}
                  rows={panelSize === "medium" ? 1 : 2}
                  disabled={isGenerating}
                />
                <Button
                  onClick={handleSend}
                  disabled={!inputValue.trim() || isGenerating}
                  className={cn(
                    "w-10 flex-shrink-0",
                    panelSize === "medium" ? "h-[40px]" : "h-[60px]"
                  )}
                >
                  {isGenerating ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                </Button>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
