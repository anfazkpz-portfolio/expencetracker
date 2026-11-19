'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Clock,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  CreditCard,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { getTodayDateString, type DebtWithPaid } from '@/lib/supabase/api';
import { useDebts } from '@/lib/queries/hooks';
import { DebtPaymentModal } from '@/components/DebtPaymentModal';
import { formatCurrency, formatDateDDMMYYYY } from '@/lib/utils';
import { ScrollReveal } from '@/components/animations/MotionWrapper';

export function UpcomingDues() {
  const { data: debts = [], isLoading, refetch } = useDebts(150);
  const [selectedDebtForPayment, setSelectedDebtForPayment] = useState<DebtWithPaid | null>(null);

  const today = getTodayDateString();
  const todayDate = new Date(today);

  // Filter only pending debts (where remaining > 0 or status == pending)
  const pendingDebts = debts.filter((d) => d.status === 'pending');

  // Sort: Overdue first, then approaching due dates, then no due date
  const sortedDues = [...pendingDebts].sort((a, b) => {
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
  });

  const getDueStatus = (dueDateStr: string | null) => {
    if (!dueDateStr) return { text: 'No due date', isOverdue: false, isToday: false };
    const due = new Date(dueDateStr);
    const diffTime = due.getTime() - todayDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return {
        text: `Overdue ${Math.abs(diffDays)}d`,
        isOverdue: true,
        isToday: false,
      };
    } else if (diffDays === 0) {
      return { text: 'Due today', isOverdue: false, isToday: true };
    } else {
      return { text: `Due in ${diffDays}d`, isOverdue: false, isToday: false };
    }
  };

  return (
    <ScrollReveal className="rounded-xl border border-neutral-200/80 bg-white shadow-xs">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-100 px-3.5 py-3 sm:px-4 sm:py-3.5">
        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-neutral-500 stroke-[1.8]" />
          <h2 className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-neutral-600">
            Upcoming Dues
          </h2>
          {pendingDebts.length > 0 && (
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-700">
              {pendingDebts.length}
            </span>
          )}
        </div>

        <Link
          href="/debts"
          className="flex items-center gap-1 text-[11px] sm:text-xs font-medium text-neutral-500 hover:text-neutral-900 transition-colors"
        >
          <span>Manage all</span>
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {/* List */}
      <div className="divide-y divide-neutral-100">
        {isLoading ? (
          <div className="p-5 text-center text-xs text-neutral-400">
            Checking dues...
          </div>
        ) : sortedDues.length === 0 ? (
          <div className="p-5 text-center">
            <CheckCircle2 className="mx-auto h-4 w-4 text-emerald-500 mb-1" />
            <p className="text-xs font-medium text-neutral-700">All dues cleared</p>
          </div>
        ) : (
          sortedDues.slice(0, 4).map((debt) => {
            const dueInfo = getDueStatus(debt.due_date);
            const isLent = debt.type === 'lent';
            const remaining =
              debt.remaining_amount !== undefined
                ? debt.remaining_amount
                : Math.max(0, debt.amount - (debt.paid_amount || 0));

            return (
              <div
                key={debt.id}
                className="flex items-center justify-between px-3.5 py-2.5 sm:px-4 sm:py-3 hover:bg-neutral-50/60 transition-colors"
              >
                <div className="min-w-0 pr-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="truncate text-xs font-semibold text-neutral-900">
                      {debt.person_name}
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.2 text-[9px] sm:text-[10px] font-medium uppercase tracking-wider ${
                        isLent
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-neutral-100 text-neutral-700'
                      }`}
                    >
                      {isLent ? 'To Receive' : 'To Repay'}
                    </span>
                  </div>

                  <div className="mt-0.5 flex items-center gap-1.5 text-[10px] sm:text-[11px]">
                    <span
                      className={`inline-flex items-center gap-0.5 font-medium ${
                        dueInfo.isOverdue
                          ? 'text-rose-600'
                          : dueInfo.isToday
                          ? 'text-amber-600'
                          : 'text-neutral-400'
                      }`}
                    >
                      {dueInfo.isOverdue && <AlertCircle className="h-2.5 w-2.5" />}
                      {dueInfo.text}
                    </span>
                    {debt.due_date && (
                      <span className="text-neutral-300">• {formatDateDDMMYYYY(debt.due_date)}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                  <div className="text-right">
                    <span
                      className={`text-xs font-bold tracking-tight ${
                        isLent ? 'text-emerald-600' : 'text-neutral-900'
                      }`}
                    >
                      {formatCurrency(remaining)}
                    </span>
                    {debt.paid_amount !== undefined && debt.paid_amount > 0 && (
                      <div className="text-[9px] text-neutral-400">
                        Paid {formatCurrency(debt.paid_amount)}
                      </div>
                    )}
                  </div>

                  {/* Make Payment Button */}
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setSelectedDebtForPayment(debt)}
                    className="inline-flex items-center gap-1 rounded-md border border-neutral-900 bg-neutral-900 px-2 py-1 text-[10px] sm:text-[11px] font-medium text-white hover:bg-neutral-800 transition-colors shadow-2xs"
                    title="Record payment"
                  >
                    <CreditCard className="h-3 w-3" />
                    <span>Pay</span>
                  </motion.button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Partial / Full Payment Modal */}
      <DebtPaymentModal
        debt={selectedDebtForPayment}
        isOpen={!!selectedDebtForPayment}
        onClose={() => setSelectedDebtForPayment(null)}
        onSuccess={() => {
          setSelectedDebtForPayment(null);
          refetch();
        }}
      />
    </ScrollReveal>
  );
}
