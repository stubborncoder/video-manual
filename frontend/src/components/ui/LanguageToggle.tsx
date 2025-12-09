"use client";

import { Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/components/providers/I18nProvider";
import { Locale, localeNames } from "@/lib/i18n";

interface LanguageToggleProps {
  collapsed?: boolean;
}

export function LanguageToggle({ collapsed = false }: LanguageToggleProps) {
  const { locale, setLocale } = useLocale();

  const toggleLocale = () => {
    const newLocale: Locale = locale === "en" ? "es" : "en";
    setLocale(newLocale);
  };

  if (collapsed) {
    return (
      <Button
        variant="ghost"
        className="w-full justify-center px-2 hover:text-primary"
        onClick={toggleLocale}
      >
        <Globe className="h-4 w-4" />
        <span className="sr-only">{localeNames[locale]}</span>
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      className="w-full justify-start text-muted-foreground hover:text-primary"
      onClick={toggleLocale}
    >
      <Globe className="mr-2 h-4 w-4" />
      {locale.toUpperCase()} / {locale === "en" ? "ES" : "EN"}
    </Button>
  );
}
