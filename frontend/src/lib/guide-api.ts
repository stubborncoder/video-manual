/**
 * API client for Guide Agent
 */

import { getAccessToken } from "./supabase";
import type { PageContext } from "@/stores/guideStore";

interface GuideChatRequest {
  message: string;
  page_context?: PageContext | null;
  thread_id?: string | null;
}

/**
 * Send a message to the guide agent and stream the response
 * Uses Server-Sent Events (SSE) for streaming
 */
export async function streamGuideChat(
  request: GuideChatRequest,
  onChunk: (chunk: string) => void,
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

    // Make request
    const response = await fetch("/api/guide/chat", {
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

            onChunk(data);
          }
        }
      }
    }

    onComplete();
  } catch (error) {
    onError(error instanceof Error ? error : new Error(String(error)));
  }
}
