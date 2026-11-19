'use client';

import React, { useEffect, useState } from 'react';
import { WifiOff, RefreshCw, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { syncPendingOutbox, isDeviceOnline, SyncStatus } from '@/lib/offline/syncEngine';

export function PWAProvider() {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showSyncedToast, setShowSyncedToast] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    setIsOnline(isDeviceOnline());

    // 1. Service Worker for PWA offline capabilities
    if ('serviceWorker' in navigator) {
      const isLocalHost =
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.port !== '' ||
        window.location.hostname.startsWith('192.168.') ||
        window.location.hostname.startsWith('10.');

      if (process.env.NODE_ENV === 'production' && !isLocalHost) {
        navigator.serviceWorker
          .register('/sw.js')
          .then((reg) => {
            console.log('PWA Service Worker registered with scope:', reg.scope);
          })
          .catch((err) => {
            console.warn('Service Worker registration failed:', err);
          });
      } else {
        // In local development or testing, unregister ANY active service worker immediately
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (const registration of registrations) {
            registration.unregister();
            console.log('[PWAProvider] Unregistered dev/stale Service Worker:', registration.scope);
          }
        });
        if ('caches' in window) {
          caches.keys().then((keys) => {
            for (const key of keys) {
              if (key.startsWith('cashmanager-')) {
                caches.delete(key);
              }
            }
          });
        }
      }
    }

    // 2. Listen to browser online/offline events
    const handleOnline = () => {
      setIsOnline(true);
      syncPendingOutbox().then(({ synced }) => {
        if (synced > 0) {
          setShowSyncedToast(true);
          setTimeout(() => setShowSyncedToast(false), 3000);
        }
      });
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // 3. Listen to internal sync status events
    const handleSyncStatus = (event: any) => {
      const status: SyncStatus = event.detail;
      setIsOnline(status.isOnline);
      setPendingCount(status.pendingCount);
      setIsSyncing(status.isSyncing);

      if (status.pendingCount === 0 && !status.isSyncing && pendingCount > 0) {
        setShowSyncedToast(true);
        setTimeout(() => setShowSyncedToast(false), 2500);
      }
    };

    window.addEventListener('cashmanager:sync-status', handleSyncStatus);

    // Initial check on mount
    syncPendingOutbox();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('cashmanager:sync-status', handleSyncStatus);
    };
  }, [pendingCount]);

  return (
    <div className="pointer-events-none fixed top-3 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center">
      <AnimatePresence>
        {!isOnline && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="pointer-events-auto flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50/95 px-3 py-1 shadow-sm backdrop-blur-md"
          >
            <WifiOff className="h-3.5 w-3.5 text-amber-600 animate-pulse" />
            <span className="text-[11px] font-medium text-amber-800">
              Offline Mode • Saved locally {pendingCount > 0 ? `(${pendingCount} pending sync)` : ''}
            </span>
          </motion.div>
        )}

        {isOnline && isSyncing && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="pointer-events-auto flex items-center gap-2 rounded-full border border-neutral-200 bg-white/95 px-3 py-1 shadow-sm backdrop-blur-md"
          >
            <RefreshCw className="h-3.5 w-3.5 text-neutral-600 animate-spin" />
            <span className="text-[11px] font-medium text-neutral-700">
              Syncing offline changes with database...
            </span>
          </motion.div>
        )}

        {isOnline && !isSyncing && showSyncedToast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50/95 px-3 py-1 shadow-sm backdrop-blur-md"
          >
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            <span className="text-[11px] font-medium text-emerald-800">
              All changes synced to database
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
