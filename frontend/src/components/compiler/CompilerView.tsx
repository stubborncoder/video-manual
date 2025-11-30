"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Send,
  FileText,
  Sparkles,
  MessageSquare,
  ArrowLeft,
  Bot,
  User,
  Wrench,
  ClipboardList,
} from "lucide-react";
import type { ProcessingState, HITLDecision } from "@/lib/types";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  toolCalls?: { name: string; args: Record<string, unknown> }[];
}

interface CompilerViewProps {
  projectId: string;
  projectName: string;
  language: string;
  state: ProcessingState;
  onDecision: (decision: HITLDecision) => void;
  onMessage: (message: string) => void;
  onBack: () => void;
}

export function CompilerView({
  projectId,
  projectName,
  language,
  state,
  onDecision,
  onMessage,
  onBack,
}: CompilerViewProps) {
  console.log("[CompilerView] state:", state.status, "streamedText length:", state.streamedText?.length);

  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [compiledContent, setCompiledContent] = useState<string>("");
  const [mergePlan, setMergePlan] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"plan" | "result">("plan");
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastStreamedTextRef = useRef("");

  // Update messages from streamed text
  useEffect(() => {
    // Reset ref when streamedText is cleared (e.g., after HITL decision)
    if (!state.streamedText) {
      lastStreamedTextRef.current = "";
      return;
    }

    if (state.streamedText !== lastStreamedTextRef.current) {
      const newText = state.streamedText;
      lastStreamedTextRef.current = newText;

      // Update or add assistant message
      setMessages((prev) => {
        const lastMsg = prev[prev.length - 1];
        // Update existing assistant message if streaming or just finished streaming
        if (lastMsg && lastMsg.role === "assistant") {
          return prev.map((m, i) =>
            i === prev.length - 1 ? { ...m, content: newText } : m
          );
        } else if (newText) {
          // Add new assistant message
          return [
            ...prev,
            {
              id: `assistant-${Date.now()}`,
              role: "assistant" as const,
              content: newText,
              timestamp: new Date(),
            },
          ];
        }
        return prev;
      });
    }
  }, [state.streamedText]);

  // Handle tool calls
  useEffect(() => {
    const toolEntries = Object.entries(state.nodeDetails);
    if (toolEntries.length > 0) {
      const [toolName, args] = toolEntries[toolEntries.length - 1];

      // Check if this tool call was already added
      setMessages((prev) => {
        const hasToolCall = prev.some(
          (m) => m.toolCalls?.some((tc) => tc.name === toolName)
        );
        if (hasToolCall) return prev;

        // Add tool call as system message
        return [
          ...prev,
          {
            id: `tool-${Date.now()}`,
            role: "system" as const,
            content: `Calling ${toolName}...`,
            timestamp: new Date(),
            toolCalls: [{ name: toolName, args: args as Record<string, unknown> }],
          },
        ];
      });
    }
  }, [state.nodeDetails]);

  // Handle HITL - extract merge plan
  useEffect(() => {
    if (state.status === "hitl_pending" && state.pendingHITL) {
      const toolArgs = (state.pendingHITL as any).data?.tool_args;
      if (toolArgs?.merge_plan) {
        setMergePlan(toolArgs.merge_plan);
      }
    }
  }, [state.status, state.pendingHITL]);

  // Handle completion - extract compiled content
  useEffect(() => {
    if (state.status === "complete" && state.result) {
      const result = state.result as Record<string, unknown>;
      if (result.compiled_content && typeof result.compiled_content === "string") {
        setCompiledContent(result.compiled_content);
        setActiveTab("result"); // Switch to result tab on completion
      }
    }
  }, [state.status, state.result]);

  // Auto-scroll chat
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (inputValue.trim()) {
      // Add user message
      setMessages((prev) => [
        ...prev,
        {
          id: `user-${Date.now()}`,
          role: "user",
          content: inputValue.trim(),
          timestamp: new Date(),
        },
      ]);
      onMessage(inputValue.trim());
      setInputValue("");
      lastStreamedTextRef.current = ""; // Reset for new assistant response
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 p-4 border-b shrink-0">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Compiling: {projectName}
          </h2>
          <p className="text-sm text-muted-foreground">
            Language: {language.toUpperCase()} | Status:{" "}
            <Badge
              variant={
                state.status === "complete" && compiledContent
                  ? "default"
                  : state.status === "error"
                  ? "destructive"
                  : "secondary"
              }
            >
              {state.status === "complete" && !compiledContent
                ? "in progress"
                : state.status}
            </Badge>
          </p>
        </div>
      </div>

      {/* Split Pane Content */}
      <ResizablePanelGroup direction="horizontal" className="flex-1 min-h-0">
        {/* Left: Plan & Result Tabs */}
        <ResizablePanel defaultSize={55} minSize={30}>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "plan" | "result")} className="h-full flex flex-col">
            <div className="px-4 pt-4 border-b">
              <TabsList className="w-full justify-start">
                <TabsTrigger value="plan" className="flex items-center gap-2">
                  <ClipboardList className="h-4 w-4" />
                  Merge Plan
                  {mergePlan && (
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                      {mergePlan.chapters?.length || 0}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="result" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Compiled Result
                  {compiledContent && (
                    <CheckCircle2 className="h-3 w-3 ml-1 text-green-500" />
                  )}
                </TabsTrigger>
                {state.status === "processing" && (
                  <Loader2 className="h-4 w-4 animate-spin ml-auto mr-2" />
                )}
              </TabsList>
            </div>

            {/* Plan Tab */}
            <TabsContent value="plan" className="flex-1 overflow-hidden mt-0">
              <div className="h-full overflow-y-auto p-6">
                {mergePlan ? (
                  <MergePlanDisplay plan={mergePlan} />
                ) : state.status === "idle" ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <ClipboardList className="mx-auto h-12 w-12 mb-4 opacity-50" />
                    <p className="text-lg font-medium">Waiting for merge plan...</p>
                    <p className="text-sm">
                      The AI will analyze your manuals and create a merge plan
                    </p>
                  </div>
                ) : state.status === "processing" ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <Loader2 className="mx-auto h-12 w-12 mb-4 animate-spin" />
                    <p className="text-lg font-medium">Analyzing manuals...</p>
                    <p className="text-sm">
                      Creating merge plan based on your project structure
                    </p>
                  </div>
                ) : state.status === "error" ? (
                  <div className="text-center py-16 text-destructive">
                    <XCircle className="mx-auto h-12 w-12 mb-4" />
                    <p className="text-lg font-medium">Error</p>
                    <p className="text-sm">{state.error}</p>
                  </div>
                ) : (
                  <div className="text-center py-16 text-muted-foreground">
                    <ClipboardList className="mx-auto h-12 w-12 mb-4 opacity-50" />
                    <p className="text-lg font-medium">No merge plan yet</p>
                    <p className="text-sm">
                      The merge plan will appear here after analysis
                    </p>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Result Tab */}
            <TabsContent value="result" className="flex-1 overflow-hidden mt-0">
              <div className="h-full overflow-y-auto p-6">
                {compiledContent ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        img: ({ src, alt }) => {
                          // Transform screenshots/filename.png to API URL
                          const srcStr = typeof src === "string" ? src : "";
                          let imgSrc = srcStr;
                          if (imgSrc.startsWith("screenshots/")) {
                            const filename = imgSrc.replace("screenshots/", "");
                            imgSrc = `/api/projects/${projectId}/compiled/screenshots/${filename}`;
                          }
                          return (
                            <span className="block my-4">
                              <img
                                src={imgSrc}
                                alt={alt || "Screenshot"}
                                className="rounded-lg border shadow-sm w-full"
                              />
                              {alt && (
                                <span className="block text-center text-sm text-muted-foreground mt-2">
                                  {alt}
                                </span>
                              )}
                            </span>
                          );
                        },
                      }}
                    >
                      {compiledContent}
                    </ReactMarkdown>
                  </div>
                ) : state.status === "complete" ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <FileText className="mx-auto h-12 w-12 mb-4 opacity-50" />
                    <p className="text-lg font-medium">No content generated</p>
                    <p className="text-sm">
                      The compilation completed but no content was produced
                    </p>
                  </div>
                ) : (
                  <div className="text-center py-16 text-muted-foreground">
                    <FileText className="mx-auto h-12 w-12 mb-4 opacity-50" />
                    <p className="text-lg font-medium">Waiting for compilation...</p>
                    <p className="text-sm">
                      The compiled document will appear here after approval
                    </p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Right: Copilot Chat */}
        <ResizablePanel defaultSize={45} minSize={25}>
          <div className="h-full flex flex-col">
            <div className="p-4 border-b flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-muted-foreground" />
              <span className="font-medium">Compilation Assistant</span>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4" ref={scrollRef}>
              <div className="space-y-4">
                {messages.length === 0 && state.status === "idle" && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Bot className="mx-auto h-10 w-10 mb-3 opacity-50" />
                    <p className="text-sm">
                      The compilation assistant will help you review and merge
                      your manuals
                    </p>
                  </div>
                )}

                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-3 ${
                      msg.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    {msg.role !== "user" && (
                      <div className="shrink-0">
                        {msg.role === "system" ? (
                          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                            <Wrench className="h-4 w-4" />
                          </div>
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <Bot className="h-4 w-4 text-primary" />
                          </div>
                        )}
                      </div>
                    )}

                    <div
                      className={`max-w-[80%] rounded-lg px-4 py-2 ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : msg.role === "system"
                          ? "bg-muted text-muted-foreground text-sm"
                          : "bg-muted"
                      }`}
                    >
                      {msg.toolCalls ? (
                        <div className="space-y-2">
                          {msg.toolCalls.map((tc, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <Wrench className="h-3 w-3" />
                              <span className="font-mono text-xs">{tc.name}</span>
                            </div>
                          ))}
                        </div>
                      ) : msg.role === "assistant" ? (
                        <ChatMarkdown content={msg.content} />
                      ) : (
                        <div className="whitespace-pre-wrap">{msg.content}</div>
                      )}
                    </div>

                    {msg.role === "user" && (
                      <div className="shrink-0">
                        <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
                          <User className="h-4 w-4 text-primary-foreground" />
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* Loading indicator - only show when processing with no text yet */}
                {state.status === "processing" && !state.streamedText && (
                  <div className="flex gap-3 justify-start">
                    <div className="shrink-0">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Bot className="h-4 w-4 text-primary" />
                      </div>
                    </div>
                    <div className="bg-muted rounded-lg px-4 py-2 max-w-[80%]">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  </div>
                )}

                {/* HITL Approval Request */}
                {state.status === "hitl_pending" && state.pendingHITL && (
                  <HITLApprovalCard
                    event={state.pendingHITL}
                    onDecision={onDecision}
                  />
                )}

                {/* Completion - only show if compiled content exists */}
                {state.status === "complete" && compiledContent && (
                  <div className="flex gap-3 justify-start">
                    <div className="h-8 w-8 rounded-full bg-green-500/10 flex items-center justify-center">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    </div>
                    <div className="bg-green-500/10 text-green-700 dark:text-green-400 rounded-lg px-4 py-2">
                      Compilation complete! The document is ready.
                    </div>
                  </div>
                )}

                {/* Error */}
                {state.status === "error" && state.error && (
                  <div className="flex gap-3 justify-start">
                    <div className="h-8 w-8 rounded-full bg-destructive/10 flex items-center justify-center">
                      <XCircle className="h-4 w-4 text-destructive" />
                    </div>
                    <div className="bg-destructive/10 text-destructive rounded-lg px-4 py-2">
                      {state.error}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Input */}
            <div className="p-4 border-t">
              <div className="flex gap-2">
                <Input
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    state.status === "hitl_pending"
                      ? "Approve or reject the action above..."
                      : "Ask the assistant..."
                  }
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
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

// Markdown component for chat messages - compact styling for bubbles
function ChatMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        // Override default prose styles for chat bubbles
        h1: ({ children }) => (
          <h1 className="text-lg font-bold mt-3 mb-2 first:mt-0">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-base font-semibold mt-3 mb-1.5 first:mt-0">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-sm font-semibold mt-2 mb-1 first:mt-0">{children}</h3>
        ),
        p: ({ children }) => (
          <p className="my-1.5 first:mt-0 last:mb-0 leading-relaxed">{children}</p>
        ),
        ul: ({ children }) => (
          <ul className="my-1.5 ml-4 list-disc space-y-0.5">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="my-1.5 ml-4 list-decimal space-y-0.5">{children}</ol>
        ),
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        code: ({ children, className }) => {
          const isInline = !className;
          return isInline ? (
            <code className="bg-background/50 px-1 py-0.5 rounded text-sm font-mono">
              {children}
            </code>
          ) : (
            <pre className="bg-background/50 p-2 rounded overflow-x-auto my-2 text-sm">
              <code className="font-mono">{children}</code>
            </pre>
          );
        },
        pre: ({ children }) => <>{children}</>,
        strong: ({ children }) => (
          <strong className="font-semibold">{children}</strong>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-primary/50 pl-3 my-2 italic opacity-90">
            {children}
          </blockquote>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
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
    <Card className="border-yellow-500/50 bg-yellow-500/5 my-4">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-yellow-500" />
          Approval Required
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm font-medium mb-2">Tool: {toolName}</p>

          {toolName === "compile_manuals" && toolArgs.merge_plan && (
            <MergePlanPreview plan={toolArgs.merge_plan} />
          )}

          {toolName !== "compile_manuals" && (
            <pre className="text-xs bg-muted p-2 rounded overflow-x-auto max-h-40">
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
    <div className="space-y-3 text-sm bg-muted p-3 rounded-lg">
      {plan.sections && plan.sections.length > 0 && (
        <div>
          <p className="font-medium mb-1">Sections:</p>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            {plan.sections.map((section, i) => (
              <li key={i}>
                {section.title}
                <span className="opacity-75">
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
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            {plan.duplicates_to_merge.map((dup, i) => (
              <li key={i}>
                {dup.topic}
                <span className="opacity-75">
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
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            {plan.transitions.map((trans, i) => (
              <li key={i}>
                {trans.from} &rarr; {trans.to}
                <span className="opacity-75"> ({trans.type})</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

interface MergePlanDisplayProps {
  plan?: {
    chapters?: Array<{
      title: string;
      sources: string[];
      merge_strategy?: string;
      notes?: string;
    }>;
    duplicates_detected?: Array<{ topic: string; manual_ids: string[] }>;
    transitions_needed?: Array<{ from: string; to: string; type: string }>;
  };
}

function MergePlanDisplay({ plan }: MergePlanDisplayProps) {
  if (!plan) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <FileText className="mx-auto h-12 w-12 mb-4 opacity-50" />
        <p className="text-lg font-medium">Merge Plan</p>
        <p className="text-sm">Waiting for merge plan details...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="h-5 w-5 text-yellow-500" />
        <h3 className="text-lg font-semibold">Merge Plan - Awaiting Approval</h3>
      </div>

      {plan.chapters && plan.chapters.length > 0 && (
        <div className="space-y-4">
          <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
            Chapters
          </h4>
          {plan.chapters.map((chapter, i) => (
            <Card key={i} className="p-4">
              <h5 className="font-medium mb-2">{chapter.title}</h5>
              {chapter.notes && (
                <p className="text-sm text-muted-foreground mb-2 italic">
                  {chapter.notes}
                </p>
              )}
              <div className="text-sm">
                <span className="text-muted-foreground">Sources: </span>
                <span className="font-mono text-xs">
                  {chapter.sources?.join(", ") || "None"}
                </span>
              </div>
              {chapter.merge_strategy && (
                <div className="text-sm mt-1">
                  <span className="text-muted-foreground">Strategy: </span>
                  <Badge variant="secondary">{chapter.merge_strategy}</Badge>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {plan.duplicates_detected && plan.duplicates_detected.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
            Duplicates to Merge
          </h4>
          <div className="space-y-2">
            {plan.duplicates_detected.map((dup, i) => (
              <div key={i} className="flex items-center gap-2 text-sm p-2 bg-muted rounded">
                <span className="font-medium">{dup.topic}</span>
                <span className="text-muted-foreground">
                  ({dup.manual_ids?.length || 0} manuals)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {plan.transitions_needed && plan.transitions_needed.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
            Transitions
          </h4>
          <div className="space-y-2">
            {plan.transitions_needed.map((trans, i) => (
              <div key={i} className="flex items-center gap-2 text-sm p-2 bg-muted rounded">
                <span>{trans.from}</span>
                <span className="text-muted-foreground">&rarr;</span>
                <span>{trans.to}</span>
                <Badge variant="outline" className="ml-auto">{trans.type}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
        <p className="text-sm text-yellow-700 dark:text-yellow-400">
          Review the merge plan above and approve or reject in the chat panel.
        </p>
      </div>
    </div>
  );
}
