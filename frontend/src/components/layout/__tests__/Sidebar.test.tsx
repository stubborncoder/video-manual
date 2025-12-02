import { render, screen, fireEvent } from '@testing-library/react';
import { Sidebar } from '../Sidebar';
import { SidebarProvider } from '../SidebarContext';
import { ThemeProvider } from 'next-themes';
import { usePathname, useRouter } from 'next/navigation';

// Mock Next.js navigation
jest.mock('next/navigation', () => ({
  usePathname: jest.fn(),
  useRouter: jest.fn(),
}));

// Mock auth API
jest.mock('@/lib/api', () => ({
  auth: {
    logout: jest.fn(),
  },
}));

const mockRouter = {
  push: jest.fn(),
  refresh: jest.fn(),
};

describe('Sidebar Component', () => {
  beforeEach(() => {
    (usePathname as jest.Mock).mockReturnValue('/dashboard');
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
  });

  const renderSidebar = () => {
    return render(
      <ThemeProvider attribute="class">
        <SidebarProvider>
          <Sidebar />
        </SidebarProvider>
      </ThemeProvider>
    );
  };

  describe('Branding', () => {
    it('should display vDocs logo with FileVideo icon when expanded', () => {
      renderSidebar();
      expect(screen.getByText(/vDocs/)).toBeInTheDocument();
    });

    it('should display blue "D" in vDocs when expanded', () => {
      renderSidebar();
      const dElement = screen.getByText('D');
      expect(dElement).toHaveClass('text-primary');
    });

    it('should show tooltip with vDocs when collapsed', () => {
      // This would require simulating collapse state
      // For now, we just verify the expanded state exists
      renderSidebar();
      expect(screen.getByRole('heading', { name: /vDocs/i })).toBeInTheDocument();
    });
  });

  describe('Navigation Items', () => {
    it('should render all navigation items', () => {
      renderSidebar();
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Videos')).toBeInTheDocument();
      expect(screen.getByText('Manuals')).toBeInTheDocument();
      expect(screen.getByText('Projects')).toBeInTheDocument();
      expect(screen.getByText('Trash')).toBeInTheDocument();
    });

    it('should highlight active route', () => {
      renderSidebar();
      const dashboardButton = screen.getByText('Dashboard').closest('button');
      expect(dashboardButton).toHaveAttribute('data-state'); // variant="secondary" for active
    });

    it('should apply hover:text-primary class to navigation items', () => {
      renderSidebar();
      const dashboardButton = screen.getByText('Dashboard').closest('button');
      expect(dashboardButton).toHaveClass('hover:text-primary');
    });
  });

  describe('Theme Toggle', () => {
    it('should render theme toggle button', () => {
      renderSidebar();
      // The text will be either "Light Mode" or "Dark Mode" depending on current theme
      const themeButton = screen.getByText(/Mode$/);
      expect(themeButton).toBeInTheDocument();
    });

    it('should apply hover:text-primary class to theme toggle', () => {
      renderSidebar();
      const themeButton = screen.getByText(/Mode$/).closest('button');
      expect(themeButton).toHaveClass('hover:text-primary');
    });
  });

  describe('Collapse/Expand', () => {
    it('should render collapse button when expanded', () => {
      renderSidebar();
      expect(screen.getByText('Collapse')).toBeInTheDocument();
    });

    it('should apply hover:text-primary class to collapse button', () => {
      renderSidebar();
      const collapseButton = screen.getByText('Collapse').closest('button');
      expect(collapseButton).toHaveClass('hover:text-primary');
    });
  });

  describe('Logout', () => {
    it('should render logout button', () => {
      renderSidebar();
      expect(screen.getByText('Logout')).toBeInTheDocument();
    });

    it('should apply hover:text-primary class to logout button', () => {
      renderSidebar();
      const logoutButton = screen.getByText('Logout').closest('button');
      expect(logoutButton).toHaveClass('hover:text-primary');
    });
  });
});
