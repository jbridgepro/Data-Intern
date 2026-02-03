export type ThemeAccentPreset =
  | "default"
  | "blue"
  | "emerald"
  | "amber"
  | "rose"
  | "violet"
  | "cyan";

export type ThemeSurfacePreset = "default" | "warm" | "cool" | "graphite";

export type FontFamilyPreset =
  | "system"
  | "plex"
  | "grotesk"
  | "serif"
  | "mono";

export type FontScalePreset = "90" | "100" | "110" | "120";

export interface ThemePreferences {
  accentPreset: ThemeAccentPreset;
  surfacePreset: ThemeSurfacePreset;
  fontFamily: FontFamilyPreset;
  fontScale: FontScalePreset;
  useCustomColors: boolean;
  customAccent: string;
  customBackground: string;
}

export const ACCENT_PRESETS: Array<{
  id: ThemeAccentPreset;
  name: string;
  color: string;
}> = [
  { id: "default", name: "Slate", color: "#0f172a" },
  { id: "blue", name: "Blue", color: "#3b82f6" },
  { id: "emerald", name: "Emerald", color: "#10b981" },
  { id: "amber", name: "Amber", color: "#f59e0b" },
  { id: "rose", name: "Rose", color: "#f43f5e" },
  { id: "violet", name: "Violet", color: "#8b5cf6" },
  { id: "cyan", name: "Cyan", color: "#06b6d4" },
];

export const SURFACE_PRESETS: Array<{
  id: ThemeSurfacePreset;
  name: string;
  description: string;
}> = [
  { id: "default", name: "Default", description: "Neutral slate surface" },
  { id: "warm", name: "Warm", description: "Soft, cozy neutrals" },
  { id: "cool", name: "Cool", description: "Crisp, airy neutrals" },
  { id: "graphite", name: "Graphite", description: "High-contrast muted" },
];

export const FONT_FAMILY_PRESETS: Array<{
  id: FontFamilyPreset;
  name: string;
  description: string;
}> = [
  { id: "system", name: "System", description: "Default system font" },
  { id: "plex", name: "IBM Plex", description: "Technical, editorial" },
  { id: "grotesk", name: "Space Grotesk", description: "Modern, geometric" },
  { id: "serif", name: "Source Serif", description: "Readable, classic" },
  { id: "mono", name: "JetBrains Mono", description: "Monospace style" },
];

export const FONT_SCALE_PRESETS: Array<{
  id: FontScalePreset;
  name: string;
  description: string;
}> = [
  { id: "90", name: "Small", description: "90%" },
  { id: "100", name: "Default", description: "100%" },
  { id: "110", name: "Large", description: "110%" },
  { id: "120", name: "XL", description: "120%" },
];

export const DEFAULT_THEME_PREFERENCES: ThemePreferences = {
  accentPreset: "default",
  surfacePreset: "default",
  fontFamily: "system",
  fontScale: "100",
  useCustomColors: false,
  customAccent: "#3b82f6",
  customBackground: "#f8fafc",
};

const STORAGE_KEYS = {
  accentPreset: "theme-accent-preset",
  surfacePreset: "theme-surface-preset",
  fontFamily: "theme-font-family",
  fontScale: "theme-font-scale",
  useCustomColors: "theme-use-custom-colors",
  customAccent: "theme-custom-accent",
  customBackground: "theme-custom-background",
};

const replaceClassByPrefix = (
  root: HTMLElement,
  prefix: string,
  nextClass: string,
) => {
  Array.from(root.classList).forEach((className) => {
    if (className.startsWith(prefix)) {
      root.classList.remove(className);
    }
  });
  if (nextClass) {
    root.classList.add(nextClass);
  }
};

const normalizeHex = (hex: string) => {
  const cleaned = hex.trim().replace("#", "");
  if (cleaned.length === 3) {
    return `#${cleaned
      .split("")
      .map((c) => c + c)
      .join("")}`;
  }
  if (cleaned.length === 6) {
    return `#${cleaned}`;
  }
  return "#000000";
};

const hexToRgb = (hex: string) => {
  const normalized = normalizeHex(hex);
  const value = normalized.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return { r, g, b };
};

