/**
 * Centralized constants for validation and configuration.
 * Keep in sync with backend: src/core/constants.py
 *
 * @module constants
 */

// ==================== Input Validation ====================

/** Maximum length for target audience description field */
export const MAX_TARGET_AUDIENCE_LENGTH = 500;

/** Maximum length for target objective description field */
export const MAX_TARGET_OBJECTIVE_LENGTH = 500;

// ==================== Evaluation Scoring ====================

/** Minimum score value for manual evaluations (1 = poor quality) */
export const EVALUATION_SCORE_MIN = 1;

/** Maximum score value for manual evaluations (10 = exceptional quality) */
export const EVALUATION_SCORE_MAX = 10;

/**
 * Score thresholds for percentage-based scoring (0-100 scale).
 * Used for progress bars and visual indicators.
 *
 * @example
 * ```ts
 * const percentage = (score / maxScore) * 100;
 * if (percentage >= SCORE_THRESHOLDS.EXCELLENT) {
 *   // Show green indicator
 * }
 * ```
 */
export const SCORE_THRESHOLDS = {
  /** 80%+ = Excellent (green) - Professional quality, minimal improvements needed */
  EXCELLENT: 80,
  /** 60-79% = Good (yellow) - Solid quality with some areas for improvement */
  GOOD: 60,
  /** 40-59% = Fair (orange) - Adequate but needs significant work */
  FAIR: 40,
  // Below 40% = Poor (red) - Major revisions needed
} as const;

/**
 * Score thresholds for raw scores (1-10 scale).
 * Used for displaying evaluation badges and quick quality indicators.
 *
 * @example
 * ```ts
 * if (evaluation.overall_score >= RAW_SCORE_THRESHOLDS.EXCELLENT) {
 *   // Show "Excellent" badge
 * }
 * ```
 */
export const RAW_SCORE_THRESHOLDS = {
  /** 8-10 = Excellent (green) - Professional quality */
  EXCELLENT: 8,
  /** 6-7 = Good (yellow) - Minor improvements possible */
  GOOD: 6,
  /** 4-5 = Fair (orange) - Needs improvement */
  FAIR: 4,
  // 1-3 = Poor (red) - Major revisions needed
} as const;

/**
 * Human-readable descriptions for each score level.
 * Useful for tooltips and accessibility.
 */
export const SCORE_LEVEL_DESCRIPTIONS = {
  EXCELLENT: "Exceptional quality - Professional grade documentation",
  GOOD: "Good quality - Minor improvements possible",
  FAIR: "Adequate - Needs some improvement",
  POOR: "Below standard - Major revisions recommended",
} as const;

// ==================== Score Color Utilities ====================

/**
 * Returns a Tailwind CSS background color class based on a percentage score.
 *
 * Use this for progress bars and visual indicators where the score has been
 * converted to a percentage (0-100 scale).
 *
 * @param pct - Score as a percentage (0-100)
 * @returns Tailwind CSS background color class (e.g., 'bg-green-500')
 *
 * @example
 * ```tsx
 * const percentage = (score / maxScore) * 100;
 * <div className={`h-2 ${getScoreColorByPercentage(percentage)}`} />
 * ```
 */
export function getScoreColorByPercentage(pct: number): string {
  if (pct >= SCORE_THRESHOLDS.EXCELLENT) return 'bg-green-500';
  if (pct >= SCORE_THRESHOLDS.GOOD) return 'bg-yellow-500';
  if (pct >= SCORE_THRESHOLDS.FAIR) return 'bg-orange-500';
  return 'bg-red-500';
}

/**
 * Color class set returned by getScoreColorByRaw.
 * Includes variants for different UI contexts.
 */
export interface ScoreColorClasses {
  /** Solid background color (e.g., 'bg-green-500') */
  bg: string;
  /** Light/transparent background (e.g., 'bg-green-500/10') */
  bgLight: string;
  /** Text color (e.g., 'text-green-600') */
  text: string;
  /** Hover background color (e.g., 'hover:bg-green-500/20') */
  hoverBg: string;
}

/**
 * Returns a set of Tailwind CSS color classes based on a raw score (1-10).
 *
 * Use this for badges, buttons, and interactive elements where you need
 * multiple color variants (background, text, hover states).
 *
 * @param score - Raw score value (typically 1-10)
 * @returns Object containing Tailwind CSS classes for different contexts
 *
 * @example
 * ```tsx
 * const colors = getScoreColorByRaw(evaluation.overall_score);
 * <button className={`${colors.bgLight} ${colors.text} ${colors.hoverBg}`}>
 *   {score}/10
 * </button>
 * ```
 */
export function getScoreColorByRaw(score: number): ScoreColorClasses {
  if (score >= RAW_SCORE_THRESHOLDS.EXCELLENT) {
    return {
      bg: 'bg-green-500',
      bgLight: 'bg-green-500/10',
      text: 'text-green-600',
      hoverBg: 'hover:bg-green-500/20',
    };
  }
  if (score >= RAW_SCORE_THRESHOLDS.GOOD) {
    return {
      bg: 'bg-yellow-500',
      bgLight: 'bg-yellow-500/10',
      text: 'text-yellow-600',
      hoverBg: 'hover:bg-yellow-500/20',
    };
  }
  if (score >= RAW_SCORE_THRESHOLDS.FAIR) {
    return {
      bg: 'bg-orange-500',
      bgLight: 'bg-orange-500/10',
      text: 'text-orange-600',
      hoverBg: 'hover:bg-orange-500/20',
    };
  }
  return {
    bg: 'bg-red-500',
    bgLight: 'bg-red-500/10',
    text: 'text-red-600',
    hoverBg: 'hover:bg-red-500/20',
  };
}

/**
 * Returns the score level label based on a raw score.
 *
 * @param score - Raw score value (1-10)
 * @returns Score level label ('Excellent', 'Good', 'Fair', or 'Poor')
 *
 * @example
 * ```ts
 * getScoreLevel(9) // => 'Excellent'
 * getScoreLevel(6) // => 'Good'
 * ```
 */
export function getScoreLevel(score: number): keyof typeof SCORE_LEVEL_DESCRIPTIONS {
  if (score >= RAW_SCORE_THRESHOLDS.EXCELLENT) return 'EXCELLENT';
  if (score >= RAW_SCORE_THRESHOLDS.GOOD) return 'GOOD';
  if (score >= RAW_SCORE_THRESHOLDS.FAIR) return 'FAIR';
  return 'POOR';
}

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
