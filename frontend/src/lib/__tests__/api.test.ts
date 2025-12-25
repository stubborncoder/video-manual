/**
 * Tests for api.ts - API client for Video Manual Platform backend.
 */

import { request, auth, projects, docs, videos, jobs } from '@/lib/api';

// Mock supabase
jest.mock('@/lib/supabase', () => ({
  getAccessToken: jest.fn(() => Promise.resolve('mock-token')),
}));

// Type for mocked fetch
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;

describe('api', () => {
  beforeEach(() => {
    // Reset fetch mock
    global.fetch = mockFetch;
    mockFetch.mockReset();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('request function', () => {
    it('should make a basic GET request', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ data: 'test' }),
      } as Response);

      const result = await request('/api/test');

      expect(result).toEqual({ data: 'test' });
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/test',
        expect.objectContaining({
          credentials: 'include',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer mock-token',
          }),
        })
      );
    });

    it('should add query parameters', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({}),
      } as Response);

      await request('/api/test', { params: { foo: 'bar', baz: '123' } });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/test?foo=bar&baz=123',
        expect.any(Object)
      );
    });

    it('should skip auth header when skipAuth is true', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({}),
      } as Response);

      await request('/api/test', { skipAuth: true });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/test',
        expect.objectContaining({
          headers: expect.not.objectContaining({
            Authorization: expect.any(String),
          }),
        })
      );
    });

    it('should handle 204 No Content response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 204,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.reject(new Error('No content')),
      } as Response);

      const result = await request('/api/test');

      expect(result).toEqual({});
    });

    it('should handle non-JSON success response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/plain' }),
        text: () => Promise.resolve('OK'),
      } as Response);

      const result = await request('/api/test');

      expect(result).toEqual({});
    });
  });

  describe('test_handles_network_error', () => {
    it('should throw network error when fetch fails', async () => {
      mockFetch.mockRejectedValue(new TypeError('Network request failed'));

      await expect(request('/api/test')).rejects.toThrow(
        'Cannot connect to server. Is the backend running?'
      );
    });

    it('should handle fetch abort', async () => {
      mockFetch.mockRejectedValue(new DOMException('Aborted', 'AbortError'));

      await expect(request('/api/test')).rejects.toThrow(
        'Cannot connect to server. Is the backend running?'
      );
    });
  });

  describe('test_handles_401_error', () => {
    it('should throw error on 401 response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ detail: 'Invalid credentials' }),
      } as Response);

      await expect(request('/api/test')).rejects.toThrow('Invalid credentials');
    });

    it('should handle 401 with HTML error page', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        headers: new Headers({ 'content-type': 'text/html' }),
      } as Response);

      await expect(request('/api/test')).rejects.toThrow(
        'Server error: 401 Unauthorized'
      );
    });
  });

  describe('error handling', () => {
    it('should handle validation errors (array detail)', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 422,
        statusText: 'Unprocessable Entity',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () =>
          Promise.resolve({
            detail: [
              { msg: 'Field required', loc: ['body', 'name'] },
              { msg: 'Invalid format', loc: ['body', 'email'] },
            ],
          }),
      } as Response);

      await expect(request('/api/test')).rejects.toThrow(
        'Field required, Invalid format'
      );
    });

    it('should handle object detail', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () =>
          Promise.resolve({ detail: { code: 'ERR_001', message: 'Bad request' } }),
      } as Response);

      await expect(request('/api/test')).rejects.toThrow(
        JSON.stringify({ code: 'ERR_001', message: 'Bad request' })
      );
    });

    it('should handle string detail', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ detail: 'Something went wrong' }),
      } as Response);

      await expect(request('/api/test')).rejects.toThrow('Something went wrong');
    });

    it('should handle malformed JSON error response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.reject(new SyntaxError('Unexpected token')),
      } as Response);

      await expect(request('/api/test')).rejects.toThrow(
        'HTTP 500 Internal Server Error'
      );
    });
  });

  describe('test_auth_me', () => {
    it('should call auth/me endpoint', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () =>
          Promise.resolve({
            authenticated: true,
            user_id: 'user-123',
            role: 'admin',
          }),
      } as Response);

      const result = await auth.me();

      expect(result).toEqual({
        authenticated: true,
        user_id: 'user-123',
        role: 'admin',
      });
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/auth/me',
        expect.any(Object)
      );
    });
  });

  describe('test_auth_login', () => {
    it('should call login endpoint with user ID', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () =>
          Promise.resolve({
            user_id: 'test-user',
            created_at: '2024-01-01T00:00:00Z',
          }),
      } as Response);

      const result = await auth.login('test-user');

      expect(result.user_id).toBe('test-user');
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/auth/login',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ user_id: 'test-user' }),
        })
      );
    });
  });

  describe('test_auth_logout', () => {
    it('should call logout endpoint', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ status: 'ok' }),
      } as Response);

      const result = await auth.logout();

      expect(result.status).toBe('ok');
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/auth/logout',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('test_projects_list', () => {
    it('should fetch projects list', async () => {
      const projectsList = [
        {
          id: 'proj-1',
          name: 'Project 1',
          description: 'Description',
          created_at: '2024-01-01',
          manual_count: 5,
        },
      ];
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ projects: projectsList }),
      } as Response);

      const result = await projects.list();

      expect(result.projects).toEqual(projectsList);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/projects',
        expect.any(Object)
      );
    });

    it('should return empty array when no projects', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ projects: [] }),
      } as Response);

      const result = await projects.list();

      expect(result.projects).toEqual([]);
    });
  });

  describe('test_projects_get', () => {
    it('should fetch a single project', async () => {
      const project = {
        id: 'proj-1',
        name: 'Project 1',
        description: 'Description',
        created_at: '2024-01-01',
        sections: [],
        chapters: [],
        manuals: [],
        videos: [],
      };
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve(project),
      } as Response);

      const result = await projects.get('proj-1');

      expect(result).toEqual(project);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/projects/proj-1',
        expect.any(Object)
      );
    });

    it('should handle project not found', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ detail: 'Project not found' }),
      } as Response);

      await expect(projects.get('non-existent')).rejects.toThrow(
        'Project not found'
      );
    });
  });

  describe('test_projects_create', () => {
    it('should create a new project', async () => {
      const newProject = {
        id: 'new-proj',
        name: 'New Project',
        description: 'A new project',
        created_at: '2024-01-01',
        manual_count: 0,
      };
      mockFetch.mockResolvedValue({
        ok: true,
        status: 201,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve(newProject),
      } as Response);

      const result = await projects.create('New Project', 'A new project');

      expect(result).toEqual(newProject);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/projects',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'New Project', description: 'A new project' }),
        })
      );
    });

    it('should create project with default empty description', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 201,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () =>
          Promise.resolve({
            id: 'proj',
            name: 'Project',
            description: '',
            created_at: '2024-01-01',
            manual_count: 0,
          }),
      } as Response);

      await projects.create('Project');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/projects',
        expect.objectContaining({
          body: JSON.stringify({ name: 'Project', description: '' }),
        })
      );
    });
  });

  describe('test_projects_update', () => {
    it('should update a project', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () =>
          Promise.resolve({
            id: 'proj-1',
            name: 'Updated Name',
            description: 'Updated description',
          }),
      } as Response);

      const result = await projects.update('proj-1', 'Updated Name', 'Updated description');

      expect(result.name).toBe('Updated Name');
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/projects/proj-1',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ name: 'Updated Name', description: 'Updated description' }),
        })
      );
    });
  });

  describe('test_projects_delete', () => {
    it('should delete a project', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () =>
          Promise.resolve({ status: 'deleted', affected_manuals: [] }),
      } as Response);

      const result = await projects.delete('proj-1');

      expect(result.status).toBe('deleted');
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/projects/proj-1?delete_manuals=false',
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    it('should delete project with manuals', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () =>
          Promise.resolve({
            status: 'deleted',
            affected_manuals: ['doc-1', 'doc-2'],
          }),
      } as Response);

      await projects.delete('proj-1', true);

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/projects/proj-1?delete_manuals=true',
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  describe('test_docs_list', () => {
    it('should fetch docs list', async () => {
      const docsList = [
        {
          id: 'doc-1',
          title: 'Document 1',
          created_at: '2024-01-01',
          screenshot_count: 10,
          languages: ['en', 'es'],
          evaluations: {},
        },
      ];
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ docs: docsList }),
      } as Response);

      const result = await docs.list();

      expect(result.docs).toEqual(docsList);
      expect(mockFetch).toHaveBeenCalledWith('/api/docs', expect.any(Object));
    });
  });

  describe('test_docs_get', () => {
    it('should fetch a single doc with default language', async () => {
      const doc = {
        id: 'doc-1',
        title: 'Document 1',
        content: '# Content',
        language: 'en',
        screenshots: ['screenshot1.png'],
      };
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve(doc),
      } as Response);

      const result = await docs.get('doc-1');

      expect(result).toEqual(doc);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/docs/doc-1?language=en',
        expect.any(Object)
      );
    });

    it('should fetch a doc with specific language', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () =>
          Promise.resolve({
            id: 'doc-1',
            title: 'Documento 1',
            content: '# Contenido',
            language: 'es',
            screenshots: [],
          }),
      } as Response);

      await docs.get('doc-1', 'es');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/docs/doc-1?language=es',
        expect.any(Object)
      );
    });
  });

  describe('test_videos_list', () => {
    it('should fetch videos list', async () => {
      const videosList = [
        {
          name: 'video1.mp4',
          path: '/videos/video1.mp4',
          size_bytes: 1024000,
          modified_at: '2024-01-01',
        },
      ];
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ videos: videosList }),
      } as Response);

      const result = await videos.list();

      expect(result.videos).toEqual(videosList);
      expect(mockFetch).toHaveBeenCalledWith('/api/videos', expect.any(Object));
    });
  });

  describe('jobs API', () => {
    it('should list jobs with filters', async () => {
      const jobsList = [
        {
          id: 'job-1',
          user_id: 'user-1',
          video_name: 'video.mp4',
          doc_id: null,
          status: 'processing',
          current_node: null,
          node_index: null,
          total_nodes: null,
          error: null,
          started_at: null,
          completed_at: null,
          seen: false,
        },
      ];
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ jobs: jobsList }),
      } as Response);

      const result = await jobs.list('processing', false);

      expect(result.jobs).toEqual(jobsList);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/jobs?status=processing&include_seen=false',
        expect.any(Object)
      );
    });

    it('should list active jobs', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ jobs: [] }),
      } as Response);

      await jobs.listActive();

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/jobs/active',
        expect.any(Object)
      );
    });

    it('should mark job as seen', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ status: 'ok' }),
      } as Response);

      await jobs.markSeen('job-1');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/jobs/job-1/seen',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });
});
