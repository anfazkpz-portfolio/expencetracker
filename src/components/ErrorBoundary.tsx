'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Trash2, Home } from 'lucide-react';
import { clearAllOfflineData } from '@/lib/offline/db';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught application error:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleResetCacheAndReload = async () => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.clear();
        sessionStorage.clear();
        await clearAllOfflineData();
        if ('caches' in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
        if ('serviceWorker' in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map((r) => r.unregister()));
        }
      }
    } catch (e) {
      console.warn('Error clearing caches:', e);
    } finally {
      window.location.href = '/';
    }
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-[50vh] w-full flex-col items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600 mb-4 border border-amber-200/60">
              <AlertCircle className="h-6 w-6" />
            </div>

            <h2 className="text-base font-bold text-neutral-900 mb-1.5">
              Something went wrong loading this view
            </h2>
            <p className="text-xs text-neutral-500 mb-4 leading-relaxed">
              An unexpected render issue occurred. Your data in Supabase, MongoDB, and Google Sheets is completely safe.
            </p>

            {this.state.error?.message && (
              <div className="mb-5 max-h-24 overflow-auto rounded-lg bg-neutral-50 p-2.5 text-left font-mono text-[10px] text-neutral-600 border border-neutral-200">
                {this.state.error.message}
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center gap-2 justify-center">
              <button
                type="button"
                onClick={this.handleReload}
                className="flex w-full sm:w-auto items-center justify-center gap-1.5 rounded-lg bg-neutral-900 px-4 py-2 text-xs font-medium text-white hover:bg-neutral-800 transition-colors shadow-xs"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Reload Page</span>
              </button>

              <button
                type="button"
                onClick={this.handleResetCacheAndReload}
                className="flex w-full sm:w-auto items-center justify-center gap-1.5 rounded-lg border border-neutral-200 px-4 py-2 text-xs font-medium text-neutral-600 hover:bg-neutral-50 transition-colors"
                title="Clears local browser cache and reloads freshly"
              >
                <Trash2 className="h-3.5 w-3.5 text-neutral-400" />
                <span>Reset Cache</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
