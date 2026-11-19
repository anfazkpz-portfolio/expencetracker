'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { formatCurrency, formatDateDDMMYYYY, formatDescription } from '@/lib/utils';
import { useTransactions } from '@/lib/queries/hooks';
import { ScrollReveal } from '@/components/animations/MotionWrapper';
import type { Transaction } from '@/types/database';

export function RecentTransactions() {
  const { data: allTransactions = [], isLoading } = useTransactions(250);
  const transactions = allTransactions.slice(0, 6);

  return (
    <ScrollReveal className="rounded-xl border border-neutral-200/80 bg-white shadow-xs">
      <div className="flex items-center justify-between border-b border-neutral-100 px-3.5 py-3 sm:px-4 sm:py-3.5">
        <h2 className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Recent Cash Flow
        </h2>
        <Link
          href="/transactions"
          className="flex items-center gap-1 text-[11px] sm:text-xs font-medium text-neutral-500 hover:text-neutral-900 transition-colors"
        >
          <span>View all</span>
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="divide-y divide-neutral-100">
        {isLoading ? (
          <div className="p-6 text-center text-xs text-neutral-400">
            Loading transactions...
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-xs text-neutral-400">No transactions recorded yet.</p>
            <Link
              href="/transactions"
              className="mt-2 inline-block text-xs font-medium text-neutral-900 underline underline-offset-4"
            >
              Add your first transaction
            </Link>
          </div>
        ) : (
          transactions.map((tx) => {
            const isIncome = tx.type === 'income';
            return (
              <div
                key={tx.id}
                className="flex items-center justify-between px-3.5 py-2.5 sm:px-4 sm:py-3 hover:bg-neutral-50/60 transition-colors"
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

                <div className="text-right shrink-0">
                  <span
                    className={`text-xs font-bold tracking-tight ${
                      isIncome ? 'text-emerald-600' : 'text-neutral-900'
                    }`}
                  >
                    {isIncome ? '+' : '-'} {formatCurrency(Number(tx.amount))}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </ScrollReveal>
  );
}
