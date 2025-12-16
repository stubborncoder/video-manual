"use client";

import {
  useState,
  useCallback,
  createContext,
  useContext,
  ReactNode,
} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import {
  ArrowLeft,
  FileText,
  Sparkles,
  Loader2,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { CompilerThread } from "./CompilerThread";
import { CompilerRuntimeProvider } from "./CompilerRuntime";
import { useAssistantToolUI, useInlineRender } from "@assistant-ui/react";

interface CompilerViewNewProps {
  projectName: string;
  projectId: string;
  language: string;
  onBack: () => void;
}

// Context to share compilation state between tool UI and left pane
interface CompilerState {
  mergePlan: any | null;
  compiledContent: string | null;
  status: "idle" | "pending_approval" | "compiling" | "complete" | "rejected";
  setMergePlan: (plan: any) => void;
  setCompiledContent: (content: string) => void;
  setStatus: (status: CompilerState["status"]) => void;
}

const CompilerStateContext = createContext<CompilerState | null>(null);

function useCompilerState() {
  const context = useContext(CompilerStateContext);
  if (!context) {
    throw new Error("useCompilerState must be used within CompilerStateProvider");
  }
  return context;
}

function CompilerStateProvider({ children }: { children: ReactNode }) {
  const [mergePlan, setMergePlan] = useState<any | null>(null);
  const [compiledContent, setCompiledContent] = useState<string | null>(null);
  const [status, setStatus] = useState<CompilerState["status"]>("idle");

  return (
    <CompilerStateContext.Provider
      value={{
        mergePlan,
        compiledContent,
        status,
        setMergePlan,
        setCompiledContent,
        setStatus,
      }}
    >
      {children}
    </CompilerStateContext.Provider>
  );
}

// Component to display merge plan in left pane
function MergePlanDisplay() {
  const { mergePlan } = useCompilerState();

  if (!mergePlan) {
    return null;
  }

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="h-5 w-5 text-yellow-500" />
        <h3 className="text-lg font-semibold">Merge Plan</h3>
      </div>

      {mergePlan.chapters && mergePlan.chapters.length > 0 && (
        <div className="space-y-4">
          <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
            Chapters
          </h4>
          {mergePlan.chapters.map((chapter: any, i: number) => (
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
    </div>
  );
}

// Component to display compiled content
function CompiledDocumentDisplay() {
  const { compiledContent } = useCompilerState();

  if (!compiledContent) {
    return null;
  }

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none p-4">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{compiledContent}</ReactMarkdown>
    </div>
  );
}

// Document preview component
function DocumentPreview() {
  const { status, mergePlan, compiledContent } = useCompilerState();

  const showIdleState = status === "idle" && !mergePlan && !compiledContent;

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b flex items-center gap-2">
        <FileText className="h-5 w-5 text-muted-foreground" />
        <span className="font-medium">Compiled Document</span>
        {status === "compiling" && (
          <Loader2 className="h-4 w-4 animate-spin ml-auto" />
        )}
        {status === "complete" && (
          <CheckCircle2 className="h-4 w-4 text-green-500 ml-auto" />
        )}
        {status === "pending_approval" && (
          <Badge variant="outline" className="ml-auto text-yellow-600 border-yellow-500">
            Pending Approval
          </Badge>
        )}
      </div>
      <ScrollArea className="flex-1">
        {/* Show compiled content if available */}
        <CompiledDocumentDisplay />

        {/* Show merge plan if no compiled content yet */}
        {!compiledContent && <MergePlanDisplay />}

        {/* Fallback idle state */}
        {showIdleState && (
          <div className="text-center py-16 text-muted-foreground">
            <FileText className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">Ready to compile</p>
            <p className="text-sm">
              Send a message to start the compilation process
            </p>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

// Custom Tool UI for compile_manuals to show approval dialog
function CompileApprovalToolUI() {
  const { setMergePlan, setCompiledContent, setStatus } = useCompilerState();

  useAssistantToolUI({
    toolName: "compile_manuals",
    render: useInlineRender(({ args, result, status, addResult }) => {
      // Type the args and result
      const typedArgs = args as { merge_plan?: any } | undefined;
      const typedResult = result as { approved?: boolean; compiled_content?: string } | undefined;
      const [isApproving, setIsApproving] = useState(false);

      // Update compiler state when we receive the merge plan
      if (typedArgs?.merge_plan) {
        // Use setTimeout to avoid state updates during render
        setTimeout(() => {
          setMergePlan(typedArgs.merge_plan);
          if (status.type === "requires-action") {
            setStatus("pending_approval");
          }
        }, 0);
      }

      // Update state when compilation completes
      if (typedResult?.compiled_content) {
        setTimeout(() => {
          setCompiledContent(typedResult.compiled_content!);
          setStatus("complete");
        }, 0);
      }

      const handleApprove = useCallback(() => {
        setIsApproving(true);
        setStatus("compiling");
        addResult({ approved: true });
      }, [addResult]);

      const handleReject = useCallback(() => {
        setStatus("rejected");
        addResult({ approved: false });
      }, [addResult]);

      // If we have a result, show completion status
      if (typedResult) {
        if (typedResult.compiled_content) {
          return (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 text-green-700 dark:text-green-400">
              <CheckCircle2 className="h-4 w-4" />
              <span>Compilation complete!</span>
            </div>
          );
        } else if (!typedResult.approved) {
          return (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-500/10 text-yellow-700 dark:text-yellow-400">
              <XCircle className="h-4 w-4" />
              <span>Compilation rejected</span>
            </div>
          );
        }
      }

      // Show approval UI when tool requires action
      if (status.type === "requires-action") {
        return (
          <Card className="border-yellow-500/50 bg-yellow-500/5 p-4 my-4">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-4 w-4 text-yellow-500" />
              <span className="font-medium">Approval Required</span>
            </div>

            <div className="text-sm text-muted-foreground mb-4">
              The AI wants to compile the manuals with the merge plan shown on the left.
            </div>

            <div className="flex gap-2">
              <Button
                variant="default"
                className="flex-1"
                onClick={handleApprove}
                disabled={isApproving}
              >
                {isApproving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                )}
                Approve
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={handleReject}
                disabled={isApproving}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Reject
              </Button>
            </div>
          </Card>
        );
      }

      // Show pending state while tool is running
      if (status.type === "running") {
        return (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Compiling manuals...</span>
          </div>
        );
      }

      return null;
    }),
  });

  return null;
}

export function CompilerViewNew({
  projectName,
  projectId,
  language,
  onBack,
}: CompilerViewNewProps) {
  return (
    <TooltipProvider>
      <CompilerStateProvider>
        <CompilerRuntimeProvider projectId={projectId} language={language}>
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
                  Language: {language.toUpperCase()}
                </p>
              </div>
            </div>

            {/* Split Pane Content */}
            <ResizablePanelGroup direction="horizontal" className="flex-1 min-h-0">
              {/* Left: Document Preview */}
              <ResizablePanel defaultSize={55} minSize={30}>
                <DocumentPreview />
              </ResizablePanel>

              <ResizableHandle withHandle />

              {/* Right: Thread Chat */}
              <ResizablePanel defaultSize={45} minSize={25}>
                <div className="h-full">
                  <CompilerThread />
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </div>

          {/* Register the tool UI */}
          <CompileApprovalToolUI />
        </CompilerRuntimeProvider>
      </CompilerStateProvider>
    </TooltipProvider>
  );
}
