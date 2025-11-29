"use client";

import { FC } from "react";
import {
  ThreadPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
} from "@assistant-ui/react";
import { ArrowUpIcon, Loader2 } from "lucide-react";
import { MarkdownText } from "@/components/assistant-ui/markdown-text";
import { ToolFallback } from "@/components/assistant-ui/tool-fallback";
import { Button } from "@/components/ui/button";

// Simple message components
const UserMessage: FC = () => (
  <MessagePrimitive.Root className="flex justify-end py-2">
    <div className="bg-primary text-primary-foreground rounded-2xl px-4 py-2 max-w-[80%]">
      <MessagePrimitive.Content components={{ Text: MarkdownText }} />
    </div>
  </MessagePrimitive.Root>
);

const AssistantMessage: FC = () => (
  <MessagePrimitive.Root className="flex justify-start py-2">
    <div className="bg-muted rounded-2xl px-4 py-2 max-w-[80%]">
      <MessagePrimitive.Content
        components={{
          Text: MarkdownText,
          tools: { Fallback: ToolFallback },
        }}
      />
    </div>
  </MessagePrimitive.Root>
);

// Simple composer
const Composer: FC = () => (
  <ComposerPrimitive.Root className="flex gap-2 p-4 border-t">
    <ComposerPrimitive.Input
      placeholder="Type a message..."
      className="flex-1 px-4 py-2 border rounded-full bg-background outline-none focus:ring-2 focus:ring-ring"
    />
    <ComposerPrimitive.Send asChild>
      <Button size="icon" className="rounded-full">
        <ArrowUpIcon className="h-4 w-4" />
      </Button>
    </ComposerPrimitive.Send>
  </ComposerPrimitive.Root>
);

// Loading indicator shown when running
const LoadingIndicator: FC = () => (
  <ThreadPrimitive.If running>
    <div className="flex items-center gap-2 px-4 py-2 text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span className="text-sm">Thinking...</span>
    </div>
  </ThreadPrimitive.If>
);

export const CompilerThread: FC = () => {
  return (
    <ThreadPrimitive.Root className="flex flex-col h-full">
      <ThreadPrimitive.Viewport className="flex-1 overflow-y-auto p-4">
        <ThreadPrimitive.Messages
          components={{
            UserMessage,
            AssistantMessage,
          }}
        />
        <LoadingIndicator />
      </ThreadPrimitive.Viewport>
      <Composer />
    </ThreadPrimitive.Root>
  );
};
