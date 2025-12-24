"use client";

import { useTranslations } from "next-intl";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Circle, Loader2, AlertCircle, Wifi } from "lucide-react";
import type { ProcessingState } from "@/lib/types";

interface ProcessingProgressProps {
  state: ProcessingState;
}

export function ProcessingProgress({ state }: ProcessingProgressProps) {
  const t = useTranslations("videos.processing");

  const NODE_LABELS: Record<string, string> = {
    analyze_video: t("analyzeVideo"),
    identify_keyframes: t("identifyKeyframes"),
    generate_manual: t("generateDoc"),
  };

  const NODE_DESCRIPTIONS: Record<string, string> = {
    analyze_video: t("analyzeVideoDesc"),
    identify_keyframes: t("identifyKeyframesDesc"),
    generate_manual: t("generateDocDesc"),
  };

  const nodes = ["analyze_video", "identify_keyframes", "generate_manual"];

  const progress =
    state.totalNodes && state.nodeIndex !== undefined
      ? ((state.nodeIndex + 1) / state.totalNodes) * 100
      : 0;

  const isWaiting = state.status === "processing" && !state.currentNode;
  const isConnecting = state.status === "idle";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {state.status === "processing" && (
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          )}
          {state.status === "complete" && (
            <CheckCircle2 className="h-5 w-5 text-green-500" />
          )}
          {state.status === "error" && (
            <AlertCircle className="h-5 w-5 text-destructive" />
          )}
          {t("title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Connecting/Waiting state */}
        {(isConnecting || isWaiting) && (
          <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
            <Wifi className="h-5 w-5 animate-pulse text-primary" />
            <div>
              <p className="font-medium">
                {isConnecting ? t("connecting") : t("starting")}
              </p>
              <p className="text-sm text-muted-foreground">
                {isConnecting
                  ? t("connectingDesc")
                  : t("startingDesc")}
              </p>
            </div>
          </div>
        )}

        {/* Progress bar - only show when we have progress */}
        {state.status === "processing" && state.currentNode && (
          <Progress value={progress} className="h-2" />
        )}

        <div className="space-y-3">
          {nodes.map((node, index) => {
            // A node is complete if it has details OR if a later node has started OR if processing is complete
            const hasDetails = state.nodeDetails[node] !== undefined;
            const laterNodeStarted = state.nodeIndex !== undefined && index < state.nodeIndex;
            const processingComplete = state.status === "complete";
            const isComplete = hasDetails || laterNodeStarted || (processingComplete && index <= nodes.indexOf(state.currentNode || ""));
            const isCurrent = state.currentNode === node && state.status === "processing";
            const details = state.nodeDetails[node];

            return (
              <div
                key={node}
                className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                  isCurrent
                    ? "bg-primary/10 border border-primary/20"
                    : isComplete
                      ? "bg-muted"
                      : "opacity-50"
                }`}
              >
                <div className="flex-shrink-0">
                  {isComplete ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : isCurrent ? (
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-medium">{NODE_LABELS[node] || node}</p>
                  <p className="text-sm text-muted-foreground truncate">
                    {details
                      ? formatDetails(details, t)
                      : isCurrent
                        ? NODE_DESCRIPTIONS[node]
                        : t("waiting")}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {state.status === "error" && state.error && (
          <div className="p-3 bg-destructive/10 text-destructive rounded-lg flex items-start gap-2">
            <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">{t("failed")}</p>
              <p className="text-sm">{state.error}</p>
            </div>
          </div>
        )}

        {state.status === "complete" && state.result && (
          <div className="p-3 bg-green-500/10 text-green-700 dark:text-green-400 rounded-lg flex items-start gap-2">
            <CheckCircle2 className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">{t("success")}</p>
              {getDocId(state.result) && (
                <p className="text-sm mt-1">
                  {t("docId")}: {getDocId(state.result)}
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function getDocId(result: Record<string, unknown>): string | null {
  const id = result.doc_id;
  return typeof id === "string" ? id : null;
}

function formatDetails(
  details: Record<string, unknown>,
  t: (key: string) => string
): string {
  const parts: string[] = [];

  if (details.duration) parts.push(`${t("duration")}: ${details.duration}`);
  if (details.resolution) parts.push(`${details.resolution}`);
  if (details.keyframes_count)
    parts.push(`${details.keyframes_count} ${t("keyframes")}`);
  if (details.screenshots_count)
    parts.push(`${details.screenshots_count} ${t("screenshots")}`);
  if (details.cached) parts.push(t("cached"));

  return parts.join(" • ") || t("processingText");
}
