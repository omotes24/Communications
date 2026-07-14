import type { Metadata } from "next";

import {
  appColorModeOptions,
  appColorModeStorageKey,
  appThemeStorageKey,
  defaultAppColorMode,
} from "@/lib/theme";
import "./globals.css";

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
  const allowedColorModes = JSON.stringify(
    appColorModeOptions.map((option) => option.id),
  );
  const themeBootstrapScript = `
(() => {
  try {
    document.documentElement.dataset.appTheme = "blue";
    window.localStorage.setItem(${JSON.stringify(appThemeStorageKey)}, "blue");
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
      data-app-theme="blue"
      data-app-mode={defaultAppColorMode}
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
        {children}
      </body>
    </html>
  );
}
