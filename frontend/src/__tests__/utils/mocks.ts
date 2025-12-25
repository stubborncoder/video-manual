/**
 * Mock data and mock functions for testing.
 */

// ==================== API Response Mocks ====================

export const mockUser = {
  id: 'test-user-123',
  email: 'test@example.com',
  display_name: 'Test User',
  role: 'user',
  tier: 'free',
  tester: false,
  created_at: '2024-01-01T00:00:00Z',
};

export const mockAdminUser = {
  ...mockUser,
  id: 'admin-user',
  role: 'admin',
};

export const mockProject = {
  id: 'proj-001',
  name: 'Test Project',
  description: 'A test project',
  created_at: '2024-01-01T00:00:00Z',
  manual_count: 2,
  chapters: [],
  sections: [],
  manuals: [],
  videos: [],
};

export const mockDoc = {
  id: 'doc-001',
  title: 'Test Manual',
  content: '# Test Manual\n\n## Step 1\nDo something.',
  language: 'en',
  screenshots: ['screenshot1.png'],
  source_video: { name: 'test.mp4', exists: true },
  document_format: 'step-manual',
};

export const mockDocSummary = {
  id: 'doc-001',
  title: 'Test Manual',
  created_at: '2024-01-01T00:00:00Z',
  screenshot_count: 3,
  languages: ['en', 'es'],
  evaluations: {},
  source_video: { name: 'test.mp4', exists: true },
};

export const mockVideo = {
  name: 'test-video.mp4',
  path: 'videos/test-video.mp4',
  size_bytes: 1024000,
  modified_at: '2024-01-01T00:00:00Z',
};

export const mockJob = {
  id: 'job-001',
  user_id: 'test-user-123',
  video_name: 'test-video.mp4',
  doc_id: null,
  status: 'pending',
  current_node: null,
  node_index: null,
  total_nodes: null,
  error: null,
  started_at: null,
  completed_at: null,
  seen: false,
};

export const mockTemplate = {
  id: 'tmpl-001',
  name: 'Default Template',
  filename: 'default-template.docx',
  description: 'Default Word template',
  document_formats: ['step-manual'],
  created_at: '2024-01-01T00:00:00Z',
};

export const mockEvaluation = {
  doc_id: 'doc-001',
  language: 'en',
  overall_score: 8,
  summary: 'Good documentation with clear steps.',
  strengths: ['Clear instructions', 'Good screenshots'],
  areas_for_improvement: ['Add more context'],
  recommendations: ['Consider adding a glossary'],
  evaluated_at: '2024-01-01T00:00:00Z',
};

// ==================== API Mock Functions ====================

export const createMockApi = () => ({
  auth: {
    login: jest.fn().mockResolvedValue({ success: true }),
    logout: jest.fn().mockResolvedValue({ success: true }),
    me: jest.fn().mockResolvedValue({ authenticated: true, user_id: mockUser.id, role: 'user' }),
  },
  projects: {
    list: jest.fn().mockResolvedValue({ projects: [mockProject] }),
    get: jest.fn().mockResolvedValue(mockProject),
    create: jest.fn().mockResolvedValue(mockProject),
    update: jest.fn().mockResolvedValue(mockProject),
    delete: jest.fn().mockResolvedValue({ success: true }),
  },
  docs: {
    list: jest.fn().mockResolvedValue({ docs: [mockDocSummary] }),
    get: jest.fn().mockResolvedValue(mockDoc),
    update: jest.fn().mockResolvedValue(mockDoc),
    delete: jest.fn().mockResolvedValue({ success: true }),
  },
  videos: {
    list: jest.fn().mockResolvedValue({ videos: [mockVideo] }),
    upload: jest.fn().mockResolvedValue({ success: true }),
    delete: jest.fn().mockResolvedValue({ success: true }),
  },
  jobs: {
    list: jest.fn().mockResolvedValue({ jobs: [mockJob] }),
    get: jest.fn().mockResolvedValue(mockJob),
    markSeen: jest.fn().mockResolvedValue({ success: true }),
    delete: jest.fn().mockResolvedValue({ success: true }),
  },
  templates: {
    list: jest.fn().mockResolvedValue({ templates: [mockTemplate] }),
    upload: jest.fn().mockResolvedValue(mockTemplate),
    delete: jest.fn().mockResolvedValue({ success: true }),
  },
});

