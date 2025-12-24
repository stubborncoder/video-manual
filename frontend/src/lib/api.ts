/**
 * API client for Video Manual Platform backend
 * Uses Next.js rewrites to proxy /api/* to the backend
 */

import { getAccessToken } from "./supabase";

const API_BASE = "";

interface RequestOptions extends RequestInit {
  params?: Record<string, string>;
  /** Skip adding Authorization header (useful for auth endpoints) */
  skipAuth?: boolean;
}

export async function request<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { params, skipAuth, ...fetchOptions } = options;

  let url = `${API_BASE}${endpoint}`;
  if (params) {
    const searchParams = new URLSearchParams(params);
    url += `?${searchParams.toString()}`;
  }

  // Get Supabase access token if available (and not skipping auth)
  let authHeader: Record<string, string> = {};
  if (!skipAuth) {
    const token = await getAccessToken();
    if (token) {
      authHeader = { Authorization: `Bearer ${token}` };
    }
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...fetchOptions,
      credentials: "include", // Still include cookies for legacy auth
      cache: "no-store", // Disable caching for API requests
      headers: {
        "Content-Type": "application/json",
        ...authHeader,
        ...fetchOptions.headers,
      },
    });
  } catch (e) {
    // Network error - backend probably not running
    throw new Error("Cannot connect to server. Is the backend running?");
  }

  // Check content type to avoid parsing HTML as JSON
  const contentType = response.headers.get("content-type");
  const isJson = contentType?.includes("application/json");

  if (!response.ok) {
    if (!isJson) {
      // Got HTML error page (e.g., 404 from Next.js when backend is down)
      throw new Error(`Server error: ${response.status} ${response.statusText}`);
    }
    const error = await response.json().catch(() => ({ detail: `HTTP ${response.status} ${response.statusText}` }));
    // Handle FastAPI validation errors which return detail as an array
    let errorMessage: string;
    if (Array.isArray(error.detail)) {
      // Validation errors: extract messages from each error object
      errorMessage = error.detail.map((e: { msg?: string; loc?: string[] }) =>
        e.msg || JSON.stringify(e)
      ).join(", ");
    } else if (typeof error.detail === 'object') {
      errorMessage = JSON.stringify(error.detail);
    } else {
      errorMessage = error.detail || `HTTP ${response.status} ${response.statusText}`;
    }
    throw new Error(errorMessage);
  }

  // Handle successful responses with no content (204) or empty body
  if (response.status === 204 || !isJson) {
    return {} as T;
  }

  return response.json();
}

// Auth
export const auth = {
  login: (userId: string) =>
    request<{ user_id: string; created_at: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ user_id: userId }),
    }),

  logout: () =>
    request<{ status: string }>("/api/auth/logout", { method: "POST" }),

  me: () =>
    request<{ authenticated: boolean; user_id?: string; role?: string }>("/api/auth/me"),
};

// Videos
export interface VideoInfo {
  name: string;
  path: string;
  size_bytes: number;
  modified_at: string;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percent: number;
}

export interface VideoManualInfo {
  doc_id: string;
  video_path: string;
  languages: string[];
  created_at: string | null;
  project_id: string | null;
}

export const videos = {
  list: () => request<{ videos: VideoInfo[] }>("/api/videos"),

  upload: async (
    file: File,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<VideoInfo> => {
    // Get auth token before starting upload
    const token = await getAccessToken();

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const formData = new FormData();
      formData.append("file", file);

      // Track upload progress
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress({
            loaded: e.loaded,
            total: e.total,
            percent: Math.round((e.loaded / e.total) * 100),
          });
        }
      });

      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch {
            reject(new Error("Invalid response from server"));
          }
        } else {
          try {
            const error = JSON.parse(xhr.responseText);
            reject(new Error(error.detail || `Upload failed: HTTP ${xhr.status}`));
          } catch {
            reject(new Error(`Upload failed: HTTP ${xhr.status}`));
          }
        }
      });

      xhr.addEventListener("error", () => reject(new Error("Network error during upload")));
      xhr.addEventListener("abort", () => reject(new Error("Upload cancelled")));

      xhr.open("POST", "/api/videos/upload");
      xhr.withCredentials = true;
      // Add Authorization header for Supabase auth
      if (token) {
        xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      }
      xhr.send(formData);
    });
  },

  getManuals: (videoName: string) =>
    request<{ video_name: string; manual_count: number; manuals: VideoManualInfo[] }>(
      `/api/videos/${encodeURIComponent(videoName)}/manuals`
    ),

  delete: (videoName: string, cascade = false) =>
    request<{ status: string; affected_manuals: string[] }>(
      `/api/videos/${encodeURIComponent(videoName)}`,
      { method: "DELETE", params: { cascade: String(cascade) } }
    ),

  getFormats: () =>
    request<{ formats: Record<string, { label: string; description: string }> }>(
      "/api/videos/formats"
    ),
};