const rgbToHex = (r: number, g: number, b: number) => {
  const toHex = (value: number) =>
    Math.max(0, Math.min(255, Math.round(value)))
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const mixColors = (base: string, mix: string, amount: number) => {
  const baseRgb = hexToRgb(base);
  const mixRgb = hexToRgb(mix);
  const clamped = Math.max(0, Math.min(1, amount));
  return rgbToHex(
    baseRgb.r + (mixRgb.r - baseRgb.r) * clamped,
    baseRgb.g + (mixRgb.g - baseRgb.g) * clamped,
    baseRgb.b + (mixRgb.b - baseRgb.b) * clamped,
  );
};

const getLuminance = (hex: string) => {
  const { r, g, b } = hexToRgb(hex);
  const [rs, gs, bs] = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
};

const getReadableTextColor = (hex: string) => {
  return getLuminance(hex) > 0.5 ? "#0f172a" : "#f8fafc";
};

export const loadThemePreferences = (): ThemePreferences => {
  if (typeof window === "undefined") return DEFAULT_THEME_PREFERENCES;
  return {
    accentPreset:
      (localStorage.getItem(STORAGE_KEYS.accentPreset) as ThemeAccentPreset) ??
      DEFAULT_THEME_PREFERENCES.accentPreset,
    surfacePreset:
      (localStorage.getItem(STORAGE_KEYS.surfacePreset) as ThemeSurfacePreset) ??
      DEFAULT_THEME_PREFERENCES.surfacePreset,
    fontFamily:
      (localStorage.getItem(STORAGE_KEYS.fontFamily) as FontFamilyPreset) ??
      DEFAULT_THEME_PREFERENCES.fontFamily,
    fontScale:
      (localStorage.getItem(STORAGE_KEYS.fontScale) as FontScalePreset) ??
      DEFAULT_THEME_PREFERENCES.fontScale,
    useCustomColors:
      localStorage.getItem(STORAGE_KEYS.useCustomColors) === "true" ||
      DEFAULT_THEME_PREFERENCES.useCustomColors,
    customAccent:
      localStorage.getItem(STORAGE_KEYS.customAccent) ??
      DEFAULT_THEME_PREFERENCES.customAccent,
    customBackground:
      localStorage.getItem(STORAGE_KEYS.customBackground) ??
      DEFAULT_THEME_PREFERENCES.customBackground,
  };
};

export const saveThemePreferences = (preferences: ThemePreferences) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEYS.accentPreset, preferences.accentPreset);
  localStorage.setItem(STORAGE_KEYS.surfacePreset, preferences.surfacePreset);
  localStorage.setItem(STORAGE_KEYS.fontFamily, preferences.fontFamily);
  localStorage.setItem(STORAGE_KEYS.fontScale, preferences.fontScale);
  localStorage.setItem(
    STORAGE_KEYS.useCustomColors,
    preferences.useCustomColors.toString(),
  );
  localStorage.setItem(STORAGE_KEYS.customAccent, preferences.customAccent);
  localStorage.setItem(
    STORAGE_KEYS.customBackground,
    preferences.customBackground,
  );
};

export const applyThemePreferences = (preferences: ThemePreferences) => {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  replaceClassByPrefix(root, "theme-accent-", "");
  if (preferences.accentPreset !== "default") {
    root.classList.add(`theme-accent-${preferences.accentPreset}`);
  }
  replaceClassByPrefix(root, "theme-surface-", "");
  if (preferences.surfacePreset !== "default") {
    root.classList.add(`theme-surface-${preferences.surfacePreset}`);
  }
  replaceClassByPrefix(root, "font-theme-", `font-theme-${preferences.fontFamily}`);
  replaceClassByPrefix(root, "font-scale-", `font-scale-${preferences.fontScale}`);

  if (!preferences.useCustomColors) {
    root.classList.remove("theme-custom-colors");
    root.style.removeProperty("--custom-accent");
    root.style.removeProperty("--custom-accent-foreground");
    root.style.removeProperty("--custom-background");
    root.style.removeProperty("--custom-foreground");
    root.style.removeProperty("--custom-card");
    root.style.removeProperty("--custom-popover");
    root.style.removeProperty("--custom-secondary");
    root.style.removeProperty("--custom-muted");
    root.style.removeProperty("--custom-muted-foreground");
    root.style.removeProperty("--custom-border");
    root.style.removeProperty("--custom-input");
    root.style.removeProperty("--custom-sidebar");
    root.style.removeProperty("--custom-ring");
    return;
  }

  const accent = normalizeHex(preferences.customAccent);
  const background = normalizeHex(preferences.customBackground);
  const foreground = getReadableTextColor(background);
  const accentForeground = getReadableTextColor(accent);

  const isDark = getLuminance(background) < 0.5;
  const shadeTarget = isDark ? "#ffffff" : "#000000";
  const card = mixColors(background, shadeTarget, isDark ? 0.08 : 0.04);
  const popover = mixColors(background, shadeTarget, isDark ? 0.12 : 0.06);
  const secondary = mixColors(background, shadeTarget, isDark ? 0.16 : 0.08);
  const muted = mixColors(background, shadeTarget, isDark ? 0.18 : 0.1);
  const mutedForeground = mixColors(foreground, background, 0.35);
  const border = mixColors(background, shadeTarget, isDark ? 0.24 : 0.16);
  const input = mixColors(background, shadeTarget, isDark ? 0.2 : 0.12);
  const sidebar = mixColors(background, shadeTarget, isDark ? 0.04 : 0.02);
  const ring = mixColors(accent, accentForeground, 0.2);

  root.classList.add("theme-custom-colors");
  root.style.setProperty("--custom-accent", accent);
  root.style.setProperty("--custom-accent-foreground", accentForeground);
  root.style.setProperty("--custom-background", background);
  root.style.setProperty("--custom-foreground", foreground);
  root.style.setProperty("--custom-card", card);
  root.style.setProperty("--custom-popover", popover);
  root.style.setProperty("--custom-secondary", secondary);
  root.style.setProperty("--custom-muted", muted);
  root.style.setProperty("--custom-muted-foreground", mutedForeground);
  root.style.setProperty("--custom-border", border);
  root.style.setProperty("--custom-input", input);
  root.style.setProperty("--custom-sidebar", sidebar);
  root.style.setProperty("--custom-ring", ring);
};
