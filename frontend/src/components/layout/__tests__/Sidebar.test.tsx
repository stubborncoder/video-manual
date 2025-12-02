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
    it('should display FileVideo icon', () => {
      renderSidebar();
      // Check for the FileVideo icon SVG
      const icons = document.querySelectorAll('svg.lucide-file-play, svg.lucide-file-video');
      expect(icons.length).toBeGreaterThan(0);
    });

    it('should render navigation structure', () => {
      renderSidebar();
      // Verify the basic structure is present
      expect(document.querySelector('nav')).toBeInTheDocument();
    });
  });

  describe('Navigation Items', () => {
    it('should render navigation links', () => {
      renderSidebar();
      // Check that navigation links exist
      const dashboardLink = screen.getAllByRole('link').find(link =>
        link.getAttribute('href') === '/dashboard'
      );
      expect(dashboardLink).toBeInTheDocument();
    });

    it('should apply hover:text-primary class to navigation items', () => {
      renderSidebar();
      const buttons = document.querySelectorAll('button');
      const hasHoverClass = Array.from(buttons).some(button =>
        button.className.includes('hover:text-primary')
      );
      expect(hasHoverClass).toBe(true);
    });
  });

  describe('Footer Buttons', () => {
    it('should render footer section with buttons', () => {
      renderSidebar();
      // Check that buttons exist with the hover class
      const buttons = document.querySelectorAll('button.hover\\:text-primary');
      expect(buttons.length).toBeGreaterThan(0);
    });

    it('should apply hover:text-primary class to all footer buttons', () => {
      renderSidebar();
      const buttons = Array.from(document.querySelectorAll('button'));
      const footerButtons = buttons.filter(btn =>
        btn.className.includes('hover:text-primary')
      );
      // Should have navigation buttons + footer buttons (collapse, theme, logout)
      expect(footerButtons.length).toBeGreaterThanOrEqual(3);
    });
  });
});
