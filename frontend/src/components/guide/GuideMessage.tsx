"use client";

import { Bot, User } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import type { GuideMessage } from "@/stores/guideStore";

/**
 * Styles "vDocs" text in bold with the "D" in primary color
 */
function styleVDocs(text: string): React.ReactNode {
  const parts = text.split(/(vDocs)/gi);
  if (parts.length === 1) return text;

  return parts.map((part, i) =>
    part.toLowerCase() === "vdocs" ? (
      <span key={i} className="font-bold">v<span className="text-primary">D</span>ocs</span>
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
            isUser ? "bg-primary text-white dark:text-black" : "bg-muted"
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
            isUser && "bg-primary",
            !isUser && !isSystem && "bg-muted",
            isSystem && "bg-amber-50 dark:bg-amber-950 text-amber-900 dark:text-amber-100 border border-amber-200 dark:border-amber-800"
          )}
        >
          <div className={cn(
            "text-sm max-w-none",
            isUser
              // User: force white text in light mode, black text in dark mode
              ? "!text-white dark:!text-black [&_p]:!text-white [&_li]:!text-white [&_strong]:!text-white dark:[&_p]:!text-black dark:[&_li]:!text-black dark:[&_strong]:!text-black"
              // Non-user: use prose styling
              : "prose prose-sm dark:prose-invert prose-p:my-1 prose-ul:my-1 prose-ol:my-1"
          )}>
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
