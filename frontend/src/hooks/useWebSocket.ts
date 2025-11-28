"use client";

import { useCallback, useRef, useState } from "react";
import type {
  StreamEvent,
  ProcessingState,
  ProcessVideoRequest,
  CompileProjectRequest,
  HITLDecision,
} from "@/lib/types";

const WS_BASE = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";

type MessageHandler = (event: StreamEvent) => void;

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

export function useVideoProcessing() {
  const [state, setState] = useState<ProcessingState>({
    status: "idle",
    nodeDetails: {},
    streamedText: "",
  });

  const wsRef = useRef<WebSocket | null>(null);

  const processEvent = useCallback((event: StreamEvent) => {
    setState((prev) => {
      let newState = prev;
      switch (event.event_type) {
        case "node_started":
          newState = {
            ...prev,
            status: "processing",
            currentNode: event.data.node_name as string,
            nodeIndex: event.data.node_index as number,
            totalNodes: event.data.total_nodes as number,
          };
          break;

        case "node_completed":
          newState = {
            ...prev,
            nodeDetails: {
              ...prev.nodeDetails,
              [event.data.node_name as string]: event.data.details,
            },
          };
          break;

        case "error":
          newState = {
            ...prev,
            status: "error",
            error: event.data.error_message as string,
          };
          break;

        case "complete":
          newState = {
            ...prev,
            status: "complete",
            result: event.data.result as Record<string, unknown>,
          };
          break;

        default:
          break;
      }
      console.log("[WS] State update:", event.event_type, "->", newState.status, newState.currentNode);
      return newState;
    });
  }, []);

  const startProcessing = useCallback(
    (request: ProcessVideoRequest) => {
      // Immediately set state to processing so UI updates
      setState((prev) => ({
        ...prev,
        status: "processing",
        currentNode: undefined,
        nodeIndex: undefined,
        totalNodes: undefined,
      }));

      return new Promise<void>((resolve, reject) => {
        const userId = getUserIdFromCookie();
        const wsUrl = userId
          ? `${WS_BASE}/api/ws/process?user_id=${encodeURIComponent(userId)}`
          : `${WS_BASE}/api/ws/process`;
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          ws.send(JSON.stringify({ action: "start", ...request }));
        };

        ws.onmessage = (msg) => {
          const event = JSON.parse(msg.data) as StreamEvent;
          console.log("[WS] Event:", event.event_type, event.data);
          processEvent(event);

          if (event.event_type === "complete") {
            resolve();
          } else if (event.event_type === "error") {
            reject(new Error(event.data.error_message as string));
          }
        };

        ws.onerror = () => {
          setState((prev) => ({
            ...prev,
            status: "error",
            error: "WebSocket connection failed",
          }));
          reject(new Error("WebSocket connection failed"));
        };

        ws.onclose = () => {
          wsRef.current = null;
        };
      });
    },
    [processEvent]
  );

  const reset = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setState({
      status: "idle",
      nodeDetails: {},
      streamedText: "",
    });
  }, []);

  return { state, startProcessing, reset };
}

export function useProjectCompiler() {
  const [state, setState] = useState<ProcessingState>({
    status: "idle",
    nodeDetails: {},
    streamedText: "",
  });

  const wsRef = useRef<WebSocket | null>(null);

  const processEvent = useCallback((event: StreamEvent) => {
    setState((prev) => {
      switch (event.event_type) {
        case "llm_token":
          return {
            ...prev,
            status: "processing",
            streamedText: prev.streamedText + (event.data.token as string),
          };

        case "tool_call":
          return {
            ...prev,
            nodeDetails: {
              ...prev.nodeDetails,
              [event.data.tool_name]: event.data.arguments,
            },
          };

        case "hitl_required":
          return {
            ...prev,
            status: "hitl_pending",
            pendingHITL: event as any,
          };

        case "error":
          return {
            ...prev,
            status: "error",
            error: event.data.error_message as string,
          };

        case "complete":
          return {
            ...prev,
            status: "complete",
            result: event.data.result,
          };

        default:
          return prev;
      }
    });
  }, []);

  const startCompilation = useCallback(
    (request: CompileProjectRequest) => {
      // Immediately set state to processing so UI updates
      setState((prev) => ({
        ...prev,
        status: "processing",
        streamedText: "",
      }));

      return new Promise<void>((resolve, reject) => {
        const userId = getUserIdFromCookie();
        const wsUrl = userId
          ? `${WS_BASE}/api/ws/compile?user_id=${encodeURIComponent(userId)}`
          : `${WS_BASE}/api/ws/compile`;
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          ws.send(JSON.stringify({ action: "start", ...request }));
        };

        ws.onmessage = (msg) => {
          const event = JSON.parse(msg.data) as StreamEvent;
          console.log("[WS] Event:", event.event_type, event.data);
          processEvent(event);

          if (event.event_type === "complete") {
            resolve();
          } else if (event.event_type === "error") {
            reject(new Error(event.data.error_message as string));
          }
        };

        ws.onerror = () => {
          setState((prev) => ({
            ...prev,
            status: "error",
            error: "WebSocket connection failed",
          }));
          reject(new Error("WebSocket connection failed"));
        };

        ws.onclose = () => {
          wsRef.current = null;
        };
      });
    },
    [processEvent]
  );

  const submitDecision = useCallback((decision: HITLDecision) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          action: "decision",
          ...decision,
        })
      );
      setState((prev) => ({
        ...prev,
        status: "processing",
        pendingHITL: undefined,
      }));
    }
  }, []);

  const sendMessage = useCallback((content: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          action: "message",
          content,
        })
      );
    }
  }, []);

  const reset = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setState({
      status: "idle",
      nodeDetails: {},
      streamedText: "",
    });
  }, []);

  return { state, startCompilation, submitDecision, sendMessage, reset };
}
