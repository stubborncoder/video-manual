"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Video, Sparkles, CheckCircle2, XCircle, ExternalLink, X, Scan, Images, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { JobInfo } from "@/lib/api";
import { useJobsStore } from "@/stores/jobsStore";

interface VideoCardProgressProps {
  job: JobInfo;
  onDismiss?: () => void;
}

const NODES = ["analyze_video", "identify_keyframes", "generate_manual"] as const;

const NODE_ICONS: Record<string, typeof Scan> = {
  analyze_video: Scan,
  identify_keyframes: Images,
  generate_manual: FileText,
};

/**
 * Premium full-card progress overlay with vertical stepper.
 * Shows video name, processing steps with connecting lines, and status.
 */
export function VideoCardProgress({ job, onDismiss }: VideoCardProgressProps) {
  const router = useRouter();
  const t = useTranslations("videos.processing");
  const tc = useTranslations("videos.processing.card");
  const { markSeen } = useJobsStore();

  const isProcessing = job.status === "processing" || job.status === "pending";
  const isComplete = job.status === "complete";
  const isError = job.status === "error";

  // Determine which nodes are complete based on current node
  const currentNodeIndex = job.current_node
    ? NODES.indexOf(job.current_node as typeof NODES[number])
    : -1;

  // Get translated node labels
  const getNodeLabel = (node: string) => {
    const labelMap: Record<string, string> = {
      analyze_video: t("analyzeVideo"),
      identify_keyframes: t("identifyKeyframes"),
      generate_manual: t("generateDoc"),
    };
    return labelMap[node] || node;
  };

  const handleViewManual = async () => {
    if (!job.manual_id) {
      console.warn("No manual_id available for job:", job.id);
      return;
    }

    try {
      await markSeen(job.id);
    } catch (error) {
      // Log but don't block navigation - marking as seen is not critical
      console.error("Failed to mark job as seen:", error);
    }

    router.push(`/dashboard/docs/${job.manual_id}/edit`);
  };

  const handleDismiss = async () => {
    if (isComplete || isError) {
      try {
        await markSeen(job.id);
      } catch (error) {
        // Log but don't block dismiss - marking as seen is not critical
        console.error("Failed to mark job as seen:", error);
      }
    }
    onDismiss?.();
  };

  return (
    <div
      className={cn(
        "absolute inset-0 z-20 overflow-hidden",
        "bg-gradient-to-b from-background/98 via-background/95 to-background/98",
        "backdrop-blur-md"
      )}
    >
      {/* Subtle animated background pattern */}
      <div className="absolute inset-0 opacity-[0.03]">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)`,
            backgroundSize: "24px 24px",
          }}
        />
      </div>

      {/* Ambient glow effect */}
      {isProcessing && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-primary/20 rounded-full blur-3xl animate-pulse" />
      )}
      {isComplete && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-emerald-500/20 rounded-full blur-3xl" />
      )}

      <div className="relative h-full flex flex-col p-5">
        {/* Header with video name */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={cn(
              "shrink-0 p-2 rounded-lg",
              isProcessing && "bg-primary/10",
              isComplete && "bg-emerald-500/10",
              isError && "bg-destructive/10"
            )}>
              <Video className={cn(
                "h-4 w-4",
                isProcessing && "text-primary",
                isComplete && "text-emerald-500",
                isError && "text-destructive"
              )} />
            </div>
            <div className="min-w-0">
              <p className="font-display text-sm font-semibold truncate leading-tight">
                {job.video_name}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {isProcessing && tc("status")}
                {isComplete && tc("completed")}
                {isError && tc("failedStatus")}
              </p>
            </div>
          </div>

          {/* Dismiss button */}
          {(isComplete || isError) && onDismiss && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 hover:bg-background/80"
              onClick={handleDismiss}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Processing state - elegant vertical stepper */}
        {isProcessing && (
          <div className="flex-1 flex flex-col justify-center">
            <div className="relative pl-4">
              {/* Vertical connecting line */}
              <div className="absolute left-[19px] top-3 bottom-3 w-px bg-border" />

              {/* Progress line overlay */}
              <div
                className="absolute left-[19px] top-3 w-px bg-gradient-to-b from-primary to-primary/50 transition-all duration-500"
                style={{
                  height: currentNodeIndex >= 0
                    ? `${((currentNodeIndex + 0.5) / NODES.length) * 100}%`
                    : "0%",
                }}
              />

              <div className="space-y-4">
                {NODES.map((node, index) => {
                  const isNodeComplete = index < currentNodeIndex;
                  const isNodeCurrent = index === currentNodeIndex;
                  const isNodePending = index > currentNodeIndex || currentNodeIndex === -1;
                  const Icon = NODE_ICONS[node];

                  return (
                    <div
                      key={node}
                      className={cn(
                        "relative flex items-center gap-3 transition-all duration-300",
                        isNodePending && "opacity-40"
                      )}
                    >
                      {/* Step indicator */}
                      <div
                        className={cn(
                          "relative z-10 flex items-center justify-center h-8 w-8 rounded-full border-2 transition-all duration-300",
                          isNodeComplete && "bg-emerald-500 border-emerald-500",
                          isNodeCurrent && "bg-primary/10 border-primary",
                          isNodePending && "bg-background border-muted-foreground/30"
                        )}
                      >
                        {isNodeComplete ? (
                          <CheckCircle2 className="h-4 w-4 text-white" />
                        ) : isNodeCurrent ? (
                          <div className="relative">
                            <Icon className="h-4 w-4 text-primary animate-pulse" />
                            {/* Spinner ring */}
                            <div className="absolute inset-[-6px] rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                          </div>
                        ) : (
                          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </div>

                      {/* Step content */}
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          "text-sm font-medium transition-colors",
                          isNodeComplete && "text-emerald-600 dark:text-emerald-400",
                          isNodeCurrent && "text-foreground",
                          isNodePending && "text-muted-foreground"
                        )}>
                          {getNodeLabel(node)}
                        </p>
                        {isNodeCurrent && (
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {tc("inProgress")}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Complete state */}
        {isComplete && (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            {/* Success icon with glow */}
            <div className="relative mb-4">
              <div className="absolute inset-0 bg-emerald-500/30 rounded-full blur-xl scale-150" />
              <div className="relative p-4 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-full shadow-lg shadow-emerald-500/25">
                <Sparkles className="h-7 w-7 text-white" />
              </div>
            </div>

            <h3 className="font-display text-lg font-semibold text-emerald-500 mb-1">
              {tc("manualReady")}
            </h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-[180px]">
              {tc("manualReadyDesc")}
            </p>

            <Button
              onClick={handleViewManual}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-500/20"
            >
              {tc("viewManual")}
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Error state */}
        {isError && (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            {/* Error icon */}
            <div className="relative mb-4">
              <div className="absolute inset-0 bg-destructive/20 rounded-full blur-xl scale-150" />
              <div className="relative p-4 bg-gradient-to-br from-destructive to-destructive/80 rounded-full">
                <XCircle className="h-7 w-7 text-white" />
              </div>
            </div>

            <h3 className="font-display text-lg font-semibold text-destructive mb-1">
              {tc("processingFailed")}
            </h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-[200px] line-clamp-3">
              {job.error || tc("errorDefault")}
            </p>

            {onDismiss && (
              <Button
                variant="outline"
                onClick={handleDismiss}
                className="gap-2"
              >
                {tc("dismiss")}
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
