"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { createContext, useContext, useEffect, useState } from "react";

export type Palette = "coral" | "electric-blue" | "mint" | "marigold" | "grape";

interface PaletteContextType {
  palette: Palette;
  setPalette: (palette: Palette) => void;
}

const PaletteContext = createContext<PaletteContextType | undefined>(undefined);

const PALETTE_STORAGE_KEY = "color-palette";
const DEFAULT_PALETTE: Palette = "electric-blue";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [palette, setPaletteState] = useState<Palette>(DEFAULT_PALETTE);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(PALETTE_STORAGE_KEY) as Palette | null;
    if (stored && ["coral", "electric-blue", "mint", "marigold", "grape"].includes(stored)) {
      setPaletteState(stored);
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      document.documentElement.setAttribute("data-palette", palette);
      localStorage.setItem(PALETTE_STORAGE_KEY, palette);
    }
  }, [palette, mounted]);

  const setPalette = (newPalette: Palette) => {
    setPaletteState(newPalette);
  };

  return (
    <NextThemesProvider
      attribute="data-theme"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange={false}
    >
      <PaletteContext.Provider value={{ palette, setPalette }}>
        {children}
      </PaletteContext.Provider>
    </NextThemesProvider>
  );
}

export function usePalette() {
  const context = useContext(PaletteContext);
  if (!context) {
    throw new Error("usePalette must be used within ThemeProvider");
  }
  return context;
}
