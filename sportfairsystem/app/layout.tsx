import "./globals.css";

import ThemeRegistry from "./theme/ThemeRegistry";
import DashboardLayout from "./layout/DashboardLayout";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>

        <ThemeRegistry>

          <DashboardLayout>
            {children}
          </DashboardLayout>

        </ThemeRegistry>

      </body>
    </html>
  );
}