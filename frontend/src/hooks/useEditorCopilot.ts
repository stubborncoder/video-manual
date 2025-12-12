"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { ChatMessageData } from "@/components/editor/ChatMessage";
import type { TextSelection } from "./useTextSelection";

/**
 * Get user ID from cookie for WebSocket auth
 */
function getUserIdFromCookie(): string | null {
  if (typeof document === "undefined") return null;
  const cookies = document.cookie.split(";");
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split("=");
    if (name === "session_user_id") {
      return decodeURIComponent(value);
    }
  }
  return null;
}

// WebSocket message types from server
interface WSMessageBase {
  type: string;
}

interface WSAgentThinking extends WSMessageBase {
  type: "agent_thinking";
  content: string;
}

interface WSToolCall extends WSMessageBase {
  type: "tool_call";
  tool: string;
  args: Record<string, unknown>;
}

interface WSPendingChange extends WSMessageBase {
  type: "pending_change";
  change: {
    id?: string;
    change_id?: string;
    type: "text_replace" | "text_insert" | "text_delete" | "caption_update";
    // camelCase (frontend)
    startLine?: number;
    endLine?: number;
    afterLine?: number;
    originalContent?: string;
    newContent?: string;
    // snake_case (backend)
    start_line?: number;
    end_line?: number;
    after_line?: number;
    original_content?: string;
    new_content?: string;
    reason?: string;
  };
}

interface WSChatResponse extends WSMessageBase {
  type: "chat_response";
  content: string;
  done: boolean;
}

interface WSError extends WSMessageBase {
  type: "error";
  message: string;
}

interface WSChangeAccepted extends WSMessageBase {
  type: "change_accepted";
  change_id: string;
}

interface WSChangeRejected extends WSMessageBase {
  type: "change_rejected";
  change_id: string;
}

type WSMessage =
  | WSAgentThinking
  | WSToolCall
  | WSPendingChange
  | WSChatResponse
  | WSError
  | WSChangeAccepted
  | WSChangeRejected;

// Pending change for the document
export interface PendingDocumentChange {
  id: string;
  type: "text_replace" | "text_insert" | "text_delete" | "caption_update" | "image_placeholder";
  startLine?: number;
  endLine?: number;
  afterLine?: number;
  originalContent?: string;
  newContent?: string;
  reason?: string;
  status: "pending" | "accepted" | "rejected";
}

interface UseEditorCopilotOptions {
  manualId: string;
  language: string;
  documentContent: string;
  onPendingChange?: (change: PendingDocumentChange) => void;
  onChangeAccepted?: (change: PendingDocumentChange) => void;
}

/**
 * Hook for managing the editor copilot WebSocket connection and chat state
 */
