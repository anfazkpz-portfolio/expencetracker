'use client';

import React, { useState } from 'react';
import {
  Milk,
  Ban,
  Clock,
  Calendar,
  CheckCheck,
  Sparkles,
  Receipt,
  ArrowDownRight,
  TrendingDown,
  RotateCcw,
  Loader2,
} from 'lucide-react';
import { DailyMilkQuickAction } from '@/components/DailyMilkQuickAction';
import {
  useDailyMilkLogs,
  usePendingMilkBill,
  useMilkPayments,
} from '@/lib/queries/hooks';
import { toggleMilkDateStatus } from '@/lib/milk/milkSubscription';
import { formatCurrency, formatDateDDMMYYYY } from '@/lib/utils';
import {
  PageTransition,
  StaggerContainer,
  StaggerItem,
  CardMotion,
  ScrollReveal,
} from '@/components/animations/MotionWrapper';

export default function MilkLogsPage() {
  const { data: logs = [], isLoading: logsLoading } = useDailyMilkLogs(1000);
  const { data: pendingBillRaw, isLoading: pendingLoading } = usePendingMilkBill();
  const { data: payments = [], isLoading: paymentsLoading } = useMilkPayments();

  const [togglingDate, setTogglingDate] = useState<string | null>(null);

  const handleToggleSpecificDate = async (dateStr: string, forceStatus?: 'pending' | 'skipped') => {
    setTogglingDate(dateStr);
    try {
      await toggleMilkDateStatus(dateStr, forceStatus);
    } catch (err) {
      console.error('Failed to toggle milk date status:', err);
    } finally {
      setTogglingDate(null);
    }
  };

  const isLoading = (logsLoading || pendingLoading) && logs.length === 0;

  const pendingBill = pendingBillRaw || {
    count: 0,
    totalAmount: 0,
    totalIncurred: 0,
    totalSettled: 0,
    pendingAmount: 0,
    advanceCredit: 0,
  };

  const hasAdvanceCredit = (pendingBill.advanceCredit ?? 0) > 0;

  const totalSkipped = logs.filter((l) => l.status === 'skipped').length;
  const totalDelivered = logs.filter((l) => l.status !== 'skipped').length;

  return (
    <PageTransition className="space-y-4 sm:space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-sm font-semibold tracking-tight text-neutral-900 sm:text-base">
          Daily Milk
        </h1>
      </div>

      {/* Quick Action Widget */}
      <DailyMilkQuickAction />

      {/* 4 Stat Cards */}
      <StaggerContainer className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        {/* Net Pending or Advance Credit */}
        <StaggerItem>
          <CardMotion
            className={`rounded-xl border p-3.5 sm:p-4 shadow-xs ${
              hasAdvanceCredit
                ? 'border-emerald-200/80 bg-emerald-50/60'
                : 'border-amber-200/60 bg-amber-50/40'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                {hasAdvanceCredit ? 'Advance Credit' : 'Net Pending'}
              </span>
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-md ${
                  hasAdvanceCredit ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
                }`}
              >
                {hasAdvanceCredit ? (
                  <Sparkles className="h-3.5 w-3.5" />
                ) : (
                  <Clock className="h-3.5 w-3.5" />
                )}
              </div>
            </div>
            <div
              className={`mt-1.5 text-xl font-bold tracking-tight sm:text-2xl ${
                hasAdvanceCredit ? 'text-emerald-700' : 'text-amber-700'
              }`}
            >
              {isLoading
                ? '...'
                : hasAdvanceCredit
                ? formatCurrency(pendingBill.advanceCredit ?? 0)
                : formatCurrency(pendingBill.pendingAmount)}
            </div>
            {!hasAdvanceCredit && pendingBill.count > 0 && (
              <p className="mt-1 text-[10px] sm:text-[11px] text-neutral-400">
                ~{pendingBill.count} days unpaid
              </p>
            )}
          </CardMotion>
        </StaggerItem>

        {/* Total Paid */}
        <StaggerItem>
          <CardMotion className="rounded-xl border border-neutral-200/80 bg-white p-3.5 sm:p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                Total Paid
              </span>
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-50 text-emerald-600">
                <CheckCheck className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="mt-1.5 text-xl font-bold tracking-tight text-neutral-900 sm:text-2xl">
              {isLoading ? '...' : formatCurrency(pendingBill.totalSettled)}
            </div>
            <p className="mt-1 text-[10px] sm:text-[11px] text-neutral-400">
              {payments.length} payment{payments.length !== 1 ? 's' : ''}
            </p>
          </CardMotion>
        </StaggerItem>

        {/* Total Incurred */}
        <StaggerItem>
          <CardMotion className="rounded-xl border border-neutral-200/80 bg-white p-3.5 sm:p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                Total Incurred
              </span>
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-sky-50 text-sky-600">
                <Milk className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="mt-1.5 text-xl font-bold tracking-tight text-neutral-900 sm:text-2xl">
              {isLoading ? '...' : formatCurrency(pendingBill.totalIncurred)}
            </div>
            <p className="mt-1 text-[10px] sm:text-[11px] text-neutral-400">
              {totalDelivered} days delivered
            </p>
          </CardMotion>
        </StaggerItem>

        {/* Skipped Days */}
        <StaggerItem>
          <CardMotion className="rounded-xl border border-neutral-200/80 bg-white p-3.5 sm:p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                Skipped Days
              </span>
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-neutral-100 text-neutral-500">
                <Ban className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="mt-1.5 text-xl font-bold tracking-tight text-neutral-700 sm:text-2xl">
              {isLoading ? '...' : `${totalSkipped} days`}
            </div>
          </CardMotion>
        </StaggerItem>
      </StaggerContainer>

      {/* Two-column log section on desktop */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
        {/* Payment History */}
        <ScrollReveal className="rounded-xl border border-neutral-200/80 bg-white shadow-xs overflow-hidden">
          <div className="flex items-center justify-between border-b border-neutral-100 px-3.5 py-3 sm:px-4 sm:py-3.5">
            <div className="flex items-center gap-2">
              <Receipt className="h-3.5 w-3.5 text-neutral-500 stroke-[1.8]" />
              <h2 className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Payment History
              </h2>
            </div>
            <span className="text-[10px] sm:text-[11px] text-neutral-400">
              {payments.length} payment{payments.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="divide-y divide-neutral-100">
            {paymentsLoading && payments.length === 0 ? (
              <div className="p-6 text-center text-xs text-neutral-400">Loading payments...</div>
            ) : payments.length === 0 ? (
              <div className="p-8 text-center">
                <ArrowDownRight className="mx-auto h-5 w-5 text-neutral-300 mb-2" />
                <p className="text-xs text-neutral-400">No payments recorded yet.</p>
                <p className="text-[10px] text-neutral-300 mt-0.5">
                  Tap "+ Add Milk Payment" above to record your first payment.
                </p>
              </div>
            ) : (
              payments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between px-3.5 py-2.5 sm:px-4 sm:py-3 hover:bg-neutral-50/60 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                      <CheckCheck className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-neutral-900">
                        {formatDateDDMMYYYY(payment.date)}
                      </span>
                      <p className="text-[10px] text-neutral-400">
                        {payment.description || 'Milk Bill payment'}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-emerald-700 shrink-0">
                    - {formatCurrency(Number(payment.amount))}
                  </span>
                </div>
              ))
            )}

            {/* Running total row */}
            {payments.length > 0 && (
              <div className="flex items-center justify-between bg-neutral-50/70 px-3.5 py-2.5 sm:px-4">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                  Total Paid (All Time)
                </span>
                <span className="text-xs font-bold text-emerald-700">
                  {formatCurrency(pendingBill.totalSettled)}
                </span>
              </div>
            )}
          </div>
        </ScrollReveal>

        {/* Daily Log Entries */}
        <ScrollReveal className="rounded-xl border border-neutral-200/80 bg-white shadow-xs overflow-hidden">
          <div className="flex items-center justify-between border-b border-neutral-100 px-3.5 py-3 sm:px-4 sm:py-3.5">
            <div className="flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 text-neutral-500 stroke-[1.8]" />
              <h2 className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Daily Log Entries
              </h2>
            </div>
            <span className="text-[10px] sm:text-[11px] text-neutral-400">
              {logs.length} logged days
            </span>
          </div>

          <div className="divide-y divide-neutral-100 max-h-[480px] overflow-y-auto">
            {isLoading ? (
              <div className="p-8 text-center text-xs text-neutral-400">Loading logs...</div>
            ) : logs.length === 0 ? (
              <div className="p-10 text-center">
                <p className="text-xs text-neutral-400">No past logs recorded yet.</p>
              </div>
            ) : (
              logs.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between px-3.5 py-2.5 sm:px-4 sm:py-3 hover:bg-neutral-50/60 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-neutral-100 text-neutral-600">
                      <Calendar className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-neutral-900">{formatDateDDMMYYYY(item.date)}</span>
                      <p className="text-[10px] sm:text-[11px] text-neutral-400">
                        {item.status === 'skipped'
                          ? 'Milk delivery skipped'
                          : 'Delivered on credit (₹14)'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {item.status === 'skipped' ? (
                      <>
                        <span className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-600">
                          <Ban className="h-2.5 w-2.5" />
                          Skipped (₹0)
                        </span>
                        <button
                          type="button"
                          disabled={togglingDate === item.date}
                          onClick={() => handleToggleSpecificDate(item.date, 'pending')}
                          className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-2 py-0.5 text-[10px] font-medium text-neutral-700 hover:bg-neutral-50 hover:text-neutral-900 transition-colors disabled:opacity-50"
                          title="Undo skip for this date (revert to delivered +₹14)"
                        >
                          {togglingDate === item.date ? (
                            <Loader2 className="h-2.5 w-2.5 animate-spin" />
                          ) : (
                            <RotateCcw className="h-2.5 w-2.5 text-neutral-500" />
                          )}
                          <span>Undo Skip</span>
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-700">
                          <TrendingDown className="h-2.5 w-2.5" />
                          +₹{item.amount}
                        </span>
                        <button
                          type="button"
                          disabled={togglingDate === item.date}
                          onClick={() => handleToggleSpecificDate(item.date, 'skipped')}
                          className="inline-flex items-center gap-1 rounded-md border border-transparent hover:border-neutral-200 hover:bg-neutral-50 px-1.5 py-0.5 text-[10px] font-medium text-neutral-400 hover:text-neutral-700 transition-colors disabled:opacity-50"
                          title="Skip delivery for this specific date only (₹0)"
                        >
                          {togglingDate === item.date ? (
                            <Loader2 className="h-2.5 w-2.5 animate-spin" />
                          ) : (
                            <Ban className="h-2.5 w-2.5 text-neutral-400" />
                          )}
                          <span>Skip</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollReveal>
      </div>
    </PageTransition>
  );
}
