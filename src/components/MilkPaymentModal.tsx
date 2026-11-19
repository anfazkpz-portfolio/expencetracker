'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Milk,
  CheckCheck,
  Loader2,
  ArrowDownRight,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { recordMilkPayment } from '@/lib/supabase/api';
import { invalidateFinanceQueries } from '@/lib/queries/invalidation';
import { formatCurrency } from '@/lib/utils';
import { AnimatedModal } from '@/components/animations/MotionWrapper';

interface MilkPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  pendingAmount: number;
  advanceCredit: number;
  totalIncurred: number;
  totalSettled: number;
  pendingDays: number;
}

export function MilkPaymentModal({
  isOpen,
  onClose,
  onSuccess,
  pendingAmount,
  advanceCredit,
  totalIncurred,
  totalSettled,
  pendingDays,
}: MilkPaymentModalProps) {
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [date, setDate] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Default to full pending amount; if advance credit, default empty
      setPaymentAmount(pendingAmount > 0 ? pendingAmount.toString() : '');
      setDate(new Date().toISOString().split('T')[0]);
      setNote('');
      setError(null);
    }
  }, [isOpen, pendingAmount]);

  const parsedAmount = parseFloat(paymentAmount) || 0;

  // Running balance after this payment
  const newTotalPaid = totalSettled + parsedAmount;
  const newNet = totalIncurred - newTotalPaid;
  const remainingAfterPayment = Math.max(0, newNet);
  const advanceAfterPayment = Math.max(0, -newNet);
  const isAdvancePayment = advanceAfterPayment > 0;
  const isExactPayment = parsedAmount > 0 && Math.abs(newNet) < 0.01;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (parsedAmount <= 0) {
      setError('Please enter a payment amount greater than ₹0.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await recordMilkPayment(
        parsedAmount,
        date || undefined,
        note.trim() || undefined
      );

      if (!res.success) {
        throw new Error(res.error || 'Failed to record milk payment');
      }

      invalidateFinanceQueries('milk');
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Error processing milk payment.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatedModal isOpen={isOpen} onClose={onClose} maxWidth="max-w-md">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-sky-700">
            <Milk className="h-4 w-4 stroke-[1.8]" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-neutral-900">Add Milk Payment</h3>
          </div>
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

      {/* Running Account Overview */}
      <div className="mt-3.5 rounded-xl border border-neutral-100 bg-neutral-50/70 p-3">
        <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-400 mb-2">
          Running Account Summary
        </p>
        <div className="grid grid-cols-3 divide-x divide-neutral-200/70 text-center">
          <div>
            <span className="text-[10px] uppercase tracking-wider text-neutral-400">
              Incurred
            </span>
            <p className="mt-0.5 text-xs font-semibold text-neutral-900">
              {formatCurrency(totalIncurred)}
            </p>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-wider text-neutral-400">
              Paid
            </span>
            <p className="mt-0.5 text-xs font-semibold text-emerald-600">
              {formatCurrency(totalSettled)}
            </p>
          </div>
          <div>
            {advanceCredit > 0 ? (
              <>
                <span className="text-[10px] uppercase tracking-wider text-emerald-600 font-semibold">
                  Advance
                </span>
                <p className="mt-0.5 text-xs font-bold text-emerald-600">
                  +{formatCurrency(advanceCredit)}
                </p>
              </>
            ) : (
              <>
                <span className="text-[10px] uppercase tracking-wider text-neutral-400">
                  Pending
                </span>
                <p className="mt-0.5 text-xs font-bold text-amber-700">
                  {formatCurrency(pendingAmount)}
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Payment Form */}
      <form onSubmit={handleSubmit} className="mt-3.5 space-y-3.5">
        {/* Amount Field */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[10px] sm:text-[11px] font-medium uppercase tracking-wider text-neutral-400">
              Amount Paid (₹)
            </label>
            <div className="flex items-center gap-1.5">
              {pendingAmount > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => setPaymentAmount(Math.round(pendingAmount / 2).toString())}
                    className="rounded px-1.5 py-0.5 text-[10px] font-medium text-neutral-500 hover:bg-neutral-100"
                  >
                    Half (₹{Math.round(pendingAmount / 2)})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentAmount(pendingAmount.toString())}
                    className="rounded px-1.5 py-0.5 text-[10px] font-medium text-neutral-900 bg-neutral-100 hover:bg-neutral-200"
                  >
                    Full (₹{pendingAmount})
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="relative flex items-center">
            <span className="absolute left-3 text-sm font-semibold text-neutral-400">₹</span>
            <input
              type="number"
              step="any"
              min="1"
              required
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-xl border border-neutral-200 bg-white py-2 pl-7 pr-3 text-base font-bold text-neutral-900 focus:border-neutral-900 focus:outline-hidden"
            />
          </div>

          {/* Live balance preview */}
          {parsedAmount > 0 && (
            <div className="mt-1.5 rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2 text-[11px]">
              {isAdvancePayment ? (
                <span className="flex items-center gap-1 text-emerald-700 font-medium">
                  <Sparkles className="h-3 w-3" />
                  Advance credit of <strong>{formatCurrency(advanceAfterPayment)}</strong> will carry forward to future days.
                </span>
              ) : isExactPayment ? (
                <span className="text-emerald-600 font-medium flex items-center gap-1">
                  <CheckCheck className="h-3 w-3" />
                  Perfect — running balance will be fully cleared.
                </span>
              ) : (
                <span className="text-neutral-600 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3 text-amber-600" />
                  Remaining balance of{' '}
                  <strong className="text-amber-700">{formatCurrency(remainingAfterPayment)}</strong>{' '}
                  carries forward automatically.
                </span>
              )}
            </div>
          )}
        </div>

        {/* Date & Note */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div>
            <label className="block text-[10px] sm:text-[11px] font-medium uppercase tracking-wider text-neutral-400 mb-1">
              Payment Date
            </label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-900 focus:border-neutral-900 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-[10px] sm:text-[11px] font-medium uppercase tracking-wider text-neutral-400 mb-1">
              Note (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. UPI / Cash / Monthly"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-900 placeholder:text-neutral-300 focus:border-neutral-900 focus:outline-hidden"
            />
          </div>
        </div>

        {/* Info pill */}
        <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-2.5 text-[10px] sm:text-[11px] text-neutral-600 flex items-start gap-2">
          <ArrowDownRight className="h-3.5 w-3.5 shrink-0 text-neutral-700 mt-0.5" />
          <div>
            <span className="font-semibold text-neutral-900">Expense Record:</span> Adds an
            expense of {formatCurrency(parsedAmount)} under category{' '}
            <code className="text-[10px] bg-white px-1 py-0.5 rounded border border-neutral-200">
              Milk Bill
            </code>
            . The running balance updates automatically.
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-600">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <motion.button
            type="submit"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            disabled={isLoading || parsedAmount <= 0}
            className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-neutral-800 transition-colors disabled:opacity-50 shadow-xs"
          >
            {isLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCheck className="h-3.5 w-3.5" />
            )}
            <span>Record Payment ({formatCurrency(parsedAmount)})</span>
          </motion.button>
        </div>
      </form>
    </AnimatedModal>
  );
}
