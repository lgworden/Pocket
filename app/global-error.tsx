"use client";

// App Router root-level errors bypass regular error.tsx boundaries, so Sentry
// needs this separate global-error boundary to capture them.
import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        <div style={{ padding: 24, fontFamily: "sans-serif" }}>
          <h1>Something went wrong</h1>
          <p>Try reloading the page.</p>
        </div>
      </body>
    </html>
  );
}
