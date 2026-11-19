'use client';

import React, { useState, useEffect } from 'react';
import {
  Milk,
  Check,
  Ban,
  Loader2,
  RefreshCw,
  CreditCard,
  Plus,
  Sparkles,
  Pause,
  Play,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { setTodayMilkStatus, getTodayDateString } from '@/lib/supabase/api';
import { useDailyMilkLogs, usePendingMilkBill, useMilkSubscription } from '@/lib/queries/hooks';
import { invalidateFinanceQueries } from '@/lib/queries/invalidation';
import { MilkPaymentModal } from '@/components/MilkPaymentModal';
import { formatCurrency } from '@/lib/utils';
import { ScrollReveal } from '@/components/animations/MotionWrapper';

export function DailyMilkQuickAction() {
  const {
    data: allLogs = [],
    isLoading: logsLoading,
    isFetching: logsFetching,
    refetch: refetchLogs,
  } = useDailyMilkLogs(90);

  const {
    data: pendingBillRaw,
    isLoading: pendingLoading,
    isFetching: pendingFetching,
    refetch: refetchPending,
  } = usePendingMilkBill();

  const {
    settings,
    pause,
    resume,
    runBackfill,
    isPausing,
    isResuming,
  } = useMilkSubscription();

  const [mounted, setMounted] = useState(false);
  const [isUpdatingToday, setIsUpdatingToday] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Automatically trigger backfill check on mount to ensure all past days are accounted for
  useEffect(() => {
    setMounted(true);
    runBackfill().catch((err) => {
      console.warn('Auto-backfill initial check warning:', err);
    });
  }, []);

  const isActive = mounted ? settings.status === 'active' : true;

  const isLoading = (logsLoading || pendingLoading) && allLogs.length === 0;
  const isRefreshing = logsFetching || pendingFetching;

  const todayStr = getTodayDateString();
  const todayLog = allLogs.find((l) => l.date === todayStr) || null;

  const pendingBill = pendingBillRaw || {
    count: 0,
    totalAmount: 0,
    totalIncurred: 0,
    totalSettled: 0,
    pendingAmount: 0,
    advanceCredit: 0,
  };

  const hasAdvanceCredit = (pendingBill.advanceCredit ?? 0) > 0;

  const handleRefresh = async () => {
    await Promise.all([runBackfill(), refetchLogs(), refetchPending()]);
  };

  const handleToggleToday = async (newStatus: 'skipped' | 'pending') => {
    setIsUpdatingToday(true);
    try {
      const { data } = await setTodayMilkStatus(newStatus, 14);
      if (data) invalidateFinanceQueries('milk');
    } catch (err) {
      console.error('Error updating today milk:', err);
    } finally {
      setIsUpdatingToday(false);
    }
  };

  const isSkipped = todayLog?.status === 'skipped';

  return (
    <ScrollReveal className="rounded-xl border border-neutral-200/80 bg-white p-3 sm:p-3.5 shadow-xs">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-100 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-sky-50 text-sky-700">
            <Milk className="h-3.5 w-3.5 stroke-[1.8]" />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-neutral-900">
              Daily Milk
            </h3>
            <span className="text-[10px] text-neutral-400">
              ₹14/day
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2" suppressHydrationWarning>
          {isActive ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              AUTO: ON
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full border border-rose-300 bg-rose-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-rose-700">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
              STOPPED
            </span>
          )}

          <motion.button
            type="button"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="text-neutral-400 hover:text-neutral-700 disabled:opacity-40"
            title="Refresh"
          >
            <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
          </motion.button>
        </div>
      </div>

      {/* Running Balance Display + Add Payment Button */}
      <div className="mt-2.5 rounded-lg border border-neutral-100 bg-neutral-50/70 p-2.5 sm:p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {hasAdvanceCredit ? (
            <>
              {/* Advance Credit state */}
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 text-emerald-500" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
                  Advance Credit
                </span>
              </div>
              <div className="mt-0.5 flex items-baseline gap-2">
                <span className="text-xl sm:text-2xl font-bold tracking-tight text-emerald-600">
                  {isLoading ? '...' : formatCurrency(pendingBill.advanceCredit ?? 0)}
                </span>
              </div>
            </>
          ) : (
            <>
              {/* Pending balance state */}
              <div className="flex items-center gap-1.5 text-neutral-500">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                  Net Pending Balance
                </span>
              </div>
              <div className="mt-0.5 flex items-baseline gap-2">
                <span className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900">
                  {isLoading ? '...' : formatCurrency(pendingBill.pendingAmount)}
                </span>
                {pendingBill.count > 0 && (
                  <span className="text-[10px] text-neutral-400">
                    (~{pendingBill.count} days unpaid)
                  </span>
                )}
              </div>
            </>
          )}
        </div>

        {/* Add Milk Payment — always enabled */}
        <div>
          <motion.button
            type="button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setIsModalOpen(true)}
            disabled={isLoading}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-neutral-800 disabled:opacity-40 shadow-2xs"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Milk Payment</span>
          </motion.button>
        </div>
      </div>

      {/* Today's Status & Subscription Control */}
      <div className="mt-2.5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-t border-neutral-100 pt-2.5">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
            Today&apos;s Quota
          </span>

          <div className="mt-1 flex items-center gap-1.5">
            {isLoading ? (
              <span className="text-xs text-neutral-400">Checking...</span>
            ) : isSkipped ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-100 px-2.5 py-0.5 text-[11px] font-medium text-neutral-600">
                <Ban className="h-3 w-3" />
                Skipped today (₹0 added)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800">
                <CreditCard className="h-3 w-3 text-amber-600" />
                Delivered on Credit (+₹14)
              </span>
            )}
          </div>
        </div>

        {/* Action Controls: Stop/Resume Auto-Entry and Skip Today */}
        <div className="flex flex-wrap items-center gap-2" suppressHydrationWarning>
          {/* Prominent Stop / Resume Auto-Entry Toggle Button */}
          {isActive ? (
            <motion.button
              type="button"
              whileTap={{ scale: 0.95 }}
              disabled={isPausing}
              onClick={() => pause()}
              className="inline-flex items-center gap-1.5 rounded-md border border-rose-300 bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100 hover:border-rose-400 transition-colors disabled:opacity-50 shadow-2xs"
              title="Stop auto-entry (Pause ₹14/day logging)"
            >
              {isPausing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Pause className="h-3.5 w-3.5 text-rose-600 fill-rose-600" />
              )}
              <span>Stop Auto-Entry</span>
            </motion.button>
          ) : (
            <motion.button
              type="button"
              whileTap={{ scale: 0.95 }}
              disabled={isResuming}
              onClick={() => resume()}
              className="inline-flex items-center gap-1.5 rounded-md border border-emerald-600 bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700 transition-colors disabled:opacity-50 shadow-2xs"
              title="Resume auto-entry (Start ₹14/day logging)"
            >
              {isResuming ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Play className="h-3.5 w-3.5 text-white fill-white" />
              )}
              <span>Resume Auto-Entry</span>
            </motion.button>
          )}

          {/* Single-day Skip / Undo Skip Today */}
          {isSkipped ? (
            <motion.button
              type="button"
              whileTap={{ scale: 0.95 }}
              disabled={isUpdatingToday}
              onClick={() => handleToggleToday('pending')}
              className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-800 hover:bg-neutral-50 transition-colors disabled:opacity-50 shadow-2xs"
            >
              {isUpdatingToday ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5 text-emerald-600 stroke-[2.5]" />}
              <span>Undo Skip</span>
            </motion.button>
          ) : (
            <motion.button
              type="button"
              whileTap={{ scale: 0.95 }}
              disabled={isUpdatingToday}
              onClick={() => handleToggleToday('skipped')}
              className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 hover:border-neutral-900 hover:bg-neutral-900 hover:text-white transition-colors disabled:opacity-50 shadow-2xs"
            >
              {isUpdatingToday ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5 text-neutral-400 stroke-[2.5]" />}
              <span>Skip Today</span>
            </motion.button>
          )}
        </div>
      </div>

      {/* Running Account Footer: Scaled down, balanced summary numbers */}
      <div className="mt-3 grid grid-cols-3 divide-x divide-neutral-200 border-t border-neutral-200 pt-2.5 text-center">
        <div className="px-2">
          <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400 block">
            Total Incurred
          </span>
          <p className="mt-0.5 text-sm sm:text-base font-semibold text-neutral-900">
            {formatCurrency(pendingBill.totalIncurred)}
          </p>
        </div>
        <div className="px-2">
          <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400 block">
            Total Paid
          </span>
          <p className="mt-0.5 text-sm sm:text-base font-semibold text-emerald-600">
            {formatCurrency(pendingBill.totalSettled)}
          </p>
        </div>
        <div className="px-2">
          {hasAdvanceCredit ? (
            <>
              <span className="text-[11px] font-medium uppercase tracking-wide text-emerald-600/80 block">
                Advance Credit
              </span>
              <p className="mt-0.5 text-sm sm:text-base font-semibold text-emerald-600">
                {formatCurrency(pendingBill.advanceCredit ?? 0)}
              </p>
            </>
          ) : (
            <>
              <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400 block">
                Carry Forward
              </span>
              <p className="mt-0.5 text-sm sm:text-base font-semibold text-neutral-900">
                {formatCurrency(pendingBill.pendingAmount)}
              </p>
            </>
          )}
        </div>
      </div>

      {/* Payment Modal */}
      <MilkPaymentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        pendingAmount={pendingBill.pendingAmount}
        advanceCredit={pendingBill.advanceCredit ?? 0}
        totalIncurred={pendingBill.totalIncurred}
        totalSettled={pendingBill.totalSettled}
        pendingDays={pendingBill.count}
      />
    </ScrollReveal>
  );
}
