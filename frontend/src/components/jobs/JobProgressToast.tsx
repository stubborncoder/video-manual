"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Loader2, CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { JobInfo } from "@/lib/api";
import { useJobsStore } from "@/stores/jobsStore";

interface JobProgressToastProps {
  job: JobInfo;
  onDismiss: () => void;
}

const NODE_LABELS: Record<string, string> = {
  analyze_video: "Analyzing video",
  identify_keyframes: "Identifying keyframes",
  generate_manual: "Generating manual",
};

export function JobProgressToast({ job, onDismiss }: JobProgressToastProps) {
  const router = useRouter();
  const { markSeen } = useJobsStore();

  // Calculate progress: node_index is 0-based, so add 1 for display
  // Progress shows how far along we are (node 0 of 3 = 33%, node 1 of 3 = 66%, etc.)
  const progress =
    job.node_index !== null && job.total_nodes
      ? Math.round(((job.node_index + 1) / job.total_nodes) * 100)
      : 10; // Show some progress even when starting

  const currentNodeLabel = job.current_node
    ? NODE_LABELS[job.current_node] || job.current_node
    : "Starting...";

  const handleViewDoc = () => {
    if (job.doc_id) {
      markSeen(job.id);
      router.push(`/dashboard/docs/${job.doc_id}/edit`);
      onDismiss();
    }
  };

  const handleDismiss = () => {
    if (job.status === "complete" || job.status === "error") {
      markSeen(job.id);
    }
    onDismiss();
  };

  return (
    <div
      className={cn(
        "w-80 rounded-lg border bg-background shadow-lg p-4",
        job.status === "error" && "border-destructive",
        job.status === "complete" && "border-green-500"
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          {job.status === "processing" || job.status === "pending" ? (
            <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
          ) : job.status === "complete" ? (
            <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
          ) : (
            <XCircle className="h-4 w-4 text-destructive shrink-0" />
          )}
          <span className="text-sm font-medium truncate">{job.video_name}</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={handleDismiss}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content based on status */}
      {(job.status === "processing" || job.status === "pending") && (
        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">{currentNodeLabel}</p>
            {job.node_index !== null && job.total_nodes && (
              <p className="text-xs text-muted-foreground">
                Step {job.node_index + 1} of {job.total_nodes}
              </p>
            )}
          </div>
        </div>
      )}

      {job.status === "complete" && (
        <div className="space-y-2">
          <p className="text-sm text-green-600">Document ready!</p>
          <Button size="sm" className="w-full gap-2" onClick={handleViewDoc}>
            View Document
            <ExternalLink className="h-3 w-3" />
          </Button>
        </div>
      )}

      {job.status === "error" && (
        <p className="text-sm text-destructive">
          {job.error || "An error occurred"}
        </p>
      )}
    </div>
  );
}

/**
 * Container component that renders all active job toasts
 */
export function JobToastsContainer() {
  const { getActiveJobs, getUnseenCompleted, fetchActiveJobs, initialized } = useJobsStore();
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  // Fetch active jobs on mount and poll every 5 seconds
  // Use mounted flag to prevent state updates after unmount
  useEffect(() => {
    let mounted = true;

    const fetchIfMounted = async () => {
      if (mounted) {
        await fetchActiveJobs();
      }
    };

    // Initial fetch
    if (!initialized) {
      fetchIfMounted();
    }

    // Set up polling
    const interval = setInterval(fetchIfMounted, 5000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [initialized, fetchActiveJobs]);

  const activeJobs = getActiveJobs();
  const completedJobs = getUnseenCompleted();

  // Show all active jobs + unseen completed jobs, excluding dismissed ones
  const visibleJobs = [...activeJobs, ...completedJobs].filter(
    (job) => !dismissedIds.has(job.id)
  );

  const handleDismiss = (jobId: string) => {
    setDismissedIds((prev) => new Set([...prev, jobId]));
  };

  if (visibleJobs.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {visibleJobs.map((job) => (
        <JobProgressToast
          key={job.id}
          job={job}
          onDismiss={() => handleDismiss(job.id)}
        />
      ))}
    </div>
  );
}
