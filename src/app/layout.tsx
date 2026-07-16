import type { Metadata, Viewport } from "next";
import "./globals.css";
import { TaskProjectSync } from "@/features/workspace/components/task-project-sync";
import { AnalyticsProvider } from "./analytics-provider";
import { ServiceWorkerRegistration } from "./service-worker-registration";

export const metadata: Metadata = {
  title: "Dashy",
  description: "A personal workspace for focused work, learning, projects, and life.",
  applicationName: "Dashy",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }]
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Dashy"
  },
  formatDetection: { telephone: false }
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f6f9" },
    { media: "(prefers-color-scheme: dark)", color: "#0f0f14" }
  ],
  // Let the app draw edge-to-edge on notched phones; safe-area insets are
  // handled in CSS (env(safe-area-inset-*)).
  viewportFit: "cover"
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
        <TaskProjectSync />
        <AnalyticsProvider />
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
