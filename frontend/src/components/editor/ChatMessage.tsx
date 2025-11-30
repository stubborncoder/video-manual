"use client";

import { memo } from "react";
import ReactMarkdown from "react-markdown";
import { Bot, User, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ToolCallMessage } from "./ToolCallMessage";
import { ToolResultMessage } from "./ToolResultMessage";

export type MessageRole = "user" | "assistant" | "system" | "tool" | "tool_result";

export interface ChatMessageData {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  /** For tool call messages */
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  /** For tool result messages */
  toolResult?: {
    changeId: string;
    changeType: "text_replace" | "text_insert" | "text_delete" | "caption_update";
    startLine?: number;
    endLine?: number;
    afterLine?: number;
    originalContent?: string;
    newContent?: string;
    reason?: string;
    status: "pending" | "accepted" | "rejected";
  };
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
  const isToolResult = message.role === "tool_result";
  const isSystem = message.role === "system";

  // Tool call messages use a dedicated compact component
  if (isTool) {
    return (
      <ToolCallMessage
        toolName={message.toolName || "unknown"}
        toolArgs={message.toolArgs}
        timestamp={message.timestamp}
      />
    );
  }

  // Tool result messages use a dedicated compact component
  if (isToolResult && message.toolResult) {
    return (
      <ToolResultMessage
        toolResult={message.toolResult}
        timestamp={message.timestamp}
      />
    );
  }

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
          isSystem && "bg-destructive/10"
        )}
      >
        {isUser && <User className="h-4 w-4" />}
        {isAssistant && <Bot className="h-4 w-4" />}
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
              &quot;{message.selectionContext.text.length > 100
                ? message.selectionContext.text.slice(0, 100) + "..."
                : message.selectionContext.text}&quot;
            </span>
          </div>
        )}

        {/* Message bubble */}
        <div
          className={cn(
            "inline-block rounded-lg px-3 py-2 max-w-[85%]",
            isUser && "bg-primary text-primary-foreground ml-auto",
            isAssistant && "bg-muted",
            isSystem && "bg-destructive/10 border border-destructive/20",
            message.error && "bg-destructive/10 border border-destructive/30"
          )}
        >
          {message.error ? (
            <p className="text-sm text-destructive">{message.error}</p>
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