// Manuals
export interface SourceVideoInfo {
  name: string;
  exists: boolean;
}

export interface LanguageEvaluation {
  score: number | null;
  evaluated: boolean;
}

export interface DocSummary {
  id: string;
  title: string;
  created_at: string | null;
  screenshot_count: number;
  languages: string[];
  evaluations: Record<string, LanguageEvaluation>;
  source_video?: SourceVideoInfo;
  project_id?: string;
  target_audience?: string;
  target_objective?: string;
  document_format?: string;
}

export interface DocDetail {
  id: string;
  title: string;
  content: string;
  language: string;
  screenshots: string[];
  source_video?: SourceVideoInfo;
  document_format?: string;
}

// Additional video sources for screenshot replacement
export interface AdditionalVideoInfo {
  id: string;
  filename: string;
  label: string;
  language?: string;
  duration_seconds: number;
  size_bytes: number;
  added_at?: string;
  exists: boolean;
}

export interface PrimaryVideoInfo {
  id: string;  // Always "primary"
  filename: string;
  label: string;
  duration_seconds: number;
  exists: boolean;
}

export interface DocVideosResponse {
  primary: PrimaryVideoInfo;
  additional: AdditionalVideoInfo[];
}

export interface AdditionalVideoUploadResponse {
  id: string;
  filename: string;
  label: string;
  language?: string;
  duration_seconds: number;
  size_bytes: number;
}

export interface VersionInfo {
  version: string;
  created_at: string;
  notes: string;
  is_current: boolean;
  snapshot_dir?: string;
}

export interface EvaluationScoreCategory {
  score: number;
  explanation: string;
}

export interface DocEvaluation {
  doc_id: string;
  language: string;
  target_audience?: string;
  target_objective?: string;
  overall_score: number;
  summary: string;
  strengths: string[];
  areas_for_improvement: string[];
  // Context-dependent categories (only one set will be present)
  objective_alignment?: EvaluationScoreCategory;    // When target context provided
  audience_appropriateness?: EvaluationScoreCategory; // When target context provided
  general_usability?: EvaluationScoreCategory;      // When no target context
  // Always-present categories
  clarity_and_completeness?: EvaluationScoreCategory;
  technical_accuracy?: EvaluationScoreCategory;
  structure_and_flow?: EvaluationScoreCategory;
  // Metadata
  recommendations: string[];
  evaluated_at: string;
  score_range?: {
    min: number;
    max: number;
  };
}

