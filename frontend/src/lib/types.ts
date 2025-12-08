/**
 * Type definitions for WebSocket events and app state
 */

// Event types matching backend
export type EventType =
  | "job_created"
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

export interface JobCreatedEvent extends BaseEvent {
  event_type: "job_created";
  data: {
    job_id: string;
    video_name: string;
  };
}

export type StreamEvent =
  | JobCreatedEvent
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
  jobId?: string; // Job ID for tracking persistent jobs
}

// Video processing request
export interface ProcessVideoRequest {
  video_path?: string;  // Required for new manual from video
  manual_id?: string;   // Required for add-language flow (loads video from metadata)
  output_filename?: string;
  use_scene_detection?: boolean;
  output_language?: string;
  document_format?: string;  // e.g., "step-manual", "quick-guide", "reference", "summary"
  project_id?: string;
  chapter_id?: string;
  tags?: string[];
  target_audience?: string;  // e.g., "Beginners", "Advanced Users"
  target_objective?: string; // e.g., "Quick tutorial", "Comprehensive guide"
}

// Document format option
export interface DocumentFormat {
  label: string;
  description: string;
}

// Manual evaluation request
export interface ManualEvaluationRequest {
  language?: string;
}

// Evaluation score category with score and explanation
export interface EvaluationScoreCategory {
  score: number;
  explanation: string;
}

// Manual evaluation response (matches backend format)
export interface ManualEvaluationResponse {
  manual_id: string;
  language: string;
  target_audience?: string;
  target_objective?: string;
  overall_score: number;
  summary: string;
  strengths: string[];
  areas_for_improvement: string[];
  // Core evaluation categories
  objective_alignment: EvaluationScoreCategory;
  audience_appropriateness: EvaluationScoreCategory;
  clarity_and_completeness: EvaluationScoreCategory;
  // Extended evaluation categories
  technical_accuracy?: EvaluationScoreCategory;
  structure_and_flow?: EvaluationScoreCategory;
  // Recommendations and metadata
  recommendations: string[];
  evaluated_at: string;
  score_range: {
    min: number;
    max: number;
  };
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
