"use client";

import { Sidebar } from "@/components/layout/Sidebar";
import { SidebarProvider, useSidebar } from "@/components/layout/SidebarContext";
import { SheetSidebarProvider } from "@/components/ui/sheet";
import { JobToastsContainer } from "@/components/jobs/JobProgressToast";
import { SidebarToggle } from "@/components/layout/SidebarToggle";

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebar();

  return (
    <SheetSidebarProvider collapsed={collapsed}>
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 overflow-auto p-6 pl-10 relative">
          <SidebarToggle className="absolute left-1.5 top-6" />
          {children}
        </main>
      </div>
      <JobToastsContainer />
    </SheetSidebarProvider>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <DashboardContent>{children}</DashboardContent>
    </SidebarProvider>
  );
}
