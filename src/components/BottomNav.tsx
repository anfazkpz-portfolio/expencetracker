'use client';

import React, { useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  ArrowLeftRight,
  HandCoins,
  BarChart3,
  Plus,
} from 'lucide-react';
import { motion } from 'framer-motion';

interface BottomNavProps {
  onOpenEntryModal: () => void;
}

const navItems = [
  { name: 'Dashboard',  href: '/',             icon: LayoutDashboard },
  { name: 'Activity',   href: '/transactions', icon: ArrowLeftRight  },
  { name: 'Debts',      href: '/debts',        icon: HandCoins       },
  { name: 'Reports',    href: '/reports',      icon: BarChart3       },
];

export function BottomNav({ onOpenEntryModal }: BottomNavProps) {
  const pathname = usePathname();
  const router   = useRouter();

  /**
   * Offline-safe navigation handler.
   * When offline, Next.js RSC fetch will fail — we intercept that rejection
   * and fall back to router.push() which uses the client bundle + SW cache
   * instead of making a network round-trip for the RSC payload.
   */
  const handleNavClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        e.preventDefault();
        // Suppress any unhandled RSC-fetch rejections that might bubble up
        const originalOnError = window.onerror;
        window.onerror = (...args) => {
          if (String(args[4])?.includes('RSC') || String(args[0])?.includes('fetch')) {
            return true; // suppressed
          }
          return originalOnError?.(...args) ?? false;
        };
        const cleanup = setTimeout(() => { window.onerror = originalOnError; }, 3000);

        router.push(href);
      }
    },
    [router]
  );

  const renderNavLink = (item: (typeof navItems)[number]) => {
    const isActive = pathname === item.href;
    const Icon = item.icon;
    return (
      <Link
        key={item.name}
        href={item.href}
        prefetch={true}
        onClick={(e) => handleNavClick(e, item.href)}
        className="relative flex flex-col items-center justify-center flex-1 py-1 text-center"
      >
        <div
          className={`relative flex items-center justify-center rounded-full p-1.5 transition-colors ${
            isActive ? 'text-neutral-950 font-semibold' : 'text-neutral-400 hover:text-neutral-700'
          }`}
        >
          <Icon className="h-5 w-5 stroke-[1.8]" />
          {isActive && (
            <motion.div
              layoutId="activeTabIndicator"
              className="absolute inset-0 rounded-full bg-neutral-100 -z-10"
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            />
          )}
        </div>
        <span
          className={`text-[10px] tracking-tight ${
            isActive ? 'font-semibold text-neutral-900' : 'text-neutral-400 font-medium'
          }`}
        >
          {item.name}
        </span>
      </Link>
    );
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 block md:hidden border-t border-neutral-200/80 bg-white/90 backdrop-blur-md pb-safe">
      <div className="flex h-16 items-center justify-around px-2">
        {/* First 2 items */}
        {navItems.slice(0, 2).map(renderNavLink)}

        {/* Center Quick Entry Action Button */}
        <div className="flex flex-col items-center justify-center px-1">
          <motion.button
            type="button"
            whileTap={{ scale: 0.92 }}
            whileHover={{ scale: 1.05 }}
            onClick={onOpenEntryModal}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-neutral-900 text-white shadow-md shadow-neutral-900/20 transition-transform -mt-3"
            aria-label="New Entry"
          >
            <Plus className="h-5 w-5 stroke-[2.5]" />
          </motion.button>
          <span className="text-[10px] font-semibold text-neutral-800 tracking-tight mt-0.5">
            Entry
          </span>
        </div>

        {/* Last 2 items */}
        {navItems.slice(2, 4).map(renderNavLink)}
      </div>
    </nav>
  );
}
