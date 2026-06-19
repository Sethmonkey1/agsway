import type { Metadata } from "next";
import "./globals.css";
import "./monitor-settings.css";
import "./integration-settings.css";
import "./theme.css";

export const metadata: Metadata = {
  title: "Swaya Opportunity Agent",
  description: "Find and respond to high-intent campus partnership conversations.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
