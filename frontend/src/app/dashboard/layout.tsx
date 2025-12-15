"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Sidebar } from "@/components/layout/Sidebar";
import { SidebarProvider, useSidebar } from "@/components/layout/SidebarContext";
import { SheetSidebarProvider } from "@/components/ui/sheet";
import { JobToastsContainer } from "@/components/jobs/JobProgressToast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuthStore } from "@/stores/authStore";
import { GuideProvider } from "@/components/guide/GuideProvider";

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebar();

  return (
    <SheetSidebarProvider collapsed={collapsed}>
      <TooltipProvider delayDuration={0}>
        <GuideProvider>
          <div className="flex h-screen">
            <Sidebar />
            <main className="flex-1 overflow-auto p-6">
              {children}
            </main>
          </div>
          <JobToastsContainer />
        </GuideProvider>
      </TooltipProvider>
    </SheetSidebarProvider>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const tc = useTranslations("common");
  const { initialized, isAuthenticated } = useAuthStore();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    // Wait for auth to initialize
    if (!initialized) return;

    // Check if user is authenticated
    if (!isAuthenticated()) {
      router.push("/");
      return;
    }

    setAuthorized(true);
  }, [initialized, isAuthenticated, router]);

  // Show loading while auth initializes
  if (!initialized) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">{tc("loading")}</p>
      </div>
    );
  }

  // Don't render until authorized (prevents flash of content before redirect)
  if (!authorized) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">{tc("loading")}</p>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <DashboardContent>{children}</DashboardContent>
    </SidebarProvider>
  );
}
