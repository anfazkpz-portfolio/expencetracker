'use client';

import React from 'react';
import { Menu, Plus, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

interface NavbarProps {
  onToggleSidebar?: () => void;
  onOpenEntryModal?: () => void;
}

export function Navbar({ onToggleSidebar, onOpenEntryModal }: NavbarProps) {
  const today = new Intl.DateTimeFormat('en-IN', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date());

  return (
    <header className="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b border-neutral-200/80 bg-white/85 px-3.5 backdrop-blur-md sm:px-6 transition-all">
      <div className="flex items-center gap-2.5">
        <motion.button
          type="button"
          whileTap={{ scale: 0.92 }}
          onClick={onToggleSidebar}
          aria-label="Toggle navigation"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100/80 md:hidden transition-colors"
        >
          <Menu className="h-4 w-4" />
        </motion.button>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-emerald-500 ring-4 ring-emerald-500/10" />
          <span className="text-[11px] font-semibold tracking-wider uppercase text-neutral-500">
            Cash Manager
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        <span className="hidden text-xs font-medium text-neutral-400 sm:inline-block">
          {today}
        </span>

        <motion.button
          type="button"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.96 }}
          onClick={onOpenEntryModal}
          className="flex h-8 items-center gap-1.5 rounded-lg bg-neutral-900 px-3 text-xs font-medium text-white shadow-xs hover:bg-neutral-800 transition-colors"
        >
          <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
          <span>New Entry</span>
        </motion.button>
      </div>
    </header>
  );
}
