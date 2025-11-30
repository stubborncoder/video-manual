"use client";

import { memo } from "react";
import ReactMarkdown from "react-markdown";
import { Bot, User, AlertCircle, Wrench, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type MessageRole = "user" | "assistant" | "system" | "tool";

export interface ChatMessageData {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  /** For tool messages */
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  /** If this message has attached selection context */
  selectionContext?: {
    text: string;
    context: string;
  };
  /** Whether the message is still streaming */
  isStreaming?: boolean;
  /** Error state */
  error?: string;
}

interface ChatMessageProps {
  message: ChatMessageData;
}

/**
 * Format timestamp for display
 */
function formatTime(date: Date): string {
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Individual chat message bubble
 */
export const ChatMessage = memo(function ChatMessage({
  message,
}: ChatMessageProps) {
  const isUser = message.role === "user";
  const isAssistant = message.role === "assistant";
  const isTool = message.role === "tool";
  const isSystem = message.role === "system";

  return (
    <div
      className={cn(
        "flex gap-3 px-4 py-3",
        isUser && "flex-row-reverse"
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
          isUser && "bg-primary text-primary-foreground",
          isAssistant && "bg-muted",
          isTool && "bg-amber-100 dark:bg-amber-900/30",
          isSystem && "bg-destructive/10"
        )}
      >
        {isUser && <User className="h-4 w-4" />}
        {isAssistant && <Bot className="h-4 w-4" />}
        {isTool && <Wrench className="h-4 w-4 text-amber-600 dark:text-amber-400" />}
        {isSystem && <AlertCircle className="h-4 w-4 text-destructive" />}
      </div>

      {/* Message content */}
      <div
        className={cn(
          "flex-1 min-w-0 space-y-1",
          isUser && "text-right"
        )}
      >
        {/* Header */}
        <div
          className={cn(
            "flex items-center gap-2 text-xs text-muted-foreground",
            isUser && "flex-row-reverse"
          )}
        >
          <span className="font-medium">
            {isUser && "You"}
            {isAssistant && "Manual Editor"}
            {isTool && `Tool: ${message.toolName}`}
            {isSystem && "System"}
          </span>
          <span>{formatTime(message.timestamp)}</span>
          {message.isStreaming && (
            <Loader2 className="h-3 w-3 animate-spin" />
          )}
        </div>

        {/* Selection context (for user messages) */}
        {message.selectionContext && (
          <div
            className={cn(
              "text-xs px-2 py-1 rounded bg-muted/50 border-l-2 border-primary/50",
              isUser && "ml-auto max-w-[80%]"
            )}
          >
            <span className="text-muted-foreground">Selected: </span>
            <span className="italic">
              "{message.selectionContext.text.length > 100
                ? message.selectionContext.text.slice(0, 100) + "..."
                : message.selectionContext.text}"
            </span>
          </div>
        )}

        {/* Message bubble */}
        <div
          className={cn(
            "inline-block rounded-lg px-3 py-2 max-w-[85%]",
            isUser && "bg-primary text-primary-foreground ml-auto",
            isAssistant && "bg-muted",
            isTool && "bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800",
            isSystem && "bg-destructive/10 border border-destructive/20",
            message.error && "bg-destructive/10 border border-destructive/30"
          )}
        >
          {message.error ? (
            <p className="text-sm text-destructive">{message.error}</p>
          ) : isTool ? (
            <div className="text-sm">
              <p className="font-medium text-amber-700 dark:text-amber-300">
                {message.toolName}
              </p>
              {message.toolArgs && (
                <pre className="mt-1 text-xs overflow-x-auto">
                  {JSON.stringify(message.toolArgs, null, 2)}
                </pre>
              )}
              {message.content && (
                <p className="mt-1 text-muted-foreground">{message.content}</p>
              )}
            </div>
          ) : isUser ? (
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
          )}

          {/* Streaming indicator */}
          {message.isStreaming && (
            <span className="inline-block w-2 h-4 bg-foreground/50 animate-pulse ml-1" />
          )}
        </div>
      </div>
    </div>
  );
});

export default ChatMessage;
