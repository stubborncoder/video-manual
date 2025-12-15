"use client";

import { usePathname } from "next/navigation";
import type { PageContext } from "@/stores/guideStore";

/**
 * Hook to provide page context for the guide agent
 * Each page can extend this with additional context information
 */
export function usePageContext(): PageContext {
  const pathname = usePathname();

  // Base context - can be extended by individual pages
  let pageTitle = "vDocs";
  let availableActions: string[] = [];
  const pageState: Record<string, unknown> = {};

  // Determine context based on pathname
  if (pathname.includes("/videos")) {
    pageTitle = "Videos";
    availableActions = ["upload", "process", "delete", "filter"];
  } else if (pathname.includes("/manuals")) {
    pageTitle = "Manuals";
    availableActions = ["export", "edit", "evaluate", "translate"];
  } else if (pathname.includes("/projects")) {
    pageTitle = "Projects";
    availableActions = ["create", "compile", "organize", "delete"];
  } else if (pathname.includes("/templates")) {
    pageTitle = "Templates";
    availableActions = ["create", "edit", "delete"];
  } else if (pathname.includes("/trash")) {
    pageTitle = "Trash";
    availableActions = ["restore", "delete_permanent"];
  } else if (pathname.includes("/profile")) {
    pageTitle = "Profile";
    availableActions = ["edit_profile", "change_password"];
  } else if (pathname.includes("/dashboard")) {
    pageTitle = "Dashboard";
    availableActions = ["view_videos", "view_manuals", "view_projects"];
  }

  return {
    currentPage: pathname,
    pageTitle,
    availableActions,
    pageState,
  };
}

/**
 * Hook for Videos page context
 */
export function useVideosPageContext(
  videoCount?: number,
  filterActive?: boolean
): PageContext {
  const baseContext = usePageContext();

  return {
    ...baseContext,
    pageState: {
      videoCount: videoCount ?? 0,
      filterActive: filterActive ?? false,
    },
  };
}

/**
 * Hook for Manuals page context
 */
export function useManualsPageContext(
  manualCount?: number,
  selectedLanguage?: string
): PageContext {
  const baseContext = usePageContext();

  return {
    ...baseContext,
    pageState: {
      manualCount: manualCount ?? 0,
      selectedLanguage: selectedLanguage ?? "en",
    },
  };
}

/**
 * Hook for Projects page context
 */
export function useProjectsPageContext(
  projectCount?: number,
  selectedProject?: string
): PageContext {
  const baseContext = usePageContext();

  return {
    ...baseContext,
    pageState: {
      projectCount: projectCount ?? 0,
      selectedProject: selectedProject ?? null,
    },
  };
}

/**
 * Hook for Dashboard page context
 */
export function useDashboardPageContext(stats?: {
  videoCount?: number;
  manualCount?: number;
  projectCount?: number;
}): PageContext {
  const baseContext = usePageContext();

  return {
    ...baseContext,
    pageState: {
      videoCount: stats?.videoCount ?? 0,
      manualCount: stats?.manualCount ?? 0,
      projectCount: stats?.projectCount ?? 0,
    },
  };
}
