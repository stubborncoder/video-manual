/**
 * API client for Video Manual Platform backend
 * Uses Next.js rewrites to proxy /api/* to the backend
 */

const API_BASE = "";

interface RequestOptions extends RequestInit {
  params?: Record<string, string>;
}

export async function request<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { params, ...fetchOptions } = options;

  let url = `${API_BASE}${endpoint}`;
  if (params) {
    const searchParams = new URLSearchParams(params);
    url += `?${searchParams.toString()}`;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...fetchOptions,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
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

  // Successful response but not JSON (shouldn't happen, but handle it)
  if (!isJson) {
    throw new Error("Server returned non-JSON response");
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
  manual_id: string;
  video_path: string;
  languages: string[];
  created_at: string | null;
  project_id: string | null;
}

export const videos = {
  list: () => request<{ videos: VideoInfo[] }>("/api/videos"),

  upload: (
    file: File,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<VideoInfo> => {
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

export interface ManualSummary {
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
}

export interface ManualDetail {
  id: string;
  title: string;
  content: string;
  language: string;
  screenshots: string[];
  source_video?: SourceVideoInfo;
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

export interface ManualEvaluation {
  manual_id: string;
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

export const manuals = {
  list: () => request<{ manuals: ManualSummary[] }>("/api/manuals"),

  get: (manualId: string, language = "en") =>
    request<ManualDetail>(`/api/manuals/${manualId}`, { params: { language } }),

  getLanguages: (manualId: string) =>
    request<{ manual_id: string; languages: string[] }>(
      `/api/manuals/${manualId}/languages`
    ),

  updateContent: (manualId: string, content: string, language = "en") =>
    request<{ status: string; manual_id: string; language: string; path: string }>(
      `/api/manuals/${manualId}/content`,
      { method: "PUT", body: JSON.stringify({ content, language }) }
    ),

  updateTitle: (manualId: string, title: string) =>
    request<{ status: string; manual_id: string; title: string }>(
      `/api/manuals/${manualId}/title`,
      { method: "PUT", body: JSON.stringify({ title }) }
    ),

  delete: (manualId: string) =>
    request<{ status: string }>(`/api/manuals/${manualId}`, { method: "DELETE" }),

  getTags: (manualId: string) =>
    request<{ manual_id: string; tags: string[] }>(`/api/manuals/${manualId}/tags`),

  addTags: (manualId: string, tags: string[]) =>
    request<{ manual_id: string; added_tags: string[] }>(
      `/api/manuals/${manualId}/tags`,
      { method: "POST", body: JSON.stringify(tags) }
    ),

  removeTag: (manualId: string, tag: string) =>
    request<{ manual_id: string; removed_tag: string }>(
      `/api/manuals/${manualId}/tags/${encodeURIComponent(tag)}`,
      { method: "DELETE" }
    ),

  // Version history
  listVersions: (manualId: string) =>
    request<{
      manual_id: string;
      current_version: string;
      versions: VersionInfo[];
    }>(`/api/manuals/${manualId}/versions`),

  getVersionContent: (manualId: string, version: string, language = "en") =>
    request<{
      manual_id: string;
      version: string;
      language: string;
      content: string;
    }>(`/api/manuals/${manualId}/versions/${version}/content`, {
      params: { language },
    }),

  restoreVersion: (manualId: string, version: string, language = "en") =>
    request<{
      manual_id: string;
      restored_version: string;
      language: string;
      new_current_version: string;
    }>(`/api/manuals/${manualId}/versions/${version}/restore`, {
      method: "POST",
      params: { language },
    }),

  createVersionSnapshot: (manualId: string, bumpType: "minor" | "major" = "minor", notes = "") =>
    request<{
      manual_id: string;
      new_version: string;
      bump_type: string;
      notes: string;
    }>(`/api/manuals/${manualId}/versions/snapshot`, {
      method: "POST",
      params: { bump_type: bumpType, notes },
    }),

  // Export manual to various formats
  export: (
    manualId: string,
    format: "pdf" | "word" | "html" = "pdf",
    language = "en",
    embedImages = true,
    templateName?: string
  ) =>
    request<{
      status: string;
      manual_id: string;
      format: string;
      language: string;
      template: string | null;
      filename: string;
      download_url: string;
      size_bytes: number;
      created_at: string;
    }>(`/api/manuals/${manualId}/export`, {
      method: "POST",
      body: JSON.stringify({
        format,
        language,
        embed_images: embedImages,
        template_name: templateName,
      }),
    }),

  listExports: (manualId: string) =>
    request<{
      manual_id: string;
      exports: Array<{
        filename: string;
        format: string;
        language: string;
        download_url: string;
        size_bytes: number;
        created_at: string;
      }>;
    }>(`/api/manuals/${manualId}/exports`),

  evaluate: (manualId: string, language = "en") =>
    request<ManualEvaluation>(`/api/manuals/${manualId}/evaluate`, {
      method: "POST",
      body: JSON.stringify({ language }),
    }),

  // Stored evaluations
  listEvaluations: (manualId: string) =>
    request<{
      manual_id: string;
      evaluations: Array<{
        version: string;
        language: string;
        overall_score: number;
        evaluated_at: string;
        stored_at: string;
      }>;
    }>(`/api/manuals/${manualId}/evaluations`),

  getEvaluation: (manualId: string, version: string, language = "en") =>
    request<ManualEvaluation>(`/api/manuals/${manualId}/evaluations/${version}`, {
      params: { language },
    }),
};

// Manual project assignment
export const manualProject = {
  assign: (manualId: string, projectId: string, chapterId?: string) =>
    request<{ manual_id: string; project_id: string; chapter_id: string | null }>(
      `/api/manuals/${manualId}/project`,
      { method: "PUT", body: JSON.stringify({ project_id: projectId, chapter_id: chapterId }) }
    ),

  remove: (manualId: string) =>
    request<{ manual_id: string; removed_from_project: string }>(
      `/api/manuals/${manualId}/project`,
      { method: "DELETE" }
    ),
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
  chapters: ChapterInfo[];
  manuals: { manual_id: string; chapter_id: string | null; order: number }[];
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

  addManual: (projectId: string, manualId: string, chapterId?: string) =>
    request<{ status: string }>(
      `/api/projects/${projectId}/manuals/${manualId}`,
      { method: "POST", params: chapterId ? { chapter_id: chapterId } : undefined }
    ),

  removeManual: (projectId: string, manualId: string) =>
    request<{ status: string }>(
      `/api/projects/${projectId}/manuals/${manualId}`,
      { method: "DELETE" }
    ),

  moveManualToChapter: (projectId: string, manualId: string, chapterId: string) =>
    request<{ status: string }>(
      `/api/projects/${projectId}/manuals/${manualId}/chapter`,
      { method: "PUT", params: { chapter_id: chapterId } }
    ),

  reorderManualsInChapter: (projectId: string, chapterId: string, order: string[]) =>
    request<{ status: string }>(
      `/api/projects/${projectId}/chapters/${chapterId}/manuals/reorder`,
      { method: "PUT", body: JSON.stringify({ order }) }
    ),

  export: (
    projectId: string,
    format: "pdf" | "word" | "html" = "pdf",
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
  source_manuals: { manual_id: string; version: string }[];
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
  manual_id: string | null;
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
}

export const templates = {
  list: () =>
    request<{ templates: TemplateInfo[]; user_count: number; global_count: number }>(
      "/api/templates"
    ),

  upload: (file: File, name?: string): Promise<{ name: string; size_bytes: number; message: string }> => {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append("file", file);
      if (name) {
        formData.append("name", name);
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

export default { auth, videos, manuals, manualProject, projects, compilations, exports, jobs, trash, templates };
