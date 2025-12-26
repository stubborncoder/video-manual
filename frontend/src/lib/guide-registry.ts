/**
 * Global registry for guide-controllable UI elements
 * Allows the guide agent to programmatically control dropdowns, links, dialogs, etc.
 */

// Dropdown registry - stores setOpen functions for ControllableDropdownMenu
const dropdownRegistry = new Map<string, (open: boolean) => void>();

export function registerDropdown(id: string, setOpen: (open: boolean) => void) {
  dropdownRegistry.set(id, setOpen);
  return () => dropdownRegistry.delete(id);
}

export function openDropdown(id: string): boolean {
  const setOpen = dropdownRegistry.get(id);
  if (setOpen) {
    setOpen(true);
    return true;
  }
  return false;
}

// Link registry - stores URLs for ControllableLink
const linkRegistry = new Map<string, string>();
let navigateFunction: ((url: string) => void) | null = null;

export function registerLink(id: string, href: string) {
  linkRegistry.set(id, href);
  return () => linkRegistry.delete(id);
}

export function setNavigateFunction(fn: (url: string) => void) {
  navigateFunction = fn;
}

export function navigateToLink(id: string): boolean {
  const href = linkRegistry.get(id);
  if (href && navigateFunction) {
    navigateFunction(href);
    return true;
  }
  return false;
}

// Dialog registry - stores setOpen functions for controllable dialogs
const dialogRegistry = new Map<string, (open: boolean) => void>();

export function registerDialog(id: string, setOpen: (open: boolean) => void) {
  dialogRegistry.set(id, setOpen);
  return () => dialogRegistry.delete(id);
}

export function openDialog(id: string): boolean {
  const setOpen = dialogRegistry.get(id);
  if (setOpen) {
    setOpen(true);
    return true;
  }
  return false;
}

// Button registry - stores click handlers for ControllableButton
const buttonRegistry = new Map<string, () => void>();

export function registerButton(id: string, onClick: () => void) {
  buttonRegistry.set(id, onClick);
  return () => buttonRegistry.delete(id);
}

export function clickButton(id: string): boolean {
  const onClick = buttonRegistry.get(id);
  if (onClick) {
    onClick();
    return true;
  }
  return false;
}

// Generic click handler that tries all registries
export function handleGuideClick(elementId: string): boolean {
  // Try button first (most common)
  if (clickButton(elementId)) {
    console.log("[Guide] Clicked button:", elementId);
    return true;
  }

  // Try dropdown
  if (openDropdown(elementId)) {
    console.log("[Guide] Opened dropdown:", elementId);
    return true;
  }

  // Try link navigation
  if (navigateToLink(elementId)) {
    console.log("[Guide] Navigated to link:", elementId);
    return true;
  }

  // Try dialog
  if (openDialog(elementId)) {
    console.log("[Guide] Opened dialog:", elementId);
    return true;
  }

  return false;
}
