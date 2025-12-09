"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { NextIntlClientProvider } from "next-intl";
import { Locale, defaultLocale, getStoredLocale, setStoredLocale } from "@/lib/i18n";

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

// Import messages statically
import enMessages from "../../../messages/en.json";
import esMessages from "../../../messages/es.json";

const messages: Record<Locale, typeof enMessages> = {
  en: enMessages,
  es: esMessages,
};

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = getStoredLocale();
    setLocaleState(stored);
    setMounted(true);
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    setStoredLocale(newLocale);
    // Update HTML lang attribute
    document.documentElement.lang = newLocale;
  }, []);

  // Update HTML lang on mount
  useEffect(() => {
    if (mounted) {
      document.documentElement.lang = locale;
    }
  }, [locale, mounted]);

  // Always provide the context with current locale (or default if not mounted)
  const currentLocale = mounted ? locale : defaultLocale;

  return (
    <NextIntlClientProvider
      locale={currentLocale}
      messages={messages[currentLocale]}
      timeZone="UTC"
    >
      <I18nContext.Provider value={{ locale: currentLocale, setLocale }}>
        {children}
      </I18nContext.Provider>
    </NextIntlClientProvider>
  );
}

export function useLocale() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useLocale must be used within I18nProvider");
  }
  return context;
}