export const docs = {
  list: () => request<{ docs: DocSummary[] }>("/api/docs"),

  get: (docId: string, language = "en") =>
    request<DocDetail>(`/api/docs/${docId}`, { params: { language } }),

  getLanguages: (docId: string) =>
    request<{ doc_id: string; languages: string[] }>(
      `/api/docs/${docId}/languages`
    ),

  updateContent: (docId: string, content: string, language = "en") =>
    request<{ status: string; doc_id: string; language: string; path: string }>(
      `/api/docs/${docId}/content`,
      { method: "PUT", body: JSON.stringify({ content, language }) }
    ),

  updateTitle: (docId: string, title: string) =>
    request<{ status: string; doc_id: string; title: string }>(
      `/api/docs/${docId}/title`,
      { method: "PUT", body: JSON.stringify({ title }) }
    ),

  delete: (docId: string) =>
    request<{ status: string }>(`/api/docs/${docId}`, { method: "DELETE" }),

  getTags: (docId: string) =>
    request<{ doc_id: string; tags: string[] }>(`/api/docs/${docId}/tags`),

  addTags: (docId: string, tags: string[]) =>
    request<{ doc_id: string; added_tags: string[] }>(
      `/api/docs/${docId}/tags`,
      { method: "POST", body: JSON.stringify(tags) }
    ),

  removeTag: (docId: string, tag: string) =>
    request<{ doc_id: string; removed_tag: string }>(
      `/api/docs/${docId}/tags/${encodeURIComponent(tag)}`,
      { method: "DELETE" }
    ),

  // Version history
  listVersions: (docId: string, language?: string) =>
    request<{
      doc_id: string;
      current_version: string;
      versions: VersionInfo[];
    }>(`/api/docs/${docId}/versions${language ? `?language=${language}` : ""}`),

  getVersionContent: (docId: string, version: string, language = "en") =>
    request<{
      doc_id: string;
      version: string;
      language: string;
      content: string;
    }>(`/api/docs/${docId}/versions/${version}/content`, {
      params: { language },
    }),

  restoreVersion: (docId: string, version: string, language = "en") =>
    request<{
      doc_id: string;
      restored_version: string;
      language: string;
      new_current_version: string;
    }>(`/api/docs/${docId}/versions/${version}/restore`, {
      method: "POST",
      params: { language },
    }),

  createVersionSnapshot: (docId: string, bumpType: "minor" | "major" = "minor", notes = "") =>
    request<{
      doc_id: string;
      new_version: string;
      bump_type: string;
      notes: string;
    }>(`/api/docs/${docId}/versions/snapshot`, {
      method: "POST",
      params: { bump_type: bumpType, notes },
    }),

  // Export manual to various formats
  export: (
    docId: string,
    format: "pdf" | "word" | "html" | "chunks" | "markdown" = "pdf",
    language = "en",
    embedImages = true,
    templateName?: string
  ) =>
    request<{
      status: string;
      doc_id: string;
      format: string;
      language: string;
      template: string | null;
      filename: string;
      download_url: string;
      size_bytes: number;
      created_at: string;
    }>(`/api/docs/${docId}/export`, {
      method: "POST",
      body: JSON.stringify({
        format,
        language,
        embed_images: embedImages,
        template_name: templateName,
      }),
    }),

  listExports: (docId: string) =>
    request<{
      doc_id: string;
      exports: Array<{
        filename: string;
        format: string;
        language: string;
        download_url: string;
        size_bytes: number;
        created_at: string;
      }>;
    }>(`/api/docs/${docId}/exports`),

  evaluate: (docId: string, language = "en", userLanguage?: string) =>
    request<DocEvaluation>(`/api/docs/${docId}/evaluate`, {
      method: "POST",
      body: JSON.stringify({ language, user_language: userLanguage }),
    }),

  // Stored evaluations
  listEvaluations: (docId: string) =>
    request<{
      doc_id: string;
      evaluations: Array<{
        version: string;
        language: string;
        overall_score: number;
        evaluated_at: string;
        stored_at: string;
      }>;
    }>(`/api/docs/${docId}/evaluations`),

  getEvaluation: (docId: string, version: string, language = "en") =>
    request<DocEvaluation>(`/api/docs/${docId}/evaluations/${version}`, {
      params: { language },
    }),

  // Clone manual to different document format
  clone: (
    docId: string,
    documentFormat: string,
    title?: string,
    reformatContent = false
  ) =>
    request<DocSummary>(`/api/docs/${docId}/clone`, {
      method: "POST",
      body: JSON.stringify({
        document_format: documentFormat,
        title,
        reformat_content: reformatContent,
      }),
    }),

  // Additional video sources for screenshot replacement
  listVideos: (docId: string) =>
    request<DocVideosResponse>(`/api/docs/${docId}/videos`),

  uploadVideo: async (
    docId: string,
    file: File,
    label?: string,
    language?: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<AdditionalVideoUploadResponse> => {
    const formData = new FormData();
    formData.append("file", file);

    // Build query params
    const params = new URLSearchParams();
    if (label) params.append("label", label);
    if (language) params.append("language", language);
    const queryString = params.toString();

    // Upload directly to backend to bypass Next.js 10MB proxy limit
    // In production, this should be configured via environment variable
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const url = `${backendUrl}/api/docs/${docId}/videos${queryString ? `?${queryString}` : ""}`;

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", url);
      xhr.withCredentials = true;

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) {
          onProgress({
            loaded: event.loaded,
            total: event.total,
            percent: Math.round((event.loaded / event.total) * 100),
          });
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(JSON.parse(xhr.responseText));
        } else {
          try {
            const error = JSON.parse(xhr.responseText);
            reject(new Error(error.detail || `Upload failed: ${xhr.status}`));
          } catch {
            reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
          }
        }
      };

      xhr.onerror = () => reject(new Error("Network error during upload"));
      xhr.send(formData);
    });
  },

  deleteVideo: (docId: string, videoId: string) =>
    request<{ status: string; video_id: string }>(
      `/api/docs/${docId}/videos/${videoId}`,
      { method: "DELETE" }
    ),

  getVideoStreamUrl: (docId: string, videoId: string) =>
    `/api/docs/${docId}/videos/${videoId}/stream`,
};

