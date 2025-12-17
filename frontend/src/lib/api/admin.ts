/**
 * Admin API client
 */

import { request } from "../api";

export type UserTier = "free" | "basic" | "pro" | "enterprise";

export interface UserInfo {
  id: string;
  display_name?: string;
  email?: string;
  role: string;
  tier: UserTier;
  tester: boolean;
  created_at: string;
  last_login?: string;
  total_cost_usd: number;
}

export interface UsageSummary {
  user_id: string;
  total_requests: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cached_tokens: number;
  total_cache_read_tokens: number;
  total_cost_usd: number;
}

export interface UsageRecord {
  timestamp: string;
  operation: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  manual_id?: string;
}

export interface DailyUsage {
  date: string;
  operation: string;
  model: string;
  request_count: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cached_tokens: number;
  total_cache_read_tokens: number;
  total_cost_usd: number;
}

export interface ModelUsage {
  model: string;
  total_requests: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cached_tokens: number;
  total_cache_read_tokens: number;
  total_cost_usd: number;
}

export interface ManualUsage {
  manual_id: string;
  total_requests: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cached_tokens: number;
  total_cache_read_tokens: number;
  total_cost_usd: number;
  first_request: string;
  last_request: string;
}

// Model settings types
export interface ModelInfo {
  id: string;
  name: string;
  provider: "google" | "anthropic";
  input_cost_per_million: number;
  output_cost_per_million: number;
  supports_video: boolean;
  supports_vision: boolean;
  description?: string;
}

export interface ModelsResponse {
  video_analysis: ModelInfo[];
  manual_generation: ModelInfo[];
  manual_evaluation: ModelInfo[];
  manual_editing: ModelInfo[];
  guide_assistant: ModelInfo[];
}

export interface ModelSettings {
  video_analysis: string;
  manual_generation: string;
  manual_evaluation: string;
  manual_editing: string;
  guide_assistant: string;
}

export const adminApi = {
  /**
   * List all users
   */
  listUsers: () => request<UserInfo[]>("/api/admin/users"),

  /**
   * Get usage for a specific user
   */
  getUserUsage: (
    userId: string,
    startDate?: string,
    endDate?: string
  ) => {
    const params: Record<string, string> = {};
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    return request<UsageRecord[]>(`/api/admin/users/${userId}/usage`, { params });
  },

  /**
   * Get usage summary for all users
   */
  getUsageSummary: (startDate?: string, endDate?: string) => {
    const params: Record<string, string> = {};
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    return request<UsageSummary[]>("/api/admin/usage/summary", { params });
  },

  /**
   * Get daily usage breakdown
   */
  getDailyUsage: (startDate?: string, endDate?: string) => {
    const params: Record<string, string> = {};
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    return request<DailyUsage[]>("/api/admin/usage/daily", { params });
  },

  /**
   * Get usage breakdown by model/API
   */
  getModelUsage: (startDate?: string, endDate?: string) => {
    const params: Record<string, string> = {};
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    return request<ModelUsage[]>("/api/admin/usage/models", { params });
  },

  /**
   * Get usage breakdown by manual
   */
  getManualUsage: (startDate?: string, endDate?: string) => {
    const params: Record<string, string> = {};
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    return request<ManualUsage[]>("/api/admin/usage/manuals", { params });
  },

  /**
   * Set user role
   */
  setUserRole: (userId: string, role: "user" | "admin") =>
    request<{ user_id: string; role: string }>(
      `/api/admin/users/${userId}/role`,
      {
        method: "POST",
        body: JSON.stringify({ role }),
      }
    ),

  /**
   * Set user tier
   */
  setUserTier: (userId: string, tier: UserTier) =>
    request<{ user_id: string; tier: string }>(
      `/api/admin/users/${userId}/tier`,
      {
        method: "POST",
        body: JSON.stringify({ tier }),
      }
    ),

  /**
   * Set user tester status
   */
  setUserTester: (userId: string, tester: boolean) =>
    request<{ user_id: string; tester: boolean }>(
      `/api/admin/users/${userId}/tester`,
      {
        method: "POST",
        body: JSON.stringify({ tester }),
      }
    ),

  // ==================== Model Settings ====================

  /**
   * Get available models for each task type
   */
  getAvailableModels: () =>
    request<ModelsResponse>("/api/admin/models"),

  /**
   * Get current model settings
   */
  getModelSettings: () =>
    request<ModelSettings>("/api/admin/settings/models"),

  /**
   * Update model settings
   */
  updateModelSettings: (settings: Partial<ModelSettings>) =>
    request<{ status: string; updated: Record<string, boolean> }>(
      "/api/admin/settings/models",
      {
        method: "PUT",
        body: JSON.stringify(settings),
      }
    ),
};
