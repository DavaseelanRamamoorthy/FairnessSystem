import type { Metadata } from "next";
import { EmotionCacheProvider } from "@/src/theme/emotion-cache";
import { ThemeProvider } from "@/src/theme/minimal/theme-provider";

export const metadata: Metadata = {
  title: "Moonwalkers",
  description: "Fair chances and records for every Moonwalkers player"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <EmotionCacheProvider>
          <ThemeProvider>{children}</ThemeProvider>
        </EmotionCacheProvider>
      </body>
    </html>
  );
}
