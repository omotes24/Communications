import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import {
  appColorModeOptions,
  appColorModeStorageKey,
  appThemeOptions,
  appThemeStorageKey,
  defaultAppColorMode,
  resolveAppTheme,
} from "@/lib/theme";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const appDescription = "Web面接をAIで完全攻略。";

export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_APP_NAME ?? "Yell for You 1.2",
  description: appDescription,
  openGraph: {
    description: appDescription,
  },
  twitter: {
    description: appDescription,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const appTheme = resolveAppTheme(process.env.NEXT_PUBLIC_APP_THEME);
  const allowedThemes = JSON.stringify(
    appThemeOptions.map((option) => option.id),
  );
  const allowedColorModes = JSON.stringify(
    appColorModeOptions.map((option) => option.id),
  );
  const themeBootstrapScript = `
(() => {
  try {
    const storedTheme = window.localStorage.getItem(${JSON.stringify(appThemeStorageKey)});
    if (${allowedThemes}.includes(storedTheme)) {
      document.documentElement.dataset.appTheme = storedTheme;
    }
    const storedColorMode = window.localStorage.getItem(${JSON.stringify(appColorModeStorageKey)});
    if (${allowedColorModes}.includes(storedColorMode)) {
      document.documentElement.dataset.appMode = storedColorMode;
    }
  } catch {}
})();
`;

  return (
    <html
      lang="ja"
      suppressHydrationWarning
      data-app-theme={appTheme}
      data-app-mode={defaultAppColorMode}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
        {children}
      </body>
    </html>
  );
}
