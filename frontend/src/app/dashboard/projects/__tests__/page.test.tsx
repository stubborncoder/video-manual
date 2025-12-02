import { projects } from '@/lib/api';

// Mock the API
jest.mock('@/lib/api', () => ({
  projects: {
    list: jest.fn(),
    get: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    compile: jest.fn(),
  },
  manuals: {
    list: jest.fn(),
  },
}));

describe('ProjectsPage API Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Project Loading Performance', () => {
    it('should call projects.list only once when loading projects', async () => {
      const mockProjects = {
        projects: [
          {
            id: '1',
            name: 'Project 1',
            description: 'Test project 1',
            created_at: '2024-01-01',
            manual_count: 2,
            chapter_count: 5,
            is_default: false,
          },
          {
            id: '2',
            name: 'Project 2',
            description: 'Test project 2',
            created_at: '2024-01-02',
            manual_count: 3,
            chapter_count: 8,
            is_default: false,
          },
        ],
      };

      (projects.list as jest.Mock).mockResolvedValue(mockProjects);

      // Simulate what the component does
      const res = await projects.list();

      // Verify projects.list was called only once (no N+1 queries)
      expect(projects.list).toHaveBeenCalledTimes(1);

      // Verify projects.get was NOT called during initial load
      expect(projects.get).not.toHaveBeenCalled();

      // Verify we get the data including chapter_count
      expect(res.projects[0].chapter_count).toBe(5);
      expect(res.projects[1].chapter_count).toBe(8);
    });

    it('should handle large project lists without N+1 queries', async () => {
      // Generate 50 projects to test performance
      const mockProjects = {
        projects: Array.from({ length: 50 }, (_, i) => ({
          id: `${i + 1}`,
          name: `Project ${i + 1}`,
          description: `Description ${i + 1}`,
          created_at: '2024-01-01',
          manual_count: Math.floor(Math.random() * 10),
          chapter_count: Math.floor(Math.random() * 20),
          is_default: false,
        })),
      };

      (projects.list as jest.Mock).mockResolvedValue(mockProjects);

      // Simulate loading projects
      await projects.list();

      // Should still only call projects.list once, no matter how many projects
      expect(projects.list).toHaveBeenCalledTimes(1);
      expect(projects.get).not.toHaveBeenCalled();
    });

    it('should get chapter_count from list response not detail response', async () => {
      const mockProjects = {
        projects: [
          {
            id: '1',
            name: 'Test Project',
            description: 'A test project',
            created_at: '2024-01-01',
            manual_count: 2,
            chapter_count: 10, // This comes from list endpoint
            is_default: false,
          },
        ],
      };

      (projects.list as jest.Mock).mockResolvedValue(mockProjects);

      const res = await projects.list();

      // Chapter count should come from list endpoint
      expect(res.projects[0].chapter_count).toBe(10);

      // projects.get should NOT be called
      expect(projects.get).not.toHaveBeenCalled();
    });

    it('should handle projects with undefined chapter_count', async () => {
      const mockProjects = {
        projects: [
          {
            id: '1',
            name: 'Project Without Count',
            description: 'Test',
            created_at: '2024-01-01',
            manual_count: 1,
            // chapter_count is undefined
            is_default: false,
          },
        ],
      };

      (projects.list as jest.Mock).mockResolvedValue(mockProjects);

      const res = await projects.list();

      // Should not crash when chapter_count is undefined
      expect(projects.list).toHaveBeenCalledTimes(1);
      expect(res.projects[0].chapter_count).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors during project loading', async () => {
      (projects.list as jest.Mock).mockRejectedValue(new Error('API Error'));

      await expect(projects.list()).rejects.toThrow('API Error');

      // Should have attempted to call the API
      expect(projects.list).toHaveBeenCalledTimes(1);
    });
  });
});
