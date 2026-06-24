export const appThemeStorageKey = "yell-for-you:theme";

export const appThemeOptions = [
  { id: "red", label: "赤", color: "#dc2626" },
  { id: "orange", label: "オレンジ", color: "#ea580c" },
  { id: "blue", label: "青", color: "#0071e3" },
  { id: "green", label: "緑", color: "#059669" },
  { id: "pink", label: "ピンク", color: "#db2777" },
  { id: "purple", label: "紫", color: "#7c3aed" },
  { id: "black", label: "黒", color: "#1d1d1f" },
] as const;

export type AppTheme = (typeof appThemeOptions)[number]["id"];

export const defaultAppTheme: AppTheme = "purple";

export function isAppTheme(value: unknown): value is AppTheme {
  return (
    typeof value === "string" &&
    appThemeOptions.some((option) => option.id === value)
  );
}

export function resolveAppTheme(value: string | null | undefined): AppTheme {
  return isAppTheme(value) ? value : defaultAppTheme;
}
