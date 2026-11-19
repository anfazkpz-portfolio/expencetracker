'use client';

import React, { useState } from 'react';
import { Plus, Trash2, ArrowLeftRight, Search, ArrowUpRight, ArrowDownRight, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { TransactionForm } from '@/components/TransactionForm';
import { deleteTransaction } from '@/lib/supabase/api';
import { useTransactions } from '@/lib/queries/hooks';
import { invalidateFinanceQueries } from '@/lib/queries/invalidation';
import { formatCurrency, formatDateDDMMYYYY, formatDescription } from '@/lib/utils';
import {
  PageTransition,
  StaggerContainer,
  StaggerItem,
  AnimatedModal,
} from '@/components/animations/MotionWrapper';
import type { Transaction, TransactionType } from '@/types/database';

export default function TransactionsPage() {
  const { data: transactions = [], isLoading } = useTransactions(250);
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [filterType, setFilterType] = useState<'all' | TransactionType>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const handleDelete = async (id: string) => {
    if (confirm('Delete this transaction?')) {
      const ok = await deleteTransaction(id);
      if (ok) {
        invalidateFinanceQueries('transactions');
      }
    }
  };

  const filtered = transactions.filter((t) => {
    if (filterType !== 'all' && t.type !== filterType) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchCat = t.category.toLowerCase().includes(q);
      const matchDesc = t.description?.toLowerCase().includes(q);
      if (!matchCat && !matchDesc) return false;
    }
    return true;
  });

  return (
    <PageTransition className="space-y-4 sm:space-y-5">
      {/* Header and Add Button */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-sm font-semibold tracking-tight text-neutral-900 sm:text-base">
            Transactions History
          </h1>
        </div>

        <motion.button
          type="button"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => setShowAddForm(true)}
          className="inline-flex items-center gap-1.5 self-start rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-neutral-800 shadow-xs"
        >
          <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
          <span>New Transaction</span>
        </motion.button>
      </div>

      {/* Pop-up Modal */}
      <AnimatedModal
        isOpen={showAddForm}
        onClose={() => setShowAddForm(false)}
        maxWidth="max-w-lg"
      >
        <div className="flex items-center justify-between border-b border-neutral-100 pb-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-100 text-neutral-800">
              <ArrowLeftRight className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-neutral-900">
                New Transaction
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowAddForm(false)}
            className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <TransactionForm
          onSuccess={() => {
            setShowAddForm(false);
            invalidateFinanceQueries('transactions');
          }}
          onCancel={() => setShowAddForm(false)}
        />
      </AnimatedModal>

      {/* Filters & Search */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1 rounded-xl border border-neutral-200/80 bg-neutral-100/80 p-1">
          {(['all', 'expense', 'income'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setFilterType(t)}
              className={`rounded-lg px-3 py-1 text-xs font-medium capitalize transition-all ${
                filterType === t
                  ? 'bg-white text-neutral-900 shadow-2xs font-semibold'
                  : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="relative flex items-center max-w-xs w-full">
          <Search className="absolute left-2.5 h-3.5 w-3.5 text-neutral-400" />
          <input
            type="text"
            placeholder="Search category or note..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-neutral-200 bg-white py-1.5 pl-8 pr-3 text-xs text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-hidden transition-colors"
          />
        </div>
      </div>

      {/* Transactions List */}
      <div className="rounded-xl border border-neutral-200/80 bg-white shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-neutral-400">
            Loading transactions...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-xs text-neutral-400">
              {transactions.length === 0
                ? 'No transactions yet. Click "+ New Transaction" to create one.'
                : 'No matching transactions found.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {filtered.map((tx) => {
              const isIncome = tx.type === 'income';
              return (
                <div
                  key={tx.id}
                  className="group flex items-center justify-between px-3.5 py-2.5 sm:px-4 sm:py-3 hover:bg-neutral-50/60 transition-colors"
                >
                  <div className="min-w-0 pr-3 flex items-center gap-2.5">
                    <div
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                        isIncome ? 'bg-emerald-50 text-emerald-600' : 'bg-neutral-100 text-neutral-700'
                      }`}
                    >
                      {isIncome ? (
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowDownRight className="h-3.5 w-3.5" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="truncate text-xs font-semibold text-neutral-900">
                          {tx.category}
                        </span>
                        {tx.description && (
                          <span className="hidden text-[10px] text-neutral-400 sm:inline truncate max-w-xs">
                            • {formatDescription(tx.description)}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-neutral-400">{formatDateDDMMYYYY(tx.date)}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <span
                      className={`text-xs font-bold tracking-tight ${
                        isIncome ? 'text-emerald-600' : 'text-neutral-900'
                      }`}
                    >
                      {isIncome ? '+' : '-'} {formatCurrency(Number(tx.amount))}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleDelete(tx.id)}
                      className="opacity-70 sm:opacity-0 sm:group-hover:opacity-100 p-1 text-neutral-400 hover:text-rose-600 transition-opacity"
                      title="Delete entry"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </PageTransition>
  );
}