// Manual project assignment
export const docProject = {
  assign: (docId: string, projectId: string, chapterId?: string) =>
    request<{ doc_id: string; project_id: string; chapter_id: string | null }>(
      `/api/docs/${docId}/project`,
      { method: "PUT", body: JSON.stringify({ project_id: projectId, chapter_id: chapterId }) }
    ),

  remove: (docId: string) =>
    request<{ doc_id: string; removed_from_project: string }>(
      `/api/docs/${docId}/project`,
      { method: "DELETE" }
    ),
};

// Share link management
export interface ShareInfo {
  doc_id: string;
  token: string;
  language: string;
  share_url: string;
  created_at: string;
  expires_at: string | null;
}

export interface ShareStatus {
  doc_id: string;
  is_shared: boolean;
  share_info: ShareInfo | null;
}

export const docShare = {
  create: (docId: string, language: string = "en") =>
    request<ShareInfo>(`/api/docs/${docId}/share`, {
      method: "POST",
      body: JSON.stringify({ language }),
    }),

  getStatus: (docId: string) =>
    request<ShareStatus>(`/api/docs/${docId}/share`),

  revoke: (docId: string) =>
    request<{ status: string; message: string }>(`/api/docs/${docId}/share`, {
      method: "DELETE",
    }),
};

// Public share view (no auth required)
export interface SharedDocInfo {
  title: string;
  language: string;
  content_html: string;
  created_at: string | null;
  updated_at: string | null;
  version: string | null;
  document_format: string | null;
}

export const publicShare = {
  getDoc: (token: string) =>
    request<SharedDocInfo>(`/api/share/${token}`),
};

// Project sharing
export interface ProjectShareInfo {
  project_id: string;
  token: string;
  language: string;
  share_url: string;
  created_at: string;
  expires_at: string | null;
}

export interface ProjectShareStatus {
  project_id: string;
  is_shared: boolean;
  is_compiled: boolean;
  share_info: ProjectShareInfo | null;
}

export interface TocItem {
  id: string;
  title: string;
  level: number;
}

export interface SharedProjectInfo {
  title: string;
  description: string;
  language: string;
  content_html: string;
  toc: TocItem[];
  updated_at: string | null;
  version: string | null;
}

export const projectShare = {
  create: (projectId: string, language: string = "en") =>
    request<ProjectShareInfo>(`/api/projects/${projectId}/share`, {
      method: "POST",
      body: JSON.stringify({ language }),
    }),

  getStatus: (projectId: string) =>
    request<ProjectShareStatus>(`/api/projects/${projectId}/share`),

  revoke: (projectId: string) =>
    request<{ status: string; message: string }>(`/api/projects/${projectId}/share`, {
      method: "DELETE",
    }),
};

