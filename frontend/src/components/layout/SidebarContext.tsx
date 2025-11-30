"use client";

import { createContext, useContext, useEffect, useState } from "react";

const SIDEBAR_COLLAPSED_KEY = "sidebar-collapsed";

interface SidebarContextType {
  collapsed: boolean;
  setCollapsed: (value: boolean) => void;
  toggleCollapsed: () => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsedState] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    if (stored !== null) {
      setCollapsedState(stored === "true");
    }
    setMounted(true);
  }, []);

  const setCollapsed = (value: boolean) => {
    setCollapsedState(value);
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(value));
  };

  const toggleCollapsed = () => {
    setCollapsed(!collapsed);
  };

  // Don't render children until mounted to prevent hydration mismatch
  if (!mounted) {
    return (
      <SidebarContext.Provider value={{ collapsed: true, setCollapsed, toggleCollapsed }}>
        {children}
      </SidebarContext.Provider>
    );
  }

  return (
    <SidebarContext.Provider value={{ collapsed, setCollapsed, toggleCollapsed }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (context === undefined) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
}
