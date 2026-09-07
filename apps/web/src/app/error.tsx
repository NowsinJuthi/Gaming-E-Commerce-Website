"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="grid min-h-[60vh] place-items-center bg-surface px-6 text-center">
      <div className="max-w-md">
        <h1 className="text-2xl font-bold text-foreground">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm text-foreground-muted">
          An unexpected error occurred. You can try again, and if the problem
          persists please contact support.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button type="button" onClick={reset} className="panel-3d-btn">
            Try again
          </button>
          <Link href="/" className="panel-3d-btn-ghost">
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