export const publicProjectShare = {
  getProject: (token: string) =>
    request<SharedProjectInfo>(`/api/share/project/${token}`),
};

// Projects
export interface ProjectSummary {
  id: string;
  name: string;
  description: string;
  created_at: string;
  manual_count: number;
  chapter_count?: number;
  is_default?: boolean;
}

export interface ChapterInfo {
  id: string;
  title: string;
  description: string;
  order: number;
}

export interface SectionInfo {
  id: string;
  title: string;
  description: string;
  order: number;
  chapters: string[];  // List of chapter IDs in this section
}

export interface ProjectVideoInfo {
  name: string;
  path: string;
  exists: boolean;
  manual_count: number;
}

export interface ProjectDetail {
  id: string;
  name: string;
  description: string;
  created_at: string;
  is_default?: boolean;
  sections: SectionInfo[];
  chapters: ChapterInfo[];
  manuals: { doc_id: string; chapter_id: string | null; order: number }[];
  videos: ProjectVideoInfo[];
}

export const projects = {
  list: () => request<{ projects: ProjectSummary[] }>("/api/projects"),

  getDefault: () => request<ProjectSummary>("/api/projects/default"),

  create: (name: string, description = "") =>
    request<ProjectSummary>("/api/projects", {
      method: "POST",
      body: JSON.stringify({ name, description }),
    }),

  get: (projectId: string) => request<ProjectDetail>(`/api/projects/${projectId}`),

  update: (projectId: string, name?: string, description?: string) =>
    request<{ id: string; name: string; description: string }>(
      `/api/projects/${projectId}`,
      { method: "PUT", body: JSON.stringify({ name, description }) }
    ),

  delete: (projectId: string, deleteManuals = false) =>
    request<{ status: string; affected_manuals: string[] }>(`/api/projects/${projectId}`, {
      method: "DELETE",
      params: { delete_manuals: String(deleteManuals) },
    }),

  addChapter: (projectId: string, title: string, description = "") =>
    request<ChapterInfo>(`/api/projects/${projectId}/chapters`, {
      method: "POST",
      body: JSON.stringify({ title, description }),
    }),

  updateChapter: (projectId: string, chapterId: string, title?: string, description?: string) =>
    request<ChapterInfo>(
      `/api/projects/${projectId}/chapters/${chapterId}`,
      { method: "PUT", body: JSON.stringify({ title, description }) }
    ),

  deleteChapter: (projectId: string, chapterId: string) =>
    request<{ status: string }>(
      `/api/projects/${projectId}/chapters/${chapterId}`,
      { method: "DELETE" }
    ),

  reorderChapters: (projectId: string, order: string[]) =>
    request<{ status: string }>(
      `/api/projects/${projectId}/chapters/reorder`,
      { method: "PUT", body: JSON.stringify({ order }) }
    ),

  // Section operations
  addSection: (projectId: string, title: string, description = "") =>
    request<SectionInfo>(`/api/projects/${projectId}/sections`, {
      method: "POST",
      body: JSON.stringify({ title, description }),
    }),

  updateSection: (projectId: string, sectionId: string, title?: string, description?: string) =>
    request<SectionInfo>(
      `/api/projects/${projectId}/sections/${sectionId}`,
      { method: "PUT", body: JSON.stringify({ title, description }) }
    ),

  deleteSection: (projectId: string, sectionId: string) =>
    request<{ status: string }>(
      `/api/projects/${projectId}/sections/${sectionId}`,
      { method: "DELETE" }
    ),

  reorderSections: (projectId: string, order: string[]) =>
    request<{ status: string }>(
      `/api/projects/${projectId}/sections/reorder`,
      { method: "PUT", body: JSON.stringify({ order }) }
    ),

  moveChapterToSection: (projectId: string, sectionId: string, chapterId: string) =>
    request<{ status: string }>(
      `/api/projects/${projectId}/sections/${sectionId}/chapters/${chapterId}`,
      { method: "PUT" }
    ),

  removeChapterFromSection: (projectId: string, sectionId: string, chapterId: string) =>
    request<{ status: string }>(
      `/api/projects/${projectId}/sections/${sectionId}/chapters/${chapterId}`,
      { method: "DELETE" }
    ),

  addManual: (projectId: string, docId: string, chapterId?: string) =>
    request<{ status: string }>(
      `/api/projects/${projectId}/manuals/${docId}`,
      { method: "POST", params: chapterId ? { chapter_id: chapterId } : undefined }
    ),

  removeManual: (projectId: string, docId: string) =>
    request<{ status: string }>(
      `/api/projects/${projectId}/manuals/${docId}`,
      { method: "DELETE" }
    ),

  moveManualToChapter: (projectId: string, docId: string, chapterId: string) =>
    request<{ status: string }>(
      `/api/projects/${projectId}/manuals/${docId}/chapter`,
      { method: "PUT", params: { chapter_id: chapterId } }
    ),

  reorderManualsInChapter: (projectId: string, chapterId: string, order: string[]) =>
    request<{ status: string }>(
      `/api/projects/${projectId}/chapters/${chapterId}/manuals/reorder`,
      { method: "PUT", body: JSON.stringify({ order }) }
    ),

  export: (
    projectId: string,
    format: "pdf" | "word" | "html" | "chunks" | "markdown" = "pdf",
    language = "en",
    templateName?: string
  ) =>
    request<{ output_path: string; format: string }>(
      `/api/projects/${projectId}/export`,
      {
        method: "POST",
        body: JSON.stringify({
          project_id: projectId,
          format,
          language,
          template_name: templateName,
        }),
      }
    ),

  getCompileInfo: (projectId: string) =>
    request<{
      project: { id: string; name: string };
      chapters: {
        id: string;
        title: string;
        manuals: {
          id: string;
          title: string;
          available_languages: string[];
        }[];
      }[];
      all_languages: string[];
      ready_languages: string[];
      total_manuals: number;
    }>(`/api/projects/${projectId}/compile-info`),
};

