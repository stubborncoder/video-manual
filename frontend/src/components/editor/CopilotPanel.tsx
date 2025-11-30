"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Bot, Send, StopCircle, Trash2 } from "lucide-react";
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
import type { TextSelection } from "@/hooks/useTextSelection";
import type { PendingDocumentChange } from "@/hooks/useEditorCopilot";

interface CopilotPanelProps {
  messages: ChatMessageData[];
  pendingChanges: PendingDocumentChange[];
  selection: TextSelection | null;
  onClearSelection: () => void;
  onSendMessage: (content: string, selection: TextSelection | null) => void;
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
  onSendMessage,
  onStopGeneration,
  onClearChat,
  onAcceptChange,
  onRejectChange,
  isGenerating,
  isConnected,
  isPaused = false,
}: CopilotPanelProps) {
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

    onSendMessage(content, selection);
    setInputValue("");

    // Clear selection after sending
    if (selection) {
      onClearSelection();
    }
  }, [inputValue, selection, isGenerating, onSendMessage, onClearSelection]);

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

  // Focus textarea when selection changes
  useEffect(() => {
    if (selection && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [selection]);

  const hasMessages = messages.length > 0;

  return (
    <TooltipProvider>
      <div className="h-full flex flex-col bg-muted/30 overflow-hidden">
        {/* Header */}
        <div className="border-b px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4" />
            <span className="font-medium">Manual Editor</span>
            <span
              className={`w-2 h-2 rounded-full ${
                isConnected ? "bg-green-500" : "bg-red-500"
              }`}
              title={isConnected ? "Connected" : "Disconnected"}
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
              <TooltipContent>Clear chat</TooltipContent>
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
            </div>
          ) : (
            <div className="h-full flex items-center justify-center p-6">
              <div className="text-center text-muted-foreground">
                <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium mb-2">Manual Editor</p>
                <p className="text-sm max-w-[250px]">
                  Select text in the document and ask me to help improve it, or
                  just ask a question about your manual.
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

          {/* Input + buttons */}
          <div className="flex gap-2">
            <Textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isPaused
                  ? "Switch to Preview mode to use the assistant..."
                  : selection
                  ? "What would you like to do with this selection?"
                  : "Ask the AI to help edit your manual..."
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
                  <TooltipContent>Stop generation</TooltipContent>
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
                  <TooltipContent>Send (Enter)</TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>

          {/* Connection status */}
          {!isConnected && (
            <p className="text-xs text-destructive text-center">
              Disconnected from server. Reconnecting...
            </p>
          )}

          {/* Paused status (markdown mode) */}
          {isPaused && isConnected && (
            <p className="text-xs text-amber-600 dark:text-amber-400 text-center">
              Assistant paused while editing markdown. Switch to Preview to continue.
            </p>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}

export default CopilotPanel;
