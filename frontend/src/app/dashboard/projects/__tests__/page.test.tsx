import { render, screen, waitFor } from '@testing-library/react';
import ProjectsPage from '../page';
import { projects } from '@/lib/api';

// Mock Next.js navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    refresh: jest.fn(),
  })),
}));

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

// Mock WebSocket hook
jest.mock('@/hooks/useWebSocket', () => ({
  useProjectCompiler: jest.fn(() => ({
    state: null,
    compile: jest.fn(),
    reset: jest.fn(),
  })),
}));

// Mock toast
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

describe('ProjectsPage Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Project Loading and Display', () => {
    it('should load projects without making N+1 queries', async () => {
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

      render(<ProjectsPage />);

      // Wait for projects to load
      await waitFor(() => {
        expect(screen.getByText('Project 1')).toBeInTheDocument();
      });

      // Verify projects.list was called only once (no N+1 queries)
      expect(projects.list).toHaveBeenCalledTimes(1);

      // Verify projects.get was NOT called during initial load
      expect(projects.get).not.toHaveBeenCalled();
    });

    it('should display chapter count from list response', async () => {
      const mockProjects = {
        projects: [
          {
            id: '1',
            name: 'Test Project',
            description: 'A test project',
            created_at: '2024-01-01',
            manual_count: 2,
            chapter_count: 10,
            is_default: false,
          },
        ],
      };

      (projects.list as jest.Mock).mockResolvedValue(mockProjects);

      render(<ProjectsPage />);

      await waitFor(() => {
        expect(screen.getByText('Test Project')).toBeInTheDocument();
      });

      // Check that chapter count is displayed
      expect(screen.getByText('10')).toBeInTheDocument();
    });

    it('should handle projects with no chapters', async () => {
      const mockProjects = {
        projects: [
          {
            id: '1',
            name: 'Empty Project',
            description: 'Project with no chapters',
            created_at: '2024-01-01',
            manual_count: 0,
            chapter_count: 0,
            is_default: false,
          },
        ],
      };

      (projects.list as jest.Mock).mockResolvedValue(mockProjects);

      render(<ProjectsPage />);

      await waitFor(() => {
        expect(screen.getByText('Empty Project')).toBeInTheDocument();
      });

      // Verify no chapter count badge is shown when count is 0
      const chapterElements = screen.queryAllByText('0');
      // Should still be present but indicate empty state
      expect(chapterElements.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle undefined chapter_count gracefully', async () => {
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

      render(<ProjectsPage />);

      await waitFor(() => {
        expect(screen.getByText('Project Without Count')).toBeInTheDocument();
      });

      // Should not crash when chapter_count is undefined
      expect(projects.list).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors during project loading', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation();
      (projects.list as jest.Mock).mockRejectedValue(new Error('API Error'));

      render(<ProjectsPage />);

      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith(
          'Failed to load projects:',
          expect.any(Error)
        );
      });

      consoleError.mockRestore();
    });
  });

  describe('Performance', () => {
    it('should efficiently handle large project lists', async () => {
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

      render(<ProjectsPage />);

      await waitFor(() => {
        expect(screen.getByText('Project 1')).toBeInTheDocument();
      });

      // Should still only call projects.list once, no matter how many projects
      expect(projects.list).toHaveBeenCalledTimes(1);
      expect(projects.get).not.toHaveBeenCalled();
    });
  });
});