// Compilation Versions
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

export interface CompilationVersionDetail extends CompilationVersionSummary {
  source_manuals: { doc_id: string; version: string }[];
  merge_plan_summary: {
    chapter_count: number;
    duplicates_detected: number;
    transitions_needed: number;
  };
}

export const compilations = {
  list: (projectId: string) =>
    request<{ versions: CompilationVersionSummary[] }>(
      `/api/projects/${projectId}/compilations`
    ),

  get: (projectId: string, version: string) =>
    request<CompilationVersionDetail>(
      `/api/projects/${projectId}/compilations/${version}`
    ),

  getContent: (projectId: string, version: string, language: string) =>
    request<{ content: string; version: string; language: string }>(
      `/api/projects/${projectId}/compilations/${version}/content/${language}`
    ),

  getScreenshotUrl: (projectId: string, version: string, filename: string) =>
    `/api/projects/${projectId}/compilations/${version}/screenshots/${filename}`,

  restore: (projectId: string, version: string) =>
    request<{ status: string; restored_version: string; new_version: string }>(
      `/api/projects/${projectId}/compilations/${version}/restore`,
      { method: "POST" }
    ),

  delete: (projectId: string, version: string) =>
    request<{ status: string }>(
      `/api/projects/${projectId}/compilations/${version}`,
      { method: "DELETE" }
    ),

  updateMetadata: (
    projectId: string,
    version: string,
    notes?: string,
    tags?: string[]
  ) =>
    request<{ status: string }>(
      `/api/projects/${projectId}/compilations/${version}`,
      { method: "PATCH", body: JSON.stringify({ notes, tags }) }
    ),

  export: (
    projectId: string,
    version: string,
    format: "pdf" | "word" | "html" = "pdf",
    language = "en"
  ) =>
    request<{ format: string; filename: string; download_url: string }>(
      `/api/projects/${projectId}/compilations/${version}/export`,
      {
        method: "POST",
        body: JSON.stringify({ format, language }),
      }
    ),
};

