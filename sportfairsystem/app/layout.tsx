import "./globals.css";
import { Plus_Jakarta_Sans, Lexend_Deca } from "next/font/google";
import { ThemeProvider } from "@/app/themes/minimal/theme-provider";
import { EmotionCacheProvider } from "@/app/themes/minimal/emotion-cache";
import { AuthProvider } from "@/app/context/AuthContext";
import DashboardLayout from "./layout/DashboardLayout";

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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${plusJakartaSans.variable} ${lexendDeca.variable}`}>
        <EmotionCacheProvider>
          <ThemeProvider>
            <AuthProvider>
              <DashboardLayout>
                {children}
              </DashboardLayout>
            </AuthProvider>
          </ThemeProvider>
        </EmotionCacheProvider>
      </body>
    </html>
  );
}
