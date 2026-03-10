import "./globals.css";
import { ThemeProvider } from "@/app/themes/minimal/theme-provider";
import { EmotionCacheProvider } from "@/app/themes/minimal/emotion-cache";
import DashboardLayout from "./layout/DashboardLayout";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <EmotionCacheProvider>
          <ThemeProvider>
            <DashboardLayout>
              {children}
            </DashboardLayout>
          </ThemeProvider>
        </EmotionCacheProvider>
      </body>
    </html>
  );
}
