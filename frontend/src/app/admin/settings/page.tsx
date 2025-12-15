"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  adminApi,
  ModelInfo,
  ModelsResponse,
  ModelSettings,
} from "@/lib/api/admin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, Video, FileText, ClipboardCheck, MessageSquare, DollarSign } from "lucide-react";
import { toast } from "sonner";

type TaskType = keyof ModelSettings;

interface TaskConfig {
  key: TaskType;
  label: string;
  description: string;
  icon: React.ElementType;
}

const TASK_CONFIGS: TaskConfig[] = [
  {
    key: "video_analysis",
    label: "Video Analysis",
    description: "Model used to analyze video content and extract information",
    icon: Video,
  },
  {
    key: "manual_generation",
    label: "Manual Generation",
    description: "Model used to generate step-by-step documentation from video analysis",
    icon: FileText,
  },
  {
    key: "manual_evaluation",
    label: "Manual Evaluation",
    description: "Model used to evaluate and score manual quality",
    icon: ClipboardCheck,
  },
  {
    key: "manual_editing",
    label: "Manual Editing (Copilot)",
    description: "Model used for the AI copilot in the manual editor",
    icon: MessageSquare,
  },
];

function formatCost(cost: number): string {
  if (cost >= 1) return `$${cost.toFixed(2)}`;
  return `$${cost.toFixed(3)}`;
}

function ModelOption({ model }: { model: ModelInfo }) {
  return (
    <div className="flex items-center justify-between w-full gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <span className="truncate">{model.name}</span>
        <Badge variant="outline" className="text-xs shrink-0">
          {model.provider === "google" ? "Google" : "Anthropic"}
        </Badge>
      </div>
      <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
        <DollarSign className="h-3 w-3" />
        <span>{formatCost(model.input_cost_per_million)}</span>
        <span>/</span>
        <span>{formatCost(model.output_cost_per_million)}</span>
      </div>
    </div>
  );
}

export default function AdminSettingsPage() {
  const t = useTranslations("admin");
  const [availableModels, setAvailableModels] = useState<ModelsResponse | null>(null);
  const [currentSettings, setCurrentSettings] = useState<ModelSettings | null>(null);
  const [pendingSettings, setPendingSettings] = useState<ModelSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [models, settings] = await Promise.all([
          adminApi.getAvailableModels(),
          adminApi.getModelSettings(),
        ]);
        setAvailableModels(models);
        setCurrentSettings(settings);
        setPendingSettings(settings);
      } catch (error) {
        console.error("Failed to load settings:", error);
        toast.error("Failed to load model settings");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const handleModelChange = (taskKey: TaskType, modelId: string) => {
    if (pendingSettings) {
      setPendingSettings({
        ...pendingSettings,
        [taskKey]: modelId,
      });
    }
  };

  const handleSave = async () => {
    if (!pendingSettings || !currentSettings) return;

    // Find what changed
    const changes: Partial<ModelSettings> = {};
    for (const key of Object.keys(pendingSettings) as TaskType[]) {
      if (pendingSettings[key] !== currentSettings[key]) {
        changes[key] = pendingSettings[key];
      }
    }

    if (Object.keys(changes).length === 0) {
      toast.info("No changes to save");
      return;
    }

    setSaving(true);
    try {
      await adminApi.updateModelSettings(changes);
      setCurrentSettings(pendingSettings);
      toast.success("Model settings saved successfully");
    } catch (error) {
      console.error("Failed to save settings:", error);
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = pendingSettings && currentSettings &&
    JSON.stringify(pendingSettings) !== JSON.stringify(currentSettings);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading settings...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Configure AI models and system settings
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={!hasChanges || saving}
        >
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save Changes
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>AI Model Configuration</CardTitle>
          <CardDescription>
            Select which AI models to use for different tasks. Cost shown is per 1M tokens (input / output).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {TASK_CONFIGS.map((config) => {
            const Icon = config.icon;
            const models = availableModels?.[config.key] || [];
            const currentModel = pendingSettings?.[config.key];

            return (
              <div key={config.key} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">{config.label}</Label>
                </div>
                <p className="text-xs text-muted-foreground mb-2">
                  {config.description}
                </p>
                <Select
                  value={currentModel}
                  onValueChange={(value) => handleModelChange(config.key, value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a model" />
                  </SelectTrigger>
                  <SelectContent>
                    {models.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        <ModelOption model={model} />
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {config.key === "video_analysis" && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    Video analysis requires Gemini models (only they support video processing)
                  </p>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Model Pricing Reference */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Model Pricing Reference</CardTitle>
          <CardDescription>
            Cost per 1 million tokens for each available model
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {/* Google Models */}
            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                <Badge variant="outline">Google</Badge>
                Gemini Models
              </h4>
              <div className="space-y-2">
                {availableModels?.video_analysis
                  ?.filter((m) => m.provider === "google")
                  .map((model) => (
                    <div
                      key={model.id}
                      className="flex items-center justify-between text-sm p-2 rounded bg-muted/50"
                    >
                      <div>
                        <span className="font-medium">{model.name}</span>
                        {model.supports_video && (
                          <Badge variant="secondary" className="ml-2 text-xs">
                            Video
                          </Badge>
                        )}
                      </div>
                      <div className="text-muted-foreground">
                        {formatCost(model.input_cost_per_million)} /{" "}
                        {formatCost(model.output_cost_per_million)}
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Anthropic Models */}
            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                <Badge variant="outline">Anthropic</Badge>
                Claude Models
              </h4>
              <div className="space-y-2">
                {availableModels?.manual_generation
                  ?.filter((m) => m.provider === "anthropic")
                  .map((model) => (
                    <div
                      key={model.id}
                      className="flex items-center justify-between text-sm p-2 rounded bg-muted/50"
                    >
                      <div>
                        <span className="font-medium">{model.name}</span>
                        {model.supports_vision && (
                          <Badge variant="secondary" className="ml-2 text-xs">
                            Vision
                          </Badge>
                        )}
                      </div>
                      <div className="text-muted-foreground">
                        {formatCost(model.input_cost_per_million)} /{" "}
                        {formatCost(model.output_cost_per_million)}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
