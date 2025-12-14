export type Locale = "en" | "es";

export const locales: Locale[] = ["en", "es"];
export const defaultLocale: Locale = "en";

export const localeNames: Record<Locale, string> = {
  en: "English",
  es: "Español",
};

export const LOCALE_STORAGE_KEY = "locale";

// Detect browser language and map to supported locale
export function detectBrowserLocale(): Locale {
  if (typeof window === "undefined") return defaultLocale;

  // Get browser languages (e.g., ["es-ES", "es", "en-US", "en"])
  const browserLanguages = navigator.languages || [navigator.language];

  for (const lang of browserLanguages) {
    // Get the primary language code (e.g., "es" from "es-ES")
    const primaryLang = lang.split("-")[0].toLowerCase();
    if (locales.includes(primaryLang as Locale)) {
      return primaryLang as Locale;
    }
  }

  return defaultLocale;
}

export function getStoredLocale(): Locale | null {
  if (typeof window === "undefined") return null;

  const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
  if (stored && locales.includes(stored as Locale)) {
    return stored as Locale;
  }
  return null;
}

// Get the effective locale: stored > browser detected > default
export function getEffectiveLocale(): Locale {
  const stored = getStoredLocale();
  if (stored) return stored;
  return detectBrowserLocale();
}

export function setStoredLocale(locale: Locale): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LOCALE_STORAGE_KEY, locale);
}
