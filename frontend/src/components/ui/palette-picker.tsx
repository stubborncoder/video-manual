"use client";

import { Check } from "lucide-react";
import { usePalette, type Palette } from "@/components/providers/ThemeProvider";
import { cn } from "@/lib/utils";

const palettes: { id: Palette; name: string; color: string }[] = [
  { id: "electric-blue", name: "Electric Blue", color: "#4361EE" },
  { id: "coral", name: "Coral", color: "#FF6B6B" },
  { id: "mint", name: "Mint", color: "#2EC4B6" },
  { id: "marigold", name: "Marigold", color: "#F4A261" },
  { id: "grape", name: "Grape", color: "#7209B7" },
];

interface PalettePickerProps {
  showLabels?: boolean;
  size?: "sm" | "md" | "lg";
}

export function PalettePicker({ showLabels = false, size = "md" }: PalettePickerProps) {
  const { palette, setPalette } = usePalette();

  const sizeClasses = {
    sm: "h-6 w-6",
    md: "h-8 w-8",
    lg: "h-10 w-10",
  };

  const iconSizes = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };

  return (
    <div className="space-y-3">
      {showLabels && (
        <label className="label-md text-muted-foreground">Color Palette</label>
      )}
      <div className="flex flex-wrap gap-3">
        {palettes.map((p) => (
          <button
            key={p.id}
            onClick={() => setPalette(p.id)}
            className={cn(
              "relative flex items-center justify-center rounded-full border-2 transition-all duration-200",
              sizeClasses[size],
              palette === p.id
                ? "border-foreground ring-2 ring-ring ring-offset-2 ring-offset-background"
                : "border-transparent hover:border-muted-foreground/50 hover:scale-110"
            )}
            style={{ backgroundColor: p.color }}
            title={p.name}
            aria-label={`Select ${p.name} color palette`}
            aria-pressed={palette === p.id}
          >
            {palette === p.id && (
              <Check className={cn("text-white drop-shadow-md", iconSizes[size])} />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