// ==================== Store Mock Utilities ====================

/**
 * Create a mock auth store state.
 */
export const createMockAuthState = (overrides = {}) => ({
  user: null,
  session: null,
  legacyUserId: mockUser.id,
  role: 'user',
  loading: false,
  initialized: true,
  error: null,
  initialize: jest.fn(),
  signInWithEmail: jest.fn(),
  signUpWithEmail: jest.fn(),
  signInWithGoogle: jest.fn(),
  signInLegacy: jest.fn(),
  signOut: jest.fn(),
  isAuthenticated: jest.fn().mockReturnValue(true),
  getUserId: jest.fn().mockReturnValue(mockUser.id),
  getToken: jest.fn().mockResolvedValue('mock-token'),
  ...overrides,
});

/**
 * Create a mock jobs store state.
 */
export const createMockJobsState = (overrides = {}) => ({
  jobs: [mockJob],
  loading: false,
  error: null,
  fetchJobs: jest.fn(),
  addJob: jest.fn(),
  updateJob: jest.fn(),
  removeJob: jest.fn(),
  markJobSeen: jest.fn(),
  clearJobs: jest.fn(),
  ...overrides,
});

/**
 * Create a mock guide store state.
 */
export const createMockGuideState = (overrides = {}) => ({
  messages: [],
  isOpen: false,
  isLoading: false,
  error: null,
  addMessage: jest.fn(),
  clearMessages: jest.fn(),
  setOpen: jest.fn(),
  setLoading: jest.fn(),
  setError: jest.fn(),
  ...overrides,
});

// ==================== WebSocket Event Mocks ====================

export const mockWsEvents = {
  jobStarted: {
    type: 'job_started',
    job_id: 'job-001',
    timestamp: Date.now(),
  },
  jobProgress: {
    type: 'job_progress',
    job_id: 'job-001',
    current_node: 'analyze_video',
    node_index: 1,
    total_nodes: 5,
    timestamp: Date.now(),
  },
  jobComplete: {
    type: 'job_complete',
    job_id: 'job-001',
    doc_id: 'doc-001',
    timestamp: Date.now(),
  },
  jobError: {
    type: 'job_error',
    job_id: 'job-001',
    error: 'Processing failed',
    timestamp: Date.now(),
  },
  chatToken: {
    type: 'chat_response',
    content: 'Hello',
    done: false,
    timestamp: Date.now(),
  },
  chatComplete: {
    type: 'chat_response',
    content: 'Hello, how can I help you?',
    done: true,
    timestamp: Date.now(),
  },
  pendingChange: {
    type: 'pending_change',
    change: {
      id: 'change-001',
      type: 'replace',
      old_text: 'old text',
      new_text: 'new text',
    },
    timestamp: Date.now(),
  },
};

// ==================== Fetch Mock Utilities ====================

/**
 * Create a mock fetch response.
 */
export const mockFetch = (data: any, options: { status?: number; ok?: boolean } = {}) => {
  const { status = 200, ok = true } = options;
  return jest.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  });
};

/**
 * Create a mock fetch that throws an error.
 */
export const mockFetchError = (message = 'Network error') => {
  return jest.fn().mockRejectedValue(new Error(message));
};

// ==================== File Mock Utilities ====================

/**
 * Create a mock File object.
 */
export const createMockFile = (
  name = 'test.mp4',
  type = 'video/mp4',
  size = 1024
): File => {
  const content = new Array(size).fill('a').join('');
  return new File([content], name, { type });
};

/**
 * Create a mock Blob URL.
 */
export const createMockBlobUrl = (): string => {
  return 'blob:http://localhost:3000/mock-blob-id';
};
