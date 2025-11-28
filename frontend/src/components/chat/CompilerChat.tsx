"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, XCircle, Loader2, Send } from "lucide-react";
import type { ProcessingState, HITLDecision } from "@/lib/types";

interface CompilerChatProps {
  state: ProcessingState;
  onDecision: (decision: HITLDecision) => void;
  onMessage: (message: string) => void;
}

export function CompilerChat({
  state,
  onDecision,
  onMessage,
}: CompilerChatProps) {
  const [inputValue, setInputValue] = useState("");

  const handleSend = () => {
    if (inputValue.trim()) {
      onMessage(inputValue.trim());
      setInputValue("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Card className="flex flex-col h-[600px]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Project Compiler
          {state.status === "processing" && (
            <Loader2 className="h-4 w-4 animate-spin" />
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col min-h-0">
        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-4">
            {/* Streamed AI response */}
            {state.streamedText && (
              <div className="bg-muted p-4 rounded-lg whitespace-pre-wrap">
                {state.streamedText}
              </div>
            )}

            {/* HITL Approval Request */}
            {state.status === "hitl_pending" && state.pendingHITL && (
              <HITLApprovalCard
                event={state.pendingHITL}
                onDecision={onDecision}
              />
            )}

            {/* Tool calls */}
            {Object.entries(state.nodeDetails).map(([toolName, args]) => (
              <div
                key={toolName}
                className="text-sm bg-muted/50 p-2 rounded border"
              >
                <span className="font-medium">{toolName}</span>
                <pre className="text-xs mt-1 overflow-x-auto">
                  {JSON.stringify(args, null, 2)}
                </pre>
              </div>
            ))}

            {/* Error */}
            {state.status === "error" && state.error && (
              <div className="p-3 bg-destructive/10 text-destructive rounded-lg">
                {state.error}
              </div>
            )}

            {/* Success */}
            {state.status === "complete" && (
              <div className="p-3 bg-green-500/10 text-green-700 dark:text-green-400 rounded-lg">
                Compilation complete!
              </div>
            )}
          </div>
        </ScrollArea>

        <Separator className="my-4" />

        {/* Input */}
        <div className="flex gap-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            disabled={state.status === "idle" || state.status === "hitl_pending"}
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={
              !inputValue.trim() ||
              state.status === "idle" ||
              state.status === "hitl_pending"
            }
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface HITLApprovalCardProps {
  event: any;
  onDecision: (decision: HITLDecision) => void;
}

function HITLApprovalCard({ event, onDecision }: HITLApprovalCardProps) {
  const [feedback, setFeedback] = useState("");

  const toolArgs = event.data?.tool_args || {};
  const toolName = event.data?.tool_name || "Unknown";

  return (
    <Card className="border-yellow-500/50 bg-yellow-500/5">
      <CardHeader>
        <CardTitle className="text-base">Approval Required</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm font-medium mb-2">Tool: {toolName}</p>

          {toolName === "compile_manuals" && toolArgs.merge_plan && (
            <MergePlanPreview plan={toolArgs.merge_plan} />
          )}

          {toolName !== "compile_manuals" && (
            <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
              {JSON.stringify(toolArgs, null, 2)}
            </pre>
          )}
        </div>

        <div className="flex gap-2">
          <Button
            variant="default"
            className="flex-1"
            onClick={() => onDecision({ approved: true })}
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Approve
          </Button>
          <Button
            variant="destructive"
            className="flex-1"
            onClick={() =>
              onDecision({ approved: false, feedback: feedback || "Rejected" })
            }
          >
            <XCircle className="h-4 w-4 mr-2" />
            Reject
          </Button>
        </div>

        <Input
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="Optional feedback for rejection..."
        />
      </CardContent>
    </Card>
  );
}

interface MergePlanPreviewProps {
  plan: {
    sections?: Array<{ title: string; source_manuals: string[] }>;
    duplicates_to_merge?: Array<{ topic: string; manual_ids: string[] }>;
    transitions?: Array<{ from: string; to: string; type: string }>;
  };
}

function MergePlanPreview({ plan }: MergePlanPreviewProps) {
  return (
    <div className="space-y-3 text-sm">
      {plan.sections && plan.sections.length > 0 && (
        <div>
          <p className="font-medium mb-1">Sections:</p>
          <ul className="list-disc list-inside space-y-1">
            {plan.sections.map((section, i) => (
              <li key={i}>
                {section.title}
                <span className="text-muted-foreground">
                  {" "}
                  ({section.source_manuals.length} sources)
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {plan.duplicates_to_merge && plan.duplicates_to_merge.length > 0 && (
        <div>
          <p className="font-medium mb-1">Duplicates to Merge:</p>
          <ul className="list-disc list-inside space-y-1">
            {plan.duplicates_to_merge.map((dup, i) => (
              <li key={i}>
                {dup.topic}
                <span className="text-muted-foreground">
                  {" "}
                  ({dup.manual_ids.length} manuals)
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {plan.transitions && plan.transitions.length > 0 && (
        <div>
          <p className="font-medium mb-1">Transitions:</p>
          <ul className="list-disc list-inside space-y-1">
            {plan.transitions.map((trans, i) => (
              <li key={i}>
                {trans.from} → {trans.to}
                <span className="text-muted-foreground"> ({trans.type})</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
