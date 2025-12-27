"use client";

import { useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { ChevronLeft, ChevronRight, X, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useGuideStore } from "@/stores/guideStore";
import { useSidebar } from "@/components/layout/SidebarContext";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

/**
 * Overlay component for displaying step-by-step guided workflows/tours.
 * Shows current step instructions, progress, and navigation controls.
 * Can highlight elements and navigate to different pages as part of the workflow.
 */
export function WorkflowOverlay() {
  const router = useRouter();
  const { collapsed: sidebarCollapsed } = useSidebar();
  const {
    workflow,
    nextWorkflowStep,
    previousWorkflowStep,
    cancelWorkflow,
    showHighlight,
    clearAllHighlights,
  } = useGuideStore();

  // Execute current step actions (highlight, navigate)
  const executeStepActions = useCallback(() => {
    if (!workflow?.isActive) return;

    const currentStep = workflow.steps[workflow.currentStepIndex];

    // Clear previous highlights
    clearAllHighlights();

    // Navigate if needed
    if (currentStep.navigate) {
      router.push(currentStep.navigate);
    }

    // Highlight element after a small delay (to allow navigation to complete)
    if (currentStep.highlight) {
      setTimeout(() => {
        showHighlight(currentStep.highlight!, 0); // 0 = no auto-dismiss during workflow
      }, currentStep.navigate ? 500 : 100);
    }
  }, [workflow, router, showHighlight, clearAllHighlights]);

  // Execute actions when step changes
  useEffect(() => {
    executeStepActions();
  }, [workflow?.currentStepIndex, executeStepActions]);

  // Clear highlights when workflow ends
  useEffect(() => {
    if (!workflow?.isActive) {
      clearAllHighlights();
    }
  }, [workflow?.isActive, clearAllHighlights]);

  // Handle escape key to cancel workflow
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && workflow?.isActive) {
        cancelWorkflow();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [workflow?.isActive, cancelWorkflow]);

  if (!workflow?.isActive) return null;

  const currentStep = workflow.steps[workflow.currentStepIndex];
  const progress = ((workflow.currentStepIndex + 1) / workflow.steps.length) * 100;
  const isFirstStep = workflow.currentStepIndex === 0;
  const isLastStep = workflow.currentStepIndex === workflow.steps.length - 1;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className={cn(
          "fixed bottom-32 z-[65] w-[380px]",
          // Position based on sidebar state (same logic as GuidePanel)
          sidebarCollapsed ? "left-20" : "left-72"
        )}
      >
        <Card className="shadow-2xl border-primary/20">
          {/* Header */}
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm font-medium">
                  {workflow.title}
                </CardTitle>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={cancelWorkflow}
                className="h-7 w-7 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            {/* Progress bar */}
            <div className="mt-3 space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Step {workflow.currentStepIndex + 1} of {workflow.steps.length}</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-1.5" />
            </div>
          </CardHeader>

          {/* Content */}
          <CardContent className="pt-0">
            {/* Step title */}
            <h4 className="font-semibold text-base mb-2">{currentStep.title}</h4>

            {/* Step description */}
            <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1.5 prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5 text-muted-foreground mb-4">
              <ReactMarkdown>{currentStep.description}</ReactMarkdown>
            </div>

            {/* Navigation buttons */}
            <div className="flex justify-between pt-2 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={previousWorkflowStep}
                disabled={isFirstStep}
                className="gap-1"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </Button>
              <Button
                size="sm"
                onClick={nextWorkflowStep}
                className="gap-1"
              >
                {isLastStep ? "Finish" : "Next"}
                {!isLastStep && <ChevronRight className="h-4 w-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}
