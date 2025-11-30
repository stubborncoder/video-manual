/**
 * Type definitions for WebSocket events and app state
 */

// Event types matching backend
export type EventType =
  | "node_started"
  | "node_completed"
  | "llm_token"
  | "tool_call"
  | "hitl_required"
  | "error"
  | "complete";

export interface BaseEvent {
  event_type: EventType;
  timestamp: number;
  data: Record<string, unknown>;
}

export interface NodeStartedEvent extends BaseEvent {
  event_type: "node_started";
  data: {
    node_name: string;
    node_index: number;
    total_nodes: number;
  };
}

export interface NodeCompletedEvent extends BaseEvent {
  event_type: "node_completed";
  data: {
    node_name: string;
    node_index: number;
    total_nodes: number;
    details: Record<string, unknown>;
  };
}

export interface LLMTokenEvent extends BaseEvent {
  event_type: "llm_token";
  data: {
    token: string;
    is_first: boolean;
    is_last: boolean;
  };
}

export interface ToolCallEvent extends BaseEvent {
  event_type: "tool_call";
  data: {
    tool_name: string;
    tool_id: string;
    arguments: Record<string, unknown>;
  };
}

export interface HITLRequiredEvent extends BaseEvent {
  event_type: "hitl_required";
  data: {
    interrupt_id: string;
    tool_name: string;
    tool_args: Record<string, unknown>;
    message: string;
  };
}

export interface ErrorEvent extends BaseEvent {
  event_type: "error";
  data: {
    error_message: string;
    node_name?: string;
    recoverable: boolean;
  };
}

export interface CompleteEvent extends BaseEvent {
  event_type: "complete";
  data: {
    result: Record<string, unknown>;
    message: string;
  };
}

export type StreamEvent =
  | NodeStartedEvent
  | NodeCompletedEvent
  | LLMTokenEvent
  | ToolCallEvent
  | HITLRequiredEvent
  | ErrorEvent
  | CompleteEvent;

// Processing state
export interface ProcessingState {
  status: "idle" | "processing" | "hitl_pending" | "complete" | "error";
  currentNode?: string;
  nodeIndex?: number;
  totalNodes?: number;
  nodeDetails: Record<string, Record<string, unknown>>;
  streamedText: string;
  pendingHITL?: HITLRequiredEvent;
  result?: Record<string, unknown>;
  error?: string;
}

// Video processing request
export interface ProcessVideoRequest {
  video_path: string;
  output_filename?: string;
  use_scene_detection?: boolean;
  output_language?: string;
  project_id?: string;
  chapter_id?: string;
  tags?: string[];
}

// Compile project request
export interface CompileProjectRequest {
  project_id: string;
  language?: string;
  model?: string;
}

// HITL Decision
export interface HITLDecision {
  approved: boolean;
  modified_args?: Record<string, unknown>;
  feedback?: string;
}

// Compile info types for pre-compilation validation
export interface CompileInfoManual {
  id: string;
  title: string;
  available_languages: string[];
}

export interface CompileInfoChapter {
  id: string;
  title: string;
  manuals: CompileInfoManual[];
}

export interface CompileInfo {
  project: { id: string; name: string };
  chapters: CompileInfoChapter[];
  all_languages: string[];
  ready_languages: string[];
  total_manuals: number;
}

// Compile settings for starting compilation
export interface CompileSettings {
  language: string;
  includeToc: boolean;
  includeChapterCovers: boolean;
}

// Compilation version types
export interface CompilationVersionSummary {
  version: string;
  created_at: string;
  languages: string[];
  source_manual_count: number;
  notes: string;
  tags: string[];
  is_current: boolean;
  folder: string | null;
}

export interface SourceManualVersion {
  manual_id: string;
  version: string;
}

export interface MergePlanSummary {
  chapter_count: number;
  duplicates_detected: number;
  transitions_needed: number;
}

export interface CompilationVersionDetail {
  version: string;
  created_at: string;
  folder: string | null;
  languages: string[];
  source_manuals: SourceManualVersion[];
  merge_plan_summary: MergePlanSummary;
  notes: string;
  tags: string[];
  is_current: boolean;
}
