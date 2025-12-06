"use client";

import { useCallback, useRef, useState } from "react";
import type {
  StreamEvent,
  ProcessingState,
  ProcessVideoRequest,
  CompileProjectRequest,
  HITLDecision,
} from "@/lib/types";
import { useJobsStore } from "@/stores/jobsStore";
import { JobInfo } from "@/lib/api";

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
  const jobIdRef = useRef<string | null>(null);
  const { addJob, updateJob } = useJobsStore();

  const processEvent = useCallback((event: StreamEvent) => {
    // Handle job_created event - store job ID and add to jobs store
    if (event.event_type === "job_created") {
      const jobId = event.data.job_id as string;
      const videoName = event.data.video_name as string;
      jobIdRef.current = jobId;

      // Add job to the store
      addJob({
        id: jobId,
        user_id: "", // Will be filled by backend
        video_name: videoName,
        manual_id: null,
        status: "processing",
        current_node: null,
        node_index: null,
        total_nodes: null,
        error: null,
        started_at: new Date().toISOString(),
        completed_at: null,
        seen: false,
      });

      setState((prev) => ({
        ...prev,
        jobId,
      }));
      return;
    }

    // Update job store on progress events
    const jobId = jobIdRef.current;
    if (jobId) {
      if (event.event_type === "node_started") {
        updateJob(jobId, {
          current_node: event.data.node_name as string,
          node_index: event.data.node_index as number,
          total_nodes: event.data.total_nodes as number,
        });
      } else if (event.event_type === "error") {
        updateJob(jobId, {
          status: "error",
          error: event.data.error_message as string,
          completed_at: new Date().toISOString(),
        });
      } else if (event.event_type === "complete") {
        const result = event.data.result as Record<string, unknown>;
        updateJob(jobId, {
          status: "complete",
          manual_id: result?.manual_id as string,
          completed_at: new Date().toISOString(),
        });
      }
    }

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
  }, [addJob, updateJob]);

  const startProcessing = useCallback(
    (request: ProcessVideoRequest) => {
      // Immediately set state to processing so UI updates
      setState((prev) => ({
        ...prev,
        status: "processing",
        currentNode: undefined,
        nodeIndex: undefined,
        totalNodes: undefined,
        jobId: undefined,
      }));
      jobIdRef.current = null;

      return new Promise<{ jobId: string }>((resolve, reject) => {
        const userId = getUserIdFromCookie();
        const wsUrl = userId
          ? `${WS_BASE}/api/ws/process?user_id=${encodeURIComponent(userId)}`
          : `${WS_BASE}/api/ws/process`;
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        let jobCreated = false;

        ws.onopen = () => {
          ws.send(JSON.stringify({ action: "start", ...request }));
        };

        ws.onmessage = (msg) => {
          const event = JSON.parse(msg.data) as StreamEvent;
          console.log("[WS] Event:", event.event_type, event.data);
          processEvent(event);

          // Resolve early when job is created (non-blocking mode)
          if (event.event_type === "job_created" && !jobCreated) {
            jobCreated = true;
            resolve({ jobId: event.data.job_id as string });
          }

          // Still handle complete/error for cleanup
          if (event.event_type === "error" && !jobCreated) {
            reject(new Error(event.data.error_message as string));
          }
        };

        ws.onerror = () => {
          setState((prev) => ({
            ...prev,
            status: "error",
            error: "WebSocket connection failed",
          }));
          if (!jobCreated) {
            reject(new Error("WebSocket connection failed"));
          }
        };

        ws.onclose = (event) => {
          wsRef.current = null;
          // If connection closed unexpectedly during processing, update job status
          setState((prev) => {
            if (prev.status === "processing") {
              console.error("[WS Video] Connection closed unexpectedly during processing", event.code, event.reason);
              // Job continues on backend - user can track via REST API
              return prev;
            }
            return prev;
          });
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
    jobIdRef.current = null;
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

  // Batch token updates to avoid exceeding React's update limit
  const tokenBufferRef = useRef<string>("");
  const rafRef = useRef<number | null>(null);

  const flushTokenBuffer = useCallback(() => {
    if (tokenBufferRef.current) {
      const tokens = tokenBufferRef.current;
      tokenBufferRef.current = "";
      setState((prev) => ({
        ...prev,
        status: "processing",
        streamedText: prev.streamedText + tokens,
      }));
    }
    rafRef.current = null;
  }, []);

  const processEvent = useCallback((event: StreamEvent) => {
    // Batch streaming tokens to avoid exceeding React's update limit
    if (event.event_type === "llm_token") {
      tokenBufferRef.current += event.data.token as string;
      // Schedule a single update per animation frame
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(flushTokenBuffer);
      }
      return;
    }

    // Flush any pending tokens before processing other events
    if (tokenBufferRef.current) {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      flushTokenBuffer();
    }

    setState((prev) => {
      switch (event.event_type) {
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
  }, [flushTokenBuffer]);

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
        streamedText: "", // Reset for new AI response
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
    // Clean up animation frame and token buffer
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    tokenBufferRef.current = "";
    setState({
      status: "idle",
      nodeDetails: {},
      streamedText: "",
    });
  }, []);

  return { state, startCompilation, submitDecision, sendMessage, reset };
}
