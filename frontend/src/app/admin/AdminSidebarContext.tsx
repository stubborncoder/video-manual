"use client";

import { createContext, useContext, useEffect, useState } from "react";

const ADMIN_SIDEBAR_COLLAPSED_KEY = "admin-sidebar-collapsed";

interface AdminSidebarContextType {
  collapsed: boolean;
  setCollapsed: (value: boolean) => void;
  toggleCollapsed: () => void;
}

const AdminSidebarContext = createContext<AdminSidebarContextType | undefined>(undefined);

export function AdminSidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsedState] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(ADMIN_SIDEBAR_COLLAPSED_KEY);
    if (stored !== null) {
      setCollapsedState(stored === "true");
    }
    setMounted(true);
  }, []);

  const setCollapsed = (value: boolean) => {
    setCollapsedState(value);
    localStorage.setItem(ADMIN_SIDEBAR_COLLAPSED_KEY, String(value));
  };

  const toggleCollapsed = () => {
    setCollapsed(!collapsed);
  };

  // Don't render children until mounted to prevent hydration mismatch
  if (!mounted) {
    return (
      <AdminSidebarContext.Provider value={{ collapsed: true, setCollapsed, toggleCollapsed }}>
        {children}
      </AdminSidebarContext.Provider>
    );
  }

  return (
    <AdminSidebarContext.Provider value={{ collapsed, setCollapsed, toggleCollapsed }}>
      {children}
    </AdminSidebarContext.Provider>
  );
}

export function useAdminSidebar() {
  const context = useContext(AdminSidebarContext);
  if (context === undefined) {
    throw new Error("useAdminSidebar must be used within an AdminSidebarProvider");
  }
  return context;
}
