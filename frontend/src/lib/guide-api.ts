/**
 * API client for Guide Agent with structured event handling.
 *
 * NOTE: We call the backend directly (bypassing Next.js proxy) to enable
 * proper SSE streaming. The Next.js rewrite proxy buffers responses.
 */

import { getAccessToken } from "./supabase";
import type { PageContext } from "@/stores/guideStore";

// Direct backend URL to bypass Next.js proxy buffering
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface GuideChatRequest {
  message: string;
  page_context?: PageContext | null;
  thread_id?: string | null;
  language?: string;
}

/**
 * Step in a guided workflow/tour.
 */
export interface WorkflowStep {
  title: string;
  description: string;
  highlight?: string; // Element ID to highlight
  navigate?: string; // Page path to navigate to
}

/**
 * Structured event from the guide agent.
 */
export interface GuideEvent {
  type: "token" | "action" | "error";
  // Token event
  content?: string;
  // Action event - expanded to include new action types
  action?: "highlight" | "navigate" | "show_dropdown" | "show_modal" | "click_element" | "start_workflow";
  target?: string; // for highlight, show_dropdown, click_element
  duration?: number; // for highlight, show_dropdown (ms)
  to?: string; // for navigate
  // show_modal specific
  title?: string;
  modal_type?: "info" | "tip" | "warning" | "success";
  auto_close?: number; // ms, 0 = manual close
  // start_workflow specific
  steps?: WorkflowStep[];
  // Error event
  message?: string;
}

/**
 * Send a message to the guide agent and stream the response.
 * Uses Server-Sent Events (SSE) for streaming with structured events.
 *
 * @param request - The chat request
 * @param onToken - Callback for each text token
 * @param onAction - Callback for action events (highlight, navigate)
 * @param onComplete - Callback when streaming completes
 * @param onError - Callback for errors
 */
export async function streamGuideChat(
  request: GuideChatRequest,
  onToken: (token: string) => void,
  onAction: (event: GuideEvent) => void,
  onComplete: () => void,
  onError: (error: Error) => void
): Promise<void> {
  try {
    // Get auth token
    const token = await getAccessToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    // Make request directly to backend (bypassing Next.js proxy for streaming)
    const response = await fetch(`${BACKEND_URL}/api/guide/chat`, {
      method: "POST",
      credentials: "include",
      headers,
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Check if response is SSE
    const contentType = response.headers.get("content-type");
    if (!contentType?.includes("text/event-stream")) {
      throw new Error("Expected SSE stream, got: " + contentType);
    }

    // Read SSE stream
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("No response body");
    }

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process complete SSE messages (separated by \n\n)
      const messages = buffer.split("\n\n");
      buffer = messages.pop() || ""; // Keep incomplete message in buffer

      for (const message of messages) {
        if (!message.trim()) continue;

        // Parse SSE format: "data: content"
        const lines = message.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6); // Remove "data: " prefix

            if (data === "[DONE]") {
              onComplete();
              return;
            }

            // Parse JSON event
            try {
              const event: GuideEvent = JSON.parse(data);

              if (event.type === "token" && event.content) {
                onToken(event.content);
              } else if (event.type === "action") {
                onAction(event);
              } else if (event.type === "error") {
                onError(new Error(event.message || "Unknown error"));
              }
            } catch {
              // If not JSON, treat as raw token (backwards compatibility)
              onToken(data);
            }
          }
        }
      }
    }

    onComplete();
  } catch (error) {
    onError(error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * Clear the guide session on the server.
 * This resets the conversation context.
 */
export async function clearGuideSession(): Promise<void> {
  const token = await getAccessToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  await fetch(`${BACKEND_URL}/api/guide/clear`, {
    method: "POST",
    credentials: "include",
    headers,
  });
}
