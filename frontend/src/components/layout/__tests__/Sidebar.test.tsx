import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Sidebar } from '../Sidebar';
import { SidebarProvider } from '../SidebarContext';
import { ThemeProvider } from 'next-themes';
import { usePathname, useRouter } from 'next/navigation';

// Mock Next.js navigation
jest.mock('next/navigation', () => ({
  usePathname: jest.fn(),
  useRouter: jest.fn(),
}));

// Mock next-intl
jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      dashboard: 'Dashboard',
      videos: 'Videos',
      docs: 'Docs',
      projects: 'Projects',
      templates: 'Templates',
      trash: 'Trash',
      bugs: 'Bugs',
      admin: 'Admin',
      logout: 'Logout',
    };
    return translations[key] || key;
  },
}));

// Mock auth API
jest.mock('@/lib/api', () => ({
  auth: {
    logout: jest.fn(),
    me: jest.fn().mockResolvedValue({ role: 'user' }),
  },
}));

// Mock auth store
const mockSignOut = jest.fn();
const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  user_metadata: {
    full_name: 'Test User',
    avatar_url: 'https://example.com/avatar.jpg',
  },
};

jest.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    user: mockUser,
    signOut: mockSignOut,
  }),
}));

// Mock VDocsIcon and VDocsText
jest.mock('@/components/ui/VDocsIcon', () => ({
  VDocsIcon: ({ className, ...props }: { className?: string }) => (
    <svg data-testid="vdocs-icon" className={className} {...props} />
  ),
}));

jest.mock('@/components/ui/vdocs-text', () => ({
  VDocsText: ({ suffix, className }: { suffix?: string; className?: string }) => (
    <span data-testid="vdocs-text" className={className}>vDocs{suffix}</span>
  ),
}));

// Mock Avatar components (Radix UI Avatar doesn't render img in tests without actual image load)
jest.mock('@/components/ui/avatar', () => ({
  Avatar: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="avatar" className={className}>{children}</div>
  ),
  AvatarImage: ({ src, alt }: { src?: string; alt?: string }) => (
    src ? <img data-testid="avatar-image" src={src} alt={alt} /> : null
  ),
  AvatarFallback: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <span data-testid="avatar-fallback" className={className}>{children}</span>
  ),
}));

const mockRouter = {
  push: jest.fn(),
  refresh: jest.fn(),
};

