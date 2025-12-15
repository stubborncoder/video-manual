"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Bot, Send, StopCircle, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ChatMessage, type ChatMessageData } from "./ChatMessage";
import { SelectionChip } from "./SelectionChip";
import { ImageContextChip, type ImageContext } from "./ImageContextChip";
import type { TextSelection } from "@/hooks/useTextSelection";
import type { PendingDocumentChange } from "@/hooks/useEditorCopilot";

interface CopilotPanelProps {
  messages: ChatMessageData[];
  pendingChanges: PendingDocumentChange[];
  selection: TextSelection | null;
  onClearSelection: () => void;
  imageContext: ImageContext | null;
  onClearImageContext: () => void;
  onSendMessage: (content: string, selection: TextSelection | null, imageContext?: ImageContext) => void;
  onStopGeneration?: () => void;
  onClearChat?: () => void;
  onAcceptChange: (changeId: string) => void;
  onRejectChange: (changeId: string) => void;
  isGenerating: boolean;
  isConnected: boolean;
  isPaused?: boolean;
}

/**
 * The copilot chat panel with message list and input
 */
export function CopilotPanel({
  messages,
  pendingChanges,
  selection,
  onClearSelection,
  imageContext,
  onClearImageContext,
  onSendMessage,
  onStopGeneration,
  onClearChat,
  onAcceptChange,
  onRejectChange,
  isGenerating,
  isConnected,
  isPaused = false,
}: CopilotPanelProps) {
  const t = useTranslations("copilotPanel");
  const [inputValue, setInputValue] = useState("");
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector(
        "[data-radix-scroll-area-viewport]"
      );
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);

  // Handle send
  const handleSend = useCallback(() => {
    const content = inputValue.trim();
    if (!content || isGenerating) return;

    onSendMessage(content, selection, imageContext || undefined);
    setInputValue("");

    // Clear selection after sending
    if (selection) {
      onClearSelection();
    }
    // Clear image context after sending
    if (imageContext) {
      onClearImageContext();
    }
  }, [inputValue, selection, imageContext, isGenerating, onSendMessage, onClearSelection, onClearImageContext]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  // Focus textarea when selection or image context changes
  useEffect(() => {
    if ((selection || imageContext) && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [selection, imageContext]);

  const hasMessages = messages.length > 0;

  return (
    <TooltipProvider>
      <div className="h-full flex flex-col bg-muted/30 overflow-hidden">
        {/* Header */}
        <div className="border-b px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4" />
            <span className="font-medium">{t("title")}</span>
            <span
              className={`w-2 h-2 rounded-full ${
                isConnected ? "bg-green-500" : "bg-red-500"
              }`}
              title={isConnected ? t("connected") : t("disconnected")}
            />
          </div>
          {hasMessages && onClearChat && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClearChat}
                  className="h-7 px-2"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("clearChat")}</TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Messages */}
        <ScrollArea ref={scrollAreaRef} className="flex-1 min-h-0">
          {hasMessages ? (
            <div className="py-2">
              {messages.map((message) => (
                <ChatMessage key={message.id} message={message} />
              ))}
              {/* Thinking indicator */}
              {isGenerating && (
                <div className="px-4 py-3">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex items-center gap-2 py-2">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      <span className="text-sm text-muted-foreground">{t("thinking")}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center p-6">
              <div className="text-center text-muted-foreground">
                <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium mb-2">{t("emptyStateTitle")}</p>
                <p className="text-sm max-w-[250px]">
                  {t("emptyStateDesc")}
                </p>
              </div>
            </div>
          )}
        </ScrollArea>

        {/* Input area */}
        <div className="border-t p-4 space-y-3">
          {/* Selection chip */}
          {selection && (
            <SelectionChip selection={selection} onClear={onClearSelection} />
          )}

          {/* Image context chip */}
          {imageContext && (
            <ImageContextChip imageContext={imageContext} onClear={onClearImageContext} />
          )}

          {/* Input + buttons */}
          <div className="flex gap-2">
            <Textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isPaused
                  ? t("placeholderPaused")
                  : imageContext
                  ? t("placeholderImage")
                  : selection
                  ? t("placeholderSelection")
                  : t("placeholderDefault")
              }
              className="resize-none min-h-[60px]"
              rows={2}
              disabled={!isConnected || isPaused}
            />
            <div className="flex flex-col gap-1">
              {isGenerating ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={onStopGeneration}
                      className="h-[60px] w-10"
                    >
                      <StopCircle className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t("stopGeneration")}</TooltipContent>
                </Tooltip>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={handleSend}
                      disabled={!inputValue.trim() || !isConnected || isPaused}
                      className="h-[60px] w-10"
                    >
                      <Send className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t("sendMessage")}</TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>

          {/* Connection status */}
          {!isConnected && (
            <p className="text-xs text-destructive text-center">
              {t("disconnectedMessage")}
            </p>
          )}

          {/* Paused status (markdown mode) */}
          {isPaused && isConnected && (
            <p className="text-xs text-amber-600 dark:text-amber-400 text-center">
              {t("pausedMessage")}
            </p>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}

export default CopilotPanel;
