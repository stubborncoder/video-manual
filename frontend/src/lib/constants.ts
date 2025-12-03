/**
 * Centralized constants for validation and configuration.
 * Keep in sync with backend: src/core/constants.py
 */

// Input field length limits
export const MAX_TARGET_AUDIENCE_LENGTH = 500;
export const MAX_TARGET_OBJECTIVE_LENGTH = 500;

// Evaluation score range
export const EVALUATION_SCORE_MIN = 1;
export const EVALUATION_SCORE_MAX = 10;

// Supported languages (ISO 639-1 codes to names)
export const SUPPORTED_LANGUAGES: Record<string, string> = {
  en: "English",
  es: "Spanish",
  fr: "French",
  de: "German",
  it: "Italian",
  pt: "Portuguese",
  nl: "Dutch",
  pl: "Polish",
  ru: "Russian",
  ja: "Japanese",
  ko: "Korean",
  zh: "Chinese",
  ar: "Arabic",
  hi: "Hindi",
  tr: "Turkish",
  vi: "Vietnamese",
  th: "Thai",
  id: "Indonesian",
  ms: "Malay",
  sv: "Swedish",
  no: "Norwegian",
  da: "Danish",
  fi: "Finnish",
  cs: "Czech",
  uk: "Ukrainian",
  he: "Hebrew",
  el: "Greek",
  ro: "Romanian",
  hu: "Hungarian",
  bg: "Bulgarian",
  hr: "Croatian",
  sk: "Slovak",
  sl: "Slovenian",
  et: "Estonian",
  lv: "Latvian",
  lt: "Lithuanian",
  ca: "Catalan",
  eu: "Basque",
  gl: "Galician",
};

// Default output language
export const DEFAULT_OUTPUT_LANGUAGE = "English";
