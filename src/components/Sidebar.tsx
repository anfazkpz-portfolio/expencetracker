'use client';

import React, { useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  ArrowLeftRight,
  HandCoins,
  Bike,
  Milk,
  BarChart3,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Transactions', href: '/transactions', icon: ArrowLeftRight },
  { name: 'Debts & Loans', href: '/debts', icon: HandCoins },
  { name: 'Swiggy Income', href: '/swiggy', icon: Bike },
  { name: 'Daily Milk', href: '/milk', icon: Milk },
  { name: 'Reports', href: '/reports', icon: BarChart3 },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router   = useRouter();

  /**
   * Offline-safe navigation: when offline, intercept the Link default
   * and use router.push() so the SW cache serves the RSC payload.
   */
  const handleNavClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        e.preventDefault();
        router.push(href);
      }
      onClose?.();
    },
    [router, onClose]
  );

  return (
    <>
      {/* Mobile Drawer with AnimatePresence */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm"
              onClick={onClose}
            />

            {/* Mobile Drawer Content */}
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="relative flex h-full w-64 flex-col border-r border-neutral-200 bg-white shadow-2xl"
            >
              <div className="flex h-14 items-center justify-between border-b border-neutral-100 px-5">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-900">
                  Cash Manager
                </span>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <nav className="flex-1 space-y-1 px-3 py-4">
                {navigation.map((item) => {
                  const isActive = pathname === item.href;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      prefetch={true}
                      onClick={(e) => handleNavClick(e, item.href)}
                      className={cn(
                        'flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-xs font-medium transition-all',
                        isActive
                          ? 'bg-neutral-900 text-white font-semibold shadow-xs'
                          : 'text-neutral-500 hover:bg-neutral-100/70 hover:text-neutral-900'
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0 stroke-[1.8]" />
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
              </nav>

              <div className="border-t border-neutral-100 p-4">
                <div className="flex items-center justify-between text-[11px] text-neutral-400">
                  <span>Supabase Live</span>
                  <span className="h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20" />
                </div>
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar (Permanent) */}
      <aside className="hidden md:flex w-56 flex-col border-r border-neutral-200/80 bg-white">
        {/* Brand header */}
        <div className="flex h-14 items-center border-b border-neutral-100 px-5">
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-900">
            Cash Manager
          </span>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                prefetch={true}
                onClick={(e) => handleNavClick(e, item.href)}
                className={cn(
                  'group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-all',
                  isActive
                    ? 'bg-neutral-900 text-white font-semibold shadow-xs'
                    : 'text-neutral-500 hover:bg-neutral-100/70 hover:text-neutral-900'
                )}
              >
                <Icon className="h-4 w-4 shrink-0 stroke-[1.8]" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Minimalist footer status */}
        <div className="border-t border-neutral-100 p-4">
          <div className="flex items-center justify-between text-[11px] text-neutral-400">
            <span>Database Sync</span>
            <span className="h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20" />
          </div>
        </div>
      </aside>
    </>
  );
}
