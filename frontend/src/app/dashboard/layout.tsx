"use client";

import { Sidebar } from "@/components/layout/Sidebar";
import { SidebarProvider, useSidebar } from "@/components/layout/SidebarContext";
import { SheetSidebarProvider } from "@/components/ui/sheet";
import { JobToastsContainer } from "@/components/jobs/JobProgressToast";
import { TooltipProvider } from "@/components/ui/tooltip";

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebar();

  return (
    <SheetSidebarProvider collapsed={collapsed}>
      <TooltipProvider delayDuration={0}>
        <div className="flex h-screen">
          <Sidebar />
          <main className="flex-1 overflow-auto p-6">
            {children}
          </main>
        </div>
      </TooltipProvider>
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
