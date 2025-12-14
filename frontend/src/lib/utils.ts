import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Get initials from a name string for avatar fallback
 * @param name - Full name or email to extract initials from
 * @param fallback - Fallback character if no name provided (default: "U")
 * @returns Up to 2 uppercase initials
 */
export function getInitials(name: string | undefined | null, fallback = "U"): string {
  if (!name) return fallback;

  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || fallback;
}
