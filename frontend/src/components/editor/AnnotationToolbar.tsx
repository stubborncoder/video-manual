"use client";

import { memo } from "react";
import {
  MousePointer2,
  MoveRight,
  Square,
  Circle,
  Type,
  Pencil,
  Undo2,
  Redo2,
  Minus,
  Plus,
  Crop,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type AnnotationTool = "select" | "arrow" | "rect" | "circle" | "text" | "freehand" | "crop";

interface AnnotationToolbarProps {
  activeTool: AnnotationTool;
  onToolChange: (tool: AnnotationTool) => void;
  strokeColor: string;
  onStrokeColorChange: (color: string) => void;
  strokeWidth: number;
  onStrokeWidthChange: (width: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const PRESET_COLORS = [
  "#FF0000", // Red
  "#FF6B00", // Orange
  "#FFD600", // Yellow
  "#00C853", // Green
  "#00B0FF", // Blue
  "#7C4DFF", // Purple
  "#FF4081", // Pink
  "#FFFFFF", // White
  "#000000", // Black
];

const tools: { id: AnnotationTool; icon: React.ElementType; label: string; shortcut: string }[] = [
  { id: "select", icon: MousePointer2, label: "Select", shortcut: "V" },
  { id: "crop", icon: Crop, label: "Crop", shortcut: "X" },
  { id: "arrow", icon: MoveRight, label: "Arrow", shortcut: "A" },
  { id: "rect", icon: Square, label: "Rectangle", shortcut: "R" },
  { id: "circle", icon: Circle, label: "Circle", shortcut: "C" },
  { id: "text", icon: Type, label: "Text", shortcut: "T" },
  { id: "freehand", icon: Pencil, label: "Freehand", shortcut: "P" },
];

export const AnnotationToolbar = memo(function AnnotationToolbar({
  activeTool,
  onToolChange,
  strokeColor,
  onStrokeColorChange,
  strokeWidth,
  onStrokeWidthChange,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}: AnnotationToolbarProps) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-black/70 backdrop-blur-sm rounded-lg">
      {/* Tool buttons */}
      <div className="flex items-center gap-1 border-r border-white/20 pr-2">
        {tools.map((tool) => {
          const Icon = tool.icon;
          return (
            <Button
              key={tool.id}
              variant="ghost"
              size="sm"
              onClick={() => onToolChange(tool.id)}
              className={cn(
                "h-9 w-9 p-0 text-white hover:bg-white/20",
                activeTool === tool.id && "bg-white/30"
              )}
              title={`${tool.label} (${tool.shortcut})`}
            >
              <Icon className="h-4 w-4" />
            </Button>
          );
        })}
      </div>

      {/* Color picker */}
      <div className="flex items-center gap-2 border-r border-white/20 pr-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 w-9 p-0 hover:bg-white/20"
              title="Stroke Color"
            >
              <div
                className="h-5 w-5 rounded border-2 border-white"
                style={{ backgroundColor: strokeColor }}
              />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2" side="top">
            <div className="grid grid-cols-5 gap-1">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => onStrokeColorChange(color)}
                  className={cn(
                    "h-7 w-7 rounded border-2 transition-transform hover:scale-110",
                    strokeColor === color
                      ? "border-primary ring-2 ring-primary ring-offset-2"
                      : "border-transparent"
                  )}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
            {/* Custom color input */}
            <div className="mt-2 pt-2 border-t">
              <input
                type="color"
                value={strokeColor}
                onChange={(e) => onStrokeColorChange(e.target.value)}
                className="w-full h-8 cursor-pointer rounded"
                title="Custom color"
              />
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Stroke width */}
      <div className="flex items-center gap-2 border-r border-white/20 pr-2 min-w-[140px]">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onStrokeWidthChange(Math.max(1, strokeWidth - 1))}
          className="h-7 w-7 p-0 text-white hover:bg-white/20"
          disabled={strokeWidth <= 1}
        >
          <Minus className="h-3 w-3" />
        </Button>
        <Slider
          value={[strokeWidth]}
          onValueChange={([value]) => onStrokeWidthChange(value)}
          min={1}
          max={20}
          step={1}
          className="w-16"
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onStrokeWidthChange(Math.min(20, strokeWidth + 1))}
          className="h-7 w-7 p-0 text-white hover:bg-white/20"
          disabled={strokeWidth >= 20}
        >
          <Plus className="h-3 w-3" />
        </Button>
        <span className="text-xs text-white/70 w-6 text-center">{strokeWidth}</span>
      </div>

      {/* Undo/Redo */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={onUndo}
          disabled={!canUndo}
          className="h-9 w-9 p-0 text-white hover:bg-white/20 disabled:opacity-30"
          title="Undo (Ctrl+Z)"
        >
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRedo}
          disabled={!canRedo}
          className="h-9 w-9 p-0 text-white hover:bg-white/20 disabled:opacity-30"
          title="Redo (Ctrl+Y)"
        >
          <Redo2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
});

export default AnnotationToolbar;
