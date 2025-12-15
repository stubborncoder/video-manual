"use client";

import { Bot, User } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GuideMessage } from "@/stores/guideStore";

interface GuideMessageProps {
  message: GuideMessage;
}

/**
 * Individual message component for the guide chat
 * Displays user and assistant messages with appropriate styling
 */
export function GuideMessageComponent({ message }: GuideMessageProps) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  return (
    <div
      className={cn(
        "px-4 py-3 flex gap-3",
        isUser && "flex-row-reverse"
      )}
    >
      {/* Avatar */}
      {!isSystem && (
        <div
          className={cn(
            "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
            isUser ? "bg-primary text-primary-foreground" : "bg-muted"
          )}
        >
          {isUser ? (
            <User className="h-4 w-4" />
          ) : (
            <Bot className="h-4 w-4" />
          )}
        </div>
      )}

      {/* Message content */}
      <div className={cn("flex-1 space-y-2", isUser && "flex flex-col items-end")}>
        <div
          className={cn(
            "rounded-lg px-4 py-2 max-w-[85%]",
            isUser && "bg-primary text-primary-foreground",
            !isUser && !isSystem && "bg-muted",
            isSystem && "bg-amber-50 dark:bg-amber-950 text-amber-900 dark:text-amber-100 border border-amber-200 dark:border-amber-800"
          )}
        >
          <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
        </div>

        {/* Suggestions */}
        {message.suggestions && message.suggestions.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {message.suggestions.map((suggestion, idx) => (
              <button
                key={idx}
                className="text-xs px-3 py-1.5 rounded-full bg-muted hover:bg-muted/80 transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}

        {/* Timestamp */}
        <p className="text-xs text-muted-foreground">
          {new Date(message.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
    </div>
  );
}
