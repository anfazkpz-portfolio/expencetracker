'use client';

import React, { useState } from 'react';
import { X, ArrowLeftRight, Bike, HandCoins } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { TransactionForm } from './TransactionForm';
import { SwiggyIncomeForm } from './SwiggyIncomeForm';
import { DebtForm } from './DebtForm';
import { AnimatedModal } from '@/components/animations/MotionWrapper';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEntryAdded?: () => void;
  initialTab?: 'transaction' | 'swiggy' | 'debt';
}

export function TransactionModal({
  isOpen,
  onClose,
  onEntryAdded,
  initialTab = 'transaction',
}: TransactionModalProps) {
  const [activeTab, setActiveTab] = useState<'transaction' | 'swiggy' | 'debt'>(
    initialTab
  );

  return (
    <AnimatedModal isOpen={isOpen} onClose={onClose} maxWidth="max-w-lg">
      {/* Header & Tabs */}
      <div className="flex items-center justify-between border-b border-neutral-100 pb-3 gap-2">
        <div className="flex gap-1 bg-neutral-100 p-0.5 rounded-lg flex-wrap sm:flex-nowrap">
          <button
            type="button"
            onClick={() => setActiveTab('transaction')}
            className={`relative flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              activeTab === 'transaction'
                ? 'bg-white text-neutral-900 shadow-2xs font-semibold'
                : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            <ArrowLeftRight className="h-3 w-3" />
            <span>Cash Flow</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('swiggy')}
            className={`relative flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              activeTab === 'swiggy'
                ? 'bg-white text-neutral-900 shadow-2xs font-semibold'
                : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            <Bike className="h-3 w-3" />
            <span>Swiggy</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('debt')}
            className={`relative flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              activeTab === 'debt'
                ? 'bg-white text-neutral-900 shadow-2xs font-semibold'
                : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            <HandCoins className="h-3 w-3" />
            <span>Debt</span>
          </button>
        </div>

        <motion.button
          type="button"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={onClose}
          className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 transition-colors"
        >
          <X className="h-4 w-4" />
        </motion.button>
      </div>

      {/* Tab Content with subtle fade */}
      <div className="mt-4">
        {activeTab === 'transaction' && (
          <TransactionForm
            onSuccess={() => {
              onEntryAdded?.();
              onClose();
            }}
            onCancel={onClose}
          />
        )}

        {activeTab === 'swiggy' && (
          <SwiggyIncomeForm
            onSuccess={() => {
              onEntryAdded?.();
              onClose();
            }}
            onCancel={onClose}
          />
        )}

        {activeTab === 'debt' && (
          <DebtForm
            onSuccess={() => {
              onEntryAdded?.();
              onClose();
            }}
            onCancel={onClose}
          />
        )}
      </div>
    </AnimatedModal>
  );
}
