'use client';

import React, { useEffect } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Root Error Boundary]', error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] w-full flex-col items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600 mb-4 border border-amber-200/60">
          <AlertCircle className="h-6 w-6" />
        </div>

        <h2 className="text-base font-bold text-neutral-900 mb-1.5">
          Temporary Loading Error
        </h2>
        <p className="text-xs text-neutral-500 mb-4 leading-relaxed">
          The application encountered an issue while loading. Click below to try again.
        </p>

        {error?.message && (
          <div className="mb-5 max-h-24 overflow-auto rounded-lg bg-neutral-50 p-2.5 text-left font-mono text-[10px] text-neutral-600 border border-neutral-200">
            {error.message}
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center gap-2 justify-center">
          <button
            type="button"
            onClick={() => reset()}
            className="flex w-full sm:w-auto items-center justify-center gap-1.5 rounded-lg bg-neutral-900 px-4 py-2 text-xs font-medium text-white hover:bg-neutral-800 transition-colors shadow-xs"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Try Again</span>
          </button>

          <Link
            href="/"
            className="flex w-full sm:w-auto items-center justify-center gap-1.5 rounded-lg border border-neutral-200 px-4 py-2 text-xs font-medium text-neutral-600 hover:bg-neutral-50 transition-colors"
          >
            <Home className="h-3.5 w-3.5 text-neutral-400" />
            <span>Go Home</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
