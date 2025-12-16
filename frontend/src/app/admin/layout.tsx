"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { request } from "@/lib/api";
import { AdminSidebarProvider } from "./AdminSidebarContext";
import { AdminSidebar } from "./AdminSidebar";

interface UserSession {
  authenticated: boolean;
  user_id?: string;
  role?: string;
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const session = await request<UserSession>("/api/auth/me");
        if (!session.authenticated || session.role !== "admin") {
          router.push("/dashboard");
          return;
        }
        setAuthorized(true);
      } catch (error) {
        console.error("Auth check failed:", error);
        router.push("/dashboard");
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!authorized) {
    return null;
  }

  return (
    <AdminSidebarProvider>
      <div className="flex h-screen">
        <AdminSidebar />
        <main className="flex-1 overflow-auto p-6 custom-scrollbar">{children}</main>
      </div>
    </AdminSidebarProvider>
  );
}