export function useEditorCopilot({
  manualId,
  language,
  documentContent,
  onPendingChange,
  onChangeAccepted,
}: UseEditorCopilotOptions) {
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [pendingChanges, setPendingChanges] = useState<PendingDocumentChange[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentAssistantMessageRef = useRef<string | null>(null);

  /**
   * Generate a unique message ID
   */
  const generateId = useCallback(() => {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  /**
   * Connect to WebSocket
   */
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    // Build WebSocket URL - connect directly to backend
    // Next.js rewrites don't properly handle WebSocket upgrades
    const wsHost = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";
    const userId = getUserIdFromCookie();
    const params = new URLSearchParams({ language });
    if (userId) {
      params.set("user_id", userId);
    }
    const wsUrl = `${wsHost}/api/ws/editor/${manualId}?${params.toString()}`;

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setIsConnected(true);
      console.log("[EditorCopilot] Connected");
    };

    ws.onclose = () => {
      setIsConnected(false);
      setIsGenerating(false);
      console.log("[EditorCopilot] Disconnected");

      // Auto-reconnect after 3 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 3000);
    };

    ws.onerror = (error) => {
      console.error("[EditorCopilot] WebSocket error - likely connection refused. Is backend running on port 8000?");
    };

    ws.onmessage = (event) => {
      try {
        const data: WSMessage = JSON.parse(event.data);
        handleWSMessage(data);
      } catch (e) {
        console.error("[EditorCopilot] Failed to parse message:", e);
      }
    };

    wsRef.current = ws;
  }, [manualId, language]);

  /**
   * Handle incoming WebSocket messages
   */
  const handleWSMessage = useCallback(
    (data: WSMessage) => {
      switch (data.type) {
        case "agent_thinking":
          // Check ref BEFORE setMessages to avoid race conditions
          if (currentAssistantMessageRef.current) {
            // Update existing streaming message
            const existingId = currentAssistantMessageRef.current;
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === existingId
                  ? { ...msg, content: msg.content + data.content }
                  : msg
              )
            );
          } else {
            // Create new assistant message - set ref BEFORE setMessages
            const newId = generateId();
            currentAssistantMessageRef.current = newId;
            setMessages((prev) => [
              ...prev,
              {
                id: newId,
                role: "assistant" as const,
                content: data.content,
                timestamp: new Date(),
                isStreaming: true,
              },
            ]);
          }
          break;

        case "chat_response":
          // Check ref BEFORE setMessages to avoid race conditions
          if (currentAssistantMessageRef.current) {
            // Update existing streaming message
            const existingId = currentAssistantMessageRef.current;
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === existingId
                  ? {
                      ...msg,
                      content: data.done ? data.content : msg.content + data.content,
                      isStreaming: !data.done,
                    }
                  : msg
              )
            );
          } else {
            // Create new message - set ref BEFORE setMessages to prevent duplicates
            const newId = generateId();
            if (!data.done) {
              currentAssistantMessageRef.current = newId;
            }
            setMessages((prev) => [
              ...prev,
              {
                id: newId,
                role: "assistant" as const,
                content: data.content,
                timestamp: new Date(),
                isStreaming: !data.done,
              },
            ]);
          }

          if (data.done) {
            currentAssistantMessageRef.current = null;
            setIsGenerating(false);
          }
          break;

        case "tool_call":
          // Add tool call message
          setMessages((prev) => [
            ...prev,
            {
              id: generateId(),
              role: "tool" as const,
              content: "",
              timestamp: new Date(),
              toolName: data.tool,
              toolArgs: data.args,
            },
          ]);
          break;

        case "pending_change":
          // Add to pending changes (convert snake_case from backend to camelCase)
          const changeData = data.change;
          const changeId = changeData.id || changeData.change_id || `change_${Date.now()}`;
          const newChange: PendingDocumentChange = {
            id: changeId,
            type: changeData.type,
            startLine: changeData.startLine ?? changeData.start_line,
            endLine: changeData.endLine ?? changeData.end_line,
            afterLine: changeData.afterLine ?? changeData.after_line,
            originalContent: changeData.originalContent ?? changeData.original_content,
            newContent: changeData.newContent ?? changeData.new_content,
            reason: changeData.reason,
            status: "pending",
          };
          setPendingChanges((prev) => [...prev, newChange]);
          onPendingChange?.(newChange);

          // Also add to chat messages as a tool result
          setMessages((prev) => [
            ...prev,
            {
              id: generateId(),
              role: "tool_result" as const,
              content: "",
              timestamp: new Date(),
              toolResult: {
                changeId: changeId,
                changeType: newChange.type,
                startLine: newChange.startLine,
                endLine: newChange.endLine,
                afterLine: newChange.afterLine,
                originalContent: newChange.originalContent,
                newContent: newChange.newContent,
                reason: newChange.reason,
                status: newChange.status,
              },
            },
          ]);
          break;

        case "error":
          // Add error message
          setMessages((prev) => [
            ...prev,
            {
              id: generateId(),
              role: "system" as const,
              content: data.message,
              timestamp: new Date(),
              error: data.message,
            },
          ]);
          setIsGenerating(false);
          currentAssistantMessageRef.current = null;
          break;

        case "change_accepted":
          // Update change status to accepted
          setPendingChanges((prev) =>
            prev.map((c) =>
              c.id === data.change_id ? { ...c, status: "accepted" as const } : c
            )
          );
          // Also update the tool result message status
          setMessages((prev) =>
            prev.map((msg) =>
              msg.toolResult?.changeId === data.change_id
                ? { ...msg, toolResult: { ...msg.toolResult, status: "accepted" as const } }
                : msg
            )
          );
          break;

        case "change_rejected":
          // Update change status to rejected
          setPendingChanges((prev) =>
            prev.map((c) =>
              c.id === data.change_id ? { ...c, status: "rejected" as const } : c
            )
          );
          // Also update the tool result message status
          setMessages((prev) =>
            prev.map((msg) =>
              msg.toolResult?.changeId === data.change_id
                ? { ...msg, toolResult: { ...msg.toolResult, status: "rejected" as const } }
                : msg
            )
          );
          break;
      }
    },
    [generateId, onPendingChange]
  );

  /**
   * Send a chat message with optional image attachment
   */
  const sendMessage = useCallback(
    (content: string, selection: TextSelection | null, imageContext?: { url: string; name: string }) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        console.error("[EditorCopilot] WebSocket not connected");
        return;
      }

      // Add user message to chat
      const userMessage: ChatMessageData = {
        id: generateId(),
        role: "user",
        content,
        timestamp: new Date(),
        selectionContext: selection
          ? { text: selection.text, context: selection.context }
          : undefined,
        imageContext: imageContext,
      };
      setMessages((prev) => [...prev, userMessage]);

      // Send to server
      const payload = {
        type: "chat_message",
        content,
        selection: selection
          ? {
              text: selection.text,
              startOffset: selection.startOffset,
              endOffset: selection.endOffset,
              context: selection.context,
            }
          : null,
        document_content: documentContent,
        image: imageContext
          ? {
              url: imageContext.url,
              name: imageContext.name,
            }
          : null,
      };

      wsRef.current.send(JSON.stringify(payload));
      setIsGenerating(true);
    },
    [generateId, documentContent]
  );

  /**
   * Stop current generation
   */
  const stopGeneration = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "cancel_generation" }));
    }
    setIsGenerating(false);
    currentAssistantMessageRef.current = null;

    // Mark any streaming message as complete
    setMessages((prev) =>
      prev.map((msg) =>
        msg.isStreaming ? { ...msg, isStreaming: false } : msg
      )
    );
  }, []);

  /**
   * Accept a pending change
   */
  const acceptChange = useCallback((changeId: string) => {
    // Use functional update to get latest state and avoid stale closure issues
    // This is critical for mass approval where multiple changes are processed quickly
    setPendingChanges((prev) => {
      // Find the change in the current state
      const change = prev.find((c) => c.id === changeId && c.status === "pending");

      if (!change) {
        console.log("[acceptChange] Change not found or already processed:", changeId);
        return prev;
      }

      // Apply the change to the document
      onChangeAccepted?.(change);

      // Send WebSocket notification
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({ type: "accept_change", change_id: changeId })
        );
      }

      // Update status to accepted
      return prev.map((c) =>
        c.id === changeId ? { ...c, status: "accepted" as const } : c
      );
    });
  }, [onChangeAccepted]);

  /**
   * Reject a pending change
   */
  const rejectChange = useCallback((changeId: string) => {
    setPendingChanges((prev) =>
      prev.map((c) =>
        c.id === changeId ? { ...c, status: "rejected" as const } : c
      )
    );

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({ type: "reject_change", change_id: changeId })
      );
    }
  }, []);

  /**
   * Clear chat history
   */
  const clearChat = useCallback(() => {
    setMessages([]);
    setPendingChanges([]);
  }, []);

  /**
   * Disconnect WebSocket
   */
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    wsRef.current?.close();
    wsRef.current = null;
  }, []);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return {
    // State
    messages,
    pendingChanges,
    isConnected,
    isGenerating,

    // Actions
    sendMessage,
    stopGeneration,
    acceptChange,
    rejectChange,
    clearChat,
    connect,
    disconnect,
  };
}

export default useEditorCopilot;
