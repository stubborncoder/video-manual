"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { X, Send, Loader2, Trash2, Bot } from "lucide-react";
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
  } = useGuideStore();

  const [inputValue, setInputValue] = useState("");

  // Position on left side when on pages with other copilot agents
  const positionLeft = hasCopilotAgent(pathname);
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
  const showSuggestions = messages.length <= 1 && suggestions.length > 0;

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <motion.div
          key={positionLeft ? "left" : "right"}
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{
            duration: 0.2,
            ease: "easeOut",
          }}
          className={cn(
            "fixed bottom-24 z-50",
            positionLeft ? "left-6" : "right-6",
            "w-[400px] h-[600px]",
            "bg-background border rounded-lg shadow-2xl",
            "flex flex-col overflow-hidden"
          )}
        >
          {/* Header */}
          <div className="border-b px-4 py-3 flex items-center justify-between bg-muted/30">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary" />
              <span className="font-semibold">vDocs Guide</span>
            </div>
            <div className="flex items-center gap-1">
              {hasMessages && onClearChat && (
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

          {/* Page context chip */}
          {pageContext && (
            <div className="px-4 py-2 border-b bg-muted/20">
              <Badge variant="outline" className="text-xs">
                Viewing: {pageContext.pageTitle}
              </Badge>
            </div>
          )}

          {/* Messages */}
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

          {/* Suggestions - only shown before first user message */}
          {showSuggestions && (
            <GuideSuggestions
              suggestions={suggestions}
              onSuggestionClick={handleSuggestionClick}
              disabled={isGenerating}
            />
          )}

          {/* Input area */}
          <div className="border-t p-4">
            <div className="flex gap-2">
              <Textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask me anything..."
                className="resize-none min-h-[60px]"
                rows={2}
                disabled={isGenerating}
              />
              <Button
                onClick={handleSend}
                disabled={!inputValue.trim() || isGenerating}
                className="h-[60px] w-10 flex-shrink-0"
              >
                {isGenerating ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
