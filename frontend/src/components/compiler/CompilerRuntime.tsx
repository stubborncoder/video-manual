"use client";

import { ReactNode, useEffect, useRef } from "react";
import {
  AssistantRuntimeProvider,
  useAssistantTransportRuntime,
  useThreadRuntime,
  unstable_createMessageConverter as createMessageConverter,
  AssistantTransportConnectionMetadata,
} from "@assistant-ui/react";
import {
  convertLangChainMessages,
  LangChainMessage,
} from "@assistant-ui/react-langgraph";

// Use relative URL to go through Next.js proxy (which handles cookies correctly)
const API_BASE = "";

interface CompilerRuntimeProviderProps {
  children: ReactNode;
  projectId: string;
  language: string;
}

// State type from the backend
type CompilerState = {
  messages: LangChainMessage[];
};

// Create a message converter for LangChain messages
const LangChainMessageConverter = createMessageConverter(convertLangChainMessages);

// Converter function: transforms agent state to assistant-ui format
const converter = (
  state: CompilerState,
  connectionMetadata: AssistantTransportConnectionMetadata,
) => {
  // Add optimistic updates for pending commands
  const optimisticStateMessages = connectionMetadata.pendingCommands.map(
    (c): LangChainMessage[] => {
      if (c.type === "add-message") {
        return [
          {
            type: "human" as const,
            content: [
              {
                type: "text" as const,
                text: c.message.parts
                  .map((p: any) => (p.type === "text" ? p.text : ""))
                  .join("\n"),
              },
            ],
          },
        ];
      }
      return [];
    },
  );

  const messages = [...(state?.messages || []), ...optimisticStateMessages.flat()];

  return {
    messages: LangChainMessageConverter.toThreadMessages(messages),
    isRunning: connectionMetadata.isSending || false,
  };
};

// Component to auto-start compilation on mount
function AutoStartCompilation() {
  const runtime = useThreadRuntime();
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    runtime.append({
      role: "user",
      content: [{ type: "text", text: "Start compilation" }],
    });
  }, [runtime]);

  return null;
}

export function CompilerRuntimeProvider({
  children,
  projectId,
  language,
}: CompilerRuntimeProviderProps) {
  const runtime = useAssistantTransportRuntime({
    initialState: {
      messages: [],
    },
    api: `${API_BASE}/api/assistant/compile`,
    converter,
    headers: {
      "Content-Type": "application/json",
    },
    body: {
      project_id: projectId,
      language: language,
    },
    onError: (error) => {
      console.error("[CompilerRuntime] Error:", error);
    },
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <AutoStartCompilation />
      {children}
    </AssistantRuntimeProvider>
  );
}
