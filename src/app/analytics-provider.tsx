"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "@/server/auth-client";
import { identifyUser, initAnalytics, trackPageview } from "@/shared/lib/analytics";

export function AnalyticsProvider() {
  const pathname = usePathname();
  const { data: session } = useSession();

  useEffect(() => {
    initAnalytics();
  }, []);

  useEffect(() => {
    if (pathname) trackPageview(pathname);
  }, [pathname]);

  useEffect(() => {
    // Identify by opaque user id only — no email or name in analytics.
    if (session?.user?.id) identifyUser(session.user.id);
  }, [session?.user?.id]);

  return null;
}