// Project Exports
export interface ExportFile {
  filename: string;
  format: string;
  size_bytes: number;
  created_at: string;
  version: string | null;
  language: string | null;
  download_url: string;
}

export const exports = {
  list: (projectId: string) =>
    request<{ exports: ExportFile[] }>(`/api/projects/${projectId}/exports`),

  // Helper to trigger download from a URL
  download: (url: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = "";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  },
};

// Jobs
export interface JobInfo {
  id: string;
  user_id: string;
  video_name: string;
  doc_id: string | null;
  status: "pending" | "processing" | "complete" | "error";
  current_node: string | null;
  node_index: number | null;
  total_nodes: number | null;
  error: string | null;
  started_at: string | null;
  completed_at: string | null;
  seen: boolean;
}

export const jobs = {
  list: (status?: string, includeSeen = true) =>
    request<{ jobs: JobInfo[] }>("/api/jobs", {
      params: {
        ...(status && { status }),
        include_seen: String(includeSeen),
      },
    }),

  listActive: () => request<{ jobs: JobInfo[] }>("/api/jobs/active"),

  get: (jobId: string) => request<JobInfo>(`/api/jobs/${jobId}`),

  markSeen: (jobId: string) =>
    request<{ status: string }>(`/api/jobs/${jobId}/seen`, { method: "POST" }),
};

// Trash
export interface TrashItem {
  trash_id: string;
  item_type: "video" | "manual" | "project";
  original_name: string;
  deleted_at: string;
  expires_at: string;
  cascade_deleted: boolean;
  related_items: string[];
}

export interface TrashStats {
  videos: number;
  manuals: number;
  projects: number;
  total: number;
}

export const trash = {
  list: (itemType?: "video" | "manual" | "project") =>
    request<{ items: TrashItem[]; stats: TrashStats }>(
      "/api/trash",
      itemType ? { params: { item_type: itemType } } : undefined
    ),

  restore: (itemType: "video" | "manual" | "project", trashId: string) =>
    request<{ restored_path: string; item_type: string; original_name: string }>(
      `/api/trash/${itemType}/${trashId}/restore`,
      { method: "POST" }
    ),

  permanentDelete: (itemType: "video" | "manual" | "project", trashId: string) =>
    request<{ status: string }>(`/api/trash/${itemType}/${trashId}`, { method: "DELETE" }),

  empty: () => request<{ status: string; deleted_count: number }>("/api/trash/empty", { method: "DELETE" }),
};

// Templates
export interface TemplateInfo {
  name: string;
  is_global: boolean;
  size_bytes: number;
  uploaded_at: string | null;
  document_format: string | null;  // e.g., "step-manual", "quick-guide", etc.
}

export const templates = {
  list: () =>
    request<{ templates: TemplateInfo[]; user_count: number; global_count: number }>(
      "/api/templates"
    ),

  upload: (file: File, name?: string, documentFormat?: string): Promise<{ name: string; size_bytes: number; message: string }> => {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append("file", file);
      if (name) {
        formData.append("name", name);
      }
      if (documentFormat) {
        formData.append("document_format", documentFormat);
      }

      fetch("/api/templates", {
        method: "POST",
        body: formData,
        credentials: "include",
      })
        .then(async (response) => {
          const data = await response.json();
          if (!response.ok) {
            reject(new Error(data.detail || "Upload failed"));
          } else {
            resolve(data);
          }
        })
        .catch(() => reject(new Error("Network error during upload")));
    });
  },

  download: (templateName: string) => `/api/templates/${encodeURIComponent(templateName)}`,

  getInfo: (templateName: string) =>
    request<TemplateInfo>(`/api/templates/${encodeURIComponent(templateName)}/info`),

  delete: (templateName: string) =>
    request<{ name: string; deleted: boolean; message: string }>(
      `/api/templates/${encodeURIComponent(templateName)}`,
      { method: "DELETE" }
    ),
};

export default { auth, videos, docs, docProject, projects, compilations, exports, jobs, trash, templates };