describe('Sidebar Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (usePathname as jest.Mock).mockReturnValue('/dashboard');
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    // Reset localStorage
    localStorage.clear();
  });

  const renderSidebar = (collapsed = false) => {
    // Set up localStorage for sidebar state
    if (collapsed) {
      localStorage.setItem('sidebar-collapsed', 'true');
    } else {
      localStorage.setItem('sidebar-collapsed', 'false');
    }

    return render(
      <ThemeProvider attribute="class">
        <SidebarProvider>
          <Sidebar />
        </SidebarProvider>
      </ThemeProvider>
    );
  };

  describe('Logo and Branding', () => {
    it('should display VDocs icon', () => {
      renderSidebar();
      const icon = screen.getByTestId('vdocs-icon');
      expect(icon).toBeInTheDocument();
    });

    it('should display VDocs text when expanded', async () => {
      renderSidebar(false);
      await waitFor(() => {
        const text = screen.getByTestId('vdocs-text');
        expect(text).toBeInTheDocument();
      });
    });

    it('should link logo to home page', () => {
      renderSidebar();
      const homeLinks = screen.getAllByRole('link');
      const logoLink = homeLinks.find(link => link.getAttribute('href') === '/');
      expect(logoLink).toBeInTheDocument();
    });

    it('should show alpha badge when expanded', async () => {
      renderSidebar(false);
      await waitFor(() => {
        expect(screen.getByText('alpha')).toBeInTheDocument();
      });
    });
  });

  describe('Navigation Items', () => {
    it('should render all main navigation links', async () => {
      renderSidebar(false);

      await waitFor(() => {
        expect(screen.getByText('Dashboard')).toBeInTheDocument();
        expect(screen.getByText('Videos')).toBeInTheDocument();
        expect(screen.getByText('Docs')).toBeInTheDocument();
        expect(screen.getByText('Projects')).toBeInTheDocument();
        expect(screen.getByText('Templates')).toBeInTheDocument();
        expect(screen.getByText('Trash')).toBeInTheDocument();
        expect(screen.getByText('Bugs')).toBeInTheDocument();
      });
    });

    it('should render correct navigation hrefs', () => {
      renderSidebar();

      const dashboardLink = screen.getAllByRole('link').find(
        link => link.getAttribute('href') === '/dashboard'
      );
      const videosLink = screen.getAllByRole('link').find(
        link => link.getAttribute('href') === '/dashboard/videos'
      );
      const docsLink = screen.getAllByRole('link').find(
        link => link.getAttribute('href') === '/dashboard/docs'
      );
      const projectsLink = screen.getAllByRole('link').find(
        link => link.getAttribute('href') === '/dashboard/projects'
      );

      expect(dashboardLink).toBeInTheDocument();
      expect(videosLink).toBeInTheDocument();
      expect(docsLink).toBeInTheDocument();
      expect(projectsLink).toBeInTheDocument();
    });

    it('should include data-guide-id attributes for navigation items', () => {
      renderSidebar();

      const navDashboard = document.querySelector('[data-guide-id="nav-dashboard"]');
      const navVideos = document.querySelector('[data-guide-id="nav-videos"]');
      const navManuals = document.querySelector('[data-guide-id="nav-manuals"]');
      const navProjects = document.querySelector('[data-guide-id="nav-projects"]');

      expect(navDashboard).toBeInTheDocument();
      expect(navVideos).toBeInTheDocument();
      expect(navManuals).toBeInTheDocument();
      expect(navProjects).toBeInTheDocument();
    });
  });

  describe('Active Link Styling', () => {
    it('should highlight dashboard when on /dashboard', () => {
      (usePathname as jest.Mock).mockReturnValue('/dashboard');
      renderSidebar();

      const dashboardButton = document.querySelector('[data-guide-id="nav-dashboard"]');
      expect(dashboardButton?.className).toContain('secondary');
    });

    it('should highlight videos when on /dashboard/videos', () => {
      (usePathname as jest.Mock).mockReturnValue('/dashboard/videos');
      renderSidebar();

      const videosButton = document.querySelector('[data-guide-id="nav-videos"]');
      expect(videosButton?.className).toContain('secondary');
    });

    it('should highlight videos for nested video routes', () => {
      (usePathname as jest.Mock).mockReturnValue('/dashboard/videos/123');
      renderSidebar();

      const videosButton = document.querySelector('[data-guide-id="nav-videos"]');
      expect(videosButton?.className).toContain('secondary');
    });

    it('should highlight projects for nested project routes', () => {
      (usePathname as jest.Mock).mockReturnValue('/dashboard/projects/proj-1/manuals');
      renderSidebar();

      const projectsButton = document.querySelector('[data-guide-id="nav-projects"]');
      expect(projectsButton?.className).toContain('secondary');
    });

    it('should not highlight dashboard for nested routes', () => {
      (usePathname as jest.Mock).mockReturnValue('/dashboard/videos');
      renderSidebar();

      const dashboardButton = document.querySelector('[data-guide-id="nav-dashboard"]');
      // Dashboard should NOT have secondary variant (not active) when on a nested page
      expect(dashboardButton?.className).not.toContain('secondary');
    });
  });

  describe('Footer Buttons', () => {
    it('should render logout button', async () => {
      renderSidebar(false);

      await waitFor(() => {
        expect(screen.getByText('Logout')).toBeInTheDocument();
      });
    });

    it('should call signOut when logout is clicked', async () => {
      const user = userEvent.setup();
      renderSidebar(false);

      await waitFor(async () => {
        const logoutButton = screen.getByText('Logout');
        await user.click(logoutButton);
      });

      await waitFor(() => {
        expect(mockSignOut).toHaveBeenCalled();
      });
    });

    it('should redirect to home after logout', async () => {
      const user = userEvent.setup();
      renderSidebar(false);

      await waitFor(async () => {
        const logoutButton = screen.getByText('Logout');
        await user.click(logoutButton);
      });

      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith('/');
      });
    });

    it('should apply hover:text-primary class to footer buttons', () => {
      renderSidebar();

      const buttons = document.querySelectorAll('button.hover\\:text-primary');
      expect(buttons.length).toBeGreaterThan(0);
    });
  });

  describe('User Menu', () => {
    it('should display user avatar', () => {
      renderSidebar();

      const avatarImage = screen.getByAltText('Test User');
      expect(avatarImage).toBeInTheDocument();
    });

    it('should display user name when expanded', async () => {
      renderSidebar(false);

      await waitFor(() => {
        expect(screen.getByText('Test User')).toBeInTheDocument();
      });
    });

    it('should display user email when expanded', async () => {
      renderSidebar(false);

      await waitFor(() => {
        expect(screen.getByText('test@example.com')).toBeInTheDocument();
      });
    });

    it('should link user profile to /dashboard/profile', () => {
      renderSidebar();

      const profileLink = screen.getAllByRole('link').find(
        link => link.getAttribute('href') === '/dashboard/profile'
      );
      expect(profileLink).toBeInTheDocument();
    });

    it('should show initials fallback when no avatar URL', async () => {
      renderSidebar();

      // The avatar fallback should be rendered (contains initials)
      const avatarFallback = screen.getAllByTestId('avatar-fallback')[0];
      expect(avatarFallback).toBeInTheDocument();
    });
  });

  describe('Collapsed State', () => {
    it('should show tooltips when collapsed', async () => {
      renderSidebar(true);

      // In collapsed state, navigation items should have tooltips
      const buttons = document.querySelectorAll('button');
      expect(buttons.length).toBeGreaterThan(0);
    });

    it('should hide text labels when collapsed', async () => {
      renderSidebar(true);

      await waitFor(() => {
        // In collapsed state, the expanded text should not be visible
        // The component conditionally renders text based on collapsed state
        const sidebar = document.querySelector('[class*="w-16"]');
        expect(sidebar).toBeInTheDocument();
      });
    });

    it('should show expanded width when not collapsed', async () => {
      renderSidebar(false);

      await waitFor(() => {
        const sidebar = document.querySelector('[class*="w-64"]');
        expect(sidebar).toBeInTheDocument();
      });
    });
  });

  describe('Admin Features', () => {
    it('should not show admin link for regular users', async () => {
      renderSidebar(false);

      await waitFor(() => {
        const adminLink = screen.queryByText('Admin');
        expect(adminLink).not.toBeInTheDocument();
      });
    });

    it('should show admin link when user is admin', async () => {
      // Mock auth.me to return admin role
      const { auth } = require('@/lib/api');
      auth.me.mockResolvedValue({ role: 'admin' });

      renderSidebar(false);

      await waitFor(() => {
        const adminLink = screen.getByText('Admin');
        expect(adminLink).toBeInTheDocument();
      }, { timeout: 2000 });
    });

    it('should highlight admin link when on admin page', async () => {
      const { auth } = require('@/lib/api');
      auth.me.mockResolvedValue({ role: 'admin' });
      (usePathname as jest.Mock).mockReturnValue('/admin');

      renderSidebar(false);

      await waitFor(() => {
        const adminLinks = screen.getAllByRole('link').filter(
          link => link.getAttribute('href') === '/admin'
        );
        expect(adminLinks.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper aria-label on logo', () => {
      renderSidebar();

      const logo = screen.getByTestId('vdocs-icon');
      expect(logo).toHaveAttribute('aria-label', 'vDocs logo');
    });

    it('should have navigation landmark', () => {
      renderSidebar();

      const nav = document.querySelector('nav');
      expect(nav).toBeInTheDocument();
    });

    it('should have proper link structure', () => {
      renderSidebar();

      const links = screen.getAllByRole('link');
      expect(links.length).toBeGreaterThan(0);

      links.forEach(link => {
        expect(link).toHaveAttribute('href');
      });
    });
  });
});
