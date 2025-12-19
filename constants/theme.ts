// Theme configuration with light/dark mode support

export const lightColors = {
  // Backgrounds
  background: "#FFFFFF",
  surface: "#F8F8FA",
  surfaceHover: "#F0F0F2",
  elevated: "#FFFFFF",

  // Borders
  border: "#E5E5E8",
  borderSubtle: "#EBEBED",

  // Text
  textPrimary: "#1A1A1A",
  textSecondary: "#6B6B6F",
  textTertiary: "#9B9B9F",

  // Accent colors
  accent: "#5E5CE6",
  accentHover: "#4E4CD6",
  accentSubtle: "rgba(94, 92, 230, 0.1)",

  // Status colors
  success: "#34C759",
  successSubtle: "rgba(52, 199, 89, 0.1)",
  warning: "#FF9500",
  warningSubtle: "rgba(255, 149, 0, 0.1)",
  error: "#FF3B30",
  errorSubtle: "rgba(255, 59, 48, 0.1)",

  // Category colors
  purple: "#AF52DE",
  blue: "#007AFF",
  green: "#34C759",
  orange: "#FF9500",
  pink: "#FF2D55",
  teal: "#5AC8FA",
};

export const darkColors = {
  // Backgrounds
  background: "#0A0A0B",
  surface: "#141415",
  surfaceHover: "#1C1C1E",
  elevated: "#1C1C1E",

  // Borders
  border: "#2A2A2D",
  borderSubtle: "#1F1F22",

  // Text
  textPrimary: "#F5F5F5",
  textSecondary: "#8B8B8E",
  textTertiary: "#5C5C5F",

  // Accent colors
  accent: "#5E5CE6",
  accentHover: "#6E6CE8",
  accentSubtle: "rgba(94, 92, 230, 0.15)",

  // Status colors
  success: "#30D158",
  successSubtle: "rgba(48, 209, 88, 0.15)",
  warning: "#FFD60A",
  warningSubtle: "rgba(255, 214, 10, 0.15)",
  error: "#FF453A",
  errorSubtle: "rgba(255, 69, 58, 0.15)",

  // Category colors
  purple: "#BF5AF2",
  blue: "#64D2FF",
  green: "#30D158",
  orange: "#FF9F0A",
  pink: "#FF375F",
  teal: "#40C8E0",
};

// Default to light theme
export let colors = lightColors;

export const setTheme = (isDark: boolean) => {
  colors = isDark ? darkColors : lightColors;
};

// Typography
export const typography = {
  largeTitle: {
    fontSize: 28,
    fontWeight: "700" as const,
    letterSpacing: -0.5,
  },
  title: {
    fontSize: 20,
    fontWeight: "600" as const,
    letterSpacing: -0.3,
  },
  headline: {
    fontSize: 17,
    fontWeight: "600" as const,
    letterSpacing: -0.2,
  },
  body: {
    fontSize: 15,
    fontWeight: "400" as const,
    letterSpacing: -0.1,
  },
  caption: {
    fontSize: 13,
    fontWeight: "500" as const,
    letterSpacing: 0,
  },
  small: {
    fontSize: 11,
    fontWeight: "500" as const,
    letterSpacing: 0.2,
  },
};

// Spacing
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

// Border radius
export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 9999,
};
