/**
 * Bug Tracker API client - GitHub Issues integration
 */

import { request } from "../api";

// Types

export interface BugSummary {
  number: number;
  title: string;
  state: "open" | "closed";
  url: string;
  created_at: string;
  labels: string[];
  comments_count: number;
}

export interface BugListResponse {
  issues: BugSummary[];
  count: number;
}

export interface CommentInfo {
  id: number;
  body: string;
  author: string;
  created_at: string;
}

export interface BugDetail {
  number: number;
  title: string;
  body: string;
  state: "open" | "closed";
  url: string;
  created_at: string;
  updated_at: string;
  labels: string[];
  author: string;
  comments: CommentInfo[];
}

export interface CommentResponse {
  id: number;
  url: string;
  message: string;
}

// API Functions

export const bugsApi = {
  /**
   * List all bugs/issues
   */
  list: (status: "open" | "closed" | "all" = "open", search?: string) => {
    const params: Record<string, string> = { status };
    if (search) params.search = search;
    return request<BugListResponse>("/api/bugs", { params });
  },

  /**
   * Get detailed information about a specific bug/issue
   */
  get: (issueNumber: number) =>
    request<BugDetail>(`/api/bugs/${issueNumber}`),

  /**
   * Add a comment to an issue
   */
  addComment: (issueNumber: number, body: string) =>
    request<CommentResponse>(`/api/bugs/${issueNumber}/comments`, {
      method: "POST",
      body: JSON.stringify({ body }),
    }),
};

// Helper functions

/**
 * Get category from labels
 */
export function getCategoryFromLabels(labels: string[]): string {
  if (labels.includes("vdocs:bug")) return "bug";
  if (labels.includes("vdocs:feature")) return "feature";
  if (labels.includes("vdocs:feedback")) return "feedback";
  if (labels.includes("vdocs:question")) return "question";
  return "other";
}

/**
 * Get readable category name
 */
export function getCategoryName(category: string): string {
  const names: Record<string, string> = {
    bug: "Bug",
    feature: "Feature Request",
    feedback: "Feedback",
    question: "Question",
    other: "Other",
  };
  return names[category] || category;
}

/**
 * Get category color class
 */
export function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    bug: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    feature: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400",
    feedback: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    question: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400",
    other: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
  };
  return colors[category] || colors.other;
}
