"use client";

import { Bot, User } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import type { GuideMessage } from "@/stores/guideStore";

/**
 * Styles "vDocs" text in bold with primary color
 */
function styleVDocs(text: string): React.ReactNode {
  const parts = text.split(/(vDocs)/gi);
  if (parts.length === 1) return text;

  return parts.map((part, i) =>
    part.toLowerCase() === "vdocs" ? (
      <span key={i} className="font-bold text-primary">vDocs</span>
    ) : (
      part
    )
  );
}

/**
 * Recursively processes children to style "vDocs"
 */
function StyledText({ children }: { children: React.ReactNode }): React.ReactNode {
  if (typeof children === "string") {
    return styleVDocs(children);
  }

  if (Array.isArray(children)) {
    return children.map((child, i) => (
      <StyledText key={i}>{child}</StyledText>
    ));
  }

  return children;
}

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
          <div className="text-sm prose prose-sm dark:prose-invert prose-p:my-1 prose-ul:my-1 prose-ol:my-1 max-w-none">
            <ReactMarkdown
              components={{
                p: ({ children }) => <p><StyledText>{children}</StyledText></p>,
                li: ({ children }) => <li><StyledText>{children}</StyledText></li>,
                strong: ({ children }) => <strong><StyledText>{children}</StyledText></strong>,
                em: ({ children }) => <em><StyledText>{children}</StyledText></em>,
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
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
