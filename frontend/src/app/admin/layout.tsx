"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { request } from "@/lib/api";

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
    // Check if user is authenticated and is admin
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
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-muted/10 p-6">
        <div className="mb-8">
          <h2 className="text-2xl font-bold">Admin</h2>
          <p className="text-sm text-muted-foreground">System Management</p>
        </div>

        <nav className="space-y-2">
          <Link href="/admin/users">
            <Button variant="ghost" className="w-full justify-start">
              Users
            </Button>
          </Link>
          <Link href="/admin/usage">
            <Button variant="ghost" className="w-full justify-start">
              Usage & Costs
            </Button>
          </Link>
        </nav>

        <div className="mt-8">
          <Link href="/dashboard">
            <Button variant="outline" className="w-full">
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}
