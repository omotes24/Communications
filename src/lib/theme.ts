export const appThemeStorageKey = "yell-for-you:theme";
export const appColorModeStorageKey = "yell-for-you:color-mode";

export const appThemeOptions = [
  { id: "blue", label: "水色", swatch: "#1d9bf0" },
  { id: "purple", label: "紫", swatch: "#7c3aed" },
  { id: "red", label: "赤", swatch: "#dc2626" },
  {
    id: "keio",
    label: "慶應カラー",
    swatch:
      "linear-gradient(135deg, #001e62 0 52%, #c63527 52% 78%, #f1c400 78%)",
  },
  { id: "black", label: "黒", swatch: "#1d1d1f" },
] as const;

export type AppTheme = (typeof appThemeOptions)[number]["id"];

export const defaultAppTheme: AppTheme = "blue";

export const appColorModeOptions = [
  { id: "light", label: "ライト" },
  { id: "dark", label: "ダーク" },
] as const;

export type AppColorMode = (typeof appColorModeOptions)[number]["id"];

export const defaultAppColorMode: AppColorMode = "light";

export function isAppTheme(value: unknown): value is AppTheme {
  return (
    typeof value === "string" &&
    appThemeOptions.some((option) => option.id === value)
  );
}

export function resolveAppTheme(value: string | null | undefined): AppTheme {
  return isAppTheme(value) ? value : defaultAppTheme;
}

export function isAppColorMode(value: unknown): value is AppColorMode {
  return (
    typeof value === "string" &&
    appColorModeOptions.some((option) => option.id === value)
  );
}

export function resolveAppColorMode(
  value: string | null | undefined,
): AppColorMode {
  return isAppColorMode(value) ? value : defaultAppColorMode;
}
