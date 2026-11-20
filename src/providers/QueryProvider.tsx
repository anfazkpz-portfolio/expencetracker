'use client';

import React, { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { clearAllOfflineData } from '@/lib/offline/db';

const PURGE_FLAG = 'cashmanager_seed_exact_nov2026_v2';

let globalQueryClient: QueryClient | null = null;

export function getQueryClient(): QueryClient {
  if (typeof window === 'undefined') {
    return makeQueryClient();
  }
  if (!globalQueryClient) {
    globalQueryClient = makeQueryClient();
  }
  return globalQueryClient;
}

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Fast responsive caching with automatic freshness check on mount
        staleTime: 1000 * 30, // 30 seconds
        gcTime: 1000 * 60 * 60 * 24, // 24 hours
        refetchOnWindowFocus: false,
        refetchOnMount: true,
        refetchOnReconnect: true,
        retry: 2,
      },
    },
  });
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => getQueryClient());

  useEffect(() => {
    // One-time cache purge for client browsers after clearing trial entries
    if (typeof window !== 'undefined') {
      const hasPurged = localStorage.getItem(PURGE_FLAG);
      if (!hasPurged) {
        localStorage.removeItem('cashmanager_milk_subscription');
        clearAllOfflineData().finally(() => {
          queryClient.clear();
          queryClient.invalidateQueries();
          localStorage.setItem(PURGE_FLAG, 'true');
          console.log('[CacheManager] Local browser caches purged to ensure fresh clean DB state.');
        });
      }

      // Expose manual cache reset utility in browser console
      (window as any).clearCashManagerCache = async () => {
        await clearAllOfflineData();
        queryClient.clear();
        queryClient.invalidateQueries();
        console.log('[CacheManager] Manual cache reset complete.');
      };
    }
  }, [queryClient]);

  useEffect(() => {
    // Listen for cross-module mutation signals and invalidate queries selectively
    const handleRefresh = (e: Event) => {
      const customEvent = e as CustomEvent<{ scope?: string }>;
      const scope = customEvent.detail?.scope;

      if (!scope || scope === 'all') {
        queryClient.invalidateQueries();
      } else {
        queryClient.invalidateQueries({ queryKey: [scope] });
      }
    };

    window.addEventListener('cashmanager:refresh', handleRefresh);
    window.addEventListener('cashmanager:data-updated', handleRefresh);
    return () => {
      window.removeEventListener('cashmanager:refresh', handleRefresh);
      window.removeEventListener('cashmanager:data-updated', handleRefresh);
    };
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
