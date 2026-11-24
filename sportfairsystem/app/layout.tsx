import type { Metadata, Viewport } from "next";
import { Lexend_Deca, Plus_Jakarta_Sans } from "next/font/google";
import { EmotionCacheProvider } from "@/src/theme/emotion-cache";
import { ThemeProvider } from "@/src/theme/minimal/theme-provider";
import { AppShell } from "@/src/ui/AppShell";
import { SessionProvider } from "@/src/ui/session";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta-sans",
  subsets: ["latin"],
  display: "swap"
});

const lexendDeca = Lexend_Deca({
  variable: "--font-lexend-deca",
  subsets: ["latin"],
  display: "swap"
});

export const metadata: Metadata = {
  title: "Moonwalkers",
  description: "Fair chances and records for every Moonwalkers player"
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${plusJakartaSans.variable} ${lexendDeca.variable}`}>
        <EmotionCacheProvider>
          <ThemeProvider>
            <SessionProvider>
              <AppShell>{children}</AppShell>
            </SessionProvider>
          </ThemeProvider>
        </EmotionCacheProvider>
      </body>
    </html>
  );
}
