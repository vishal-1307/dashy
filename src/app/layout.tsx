import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dashy",
  description: "A personal workspace for focused work, learning, projects, and life.",
  applicationName: "Dashy"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <a className="sr-only focus:not-sr-only" href="#main-content">Skip to content</a>
        {children}
      </body>
    </html>
  );
}
