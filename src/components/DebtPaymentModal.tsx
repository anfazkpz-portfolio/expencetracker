'use client';

import React, { useState, useEffect } from 'react';
import { X, HandCoins, ArrowUpRight, ArrowDownRight, Loader2, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { recordDebtPayment, type DebtWithPaid } from '@/lib/supabase/api';
import { invalidateFinanceQueries } from '@/lib/queries/invalidation';
import { formatCurrency } from '@/lib/utils';
import { AnimatedModal } from '@/components/animations/MotionWrapper';

interface DebtPaymentModalProps {
  debt: DebtWithPaid | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function DebtPaymentModal({
  debt,
  isOpen,
  onClose,
  onSuccess,
}: DebtPaymentModalProps) {
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [date, setDate] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (debt) {
      const remaining = debt.remaining_amount !== undefined ? debt.remaining_amount : debt.amount;
      setPaymentAmount(remaining > 0 ? remaining.toString() : '0');
      const today = new Date().toISOString().split('T')[0];
      setDate(today);
      setNote('');
      setError(null);
    }
  }, [debt, isOpen]);

  if (!debt) return null;

  const isLent = debt.type === 'lent';
  const remaining =
    debt.remaining_amount !== undefined
      ? debt.remaining_amount
      : Math.max(0, debt.amount - (debt.paid_amount || 0));
  const paid = debt.paid_amount || 0;
  const parsedAmount = parseFloat(paymentAmount) || 0;
  const newRemaining = Math.max(0, remaining - parsedAmount);
  const isFullPayment = parsedAmount >= remaining && remaining > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (parsedAmount <= 0) {
      setError('Please enter a payment amount greater than ₹0.');
      return;
    }

    if (parsedAmount > remaining && remaining > 0) {
      setError(`Payment cannot exceed the remaining balance of ${formatCurrency(remaining)}.`);
      return;
    }

    setIsLoading(true);
    try {
      const res = await recordDebtPayment({
        debt,
        paymentAmount: parsedAmount,
        date: date || undefined,
        note: note.trim() || undefined,
      });

      if (!res.success) {
        throw new Error(res.error || 'Failed to record payment');
      }

      invalidateFinanceQueries('debts');
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Error processing debt payment.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatedModal isOpen={isOpen} onClose={onClose} maxWidth="max-w-md">
      {/* Modal Header */}
      <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-100 text-neutral-800">
            <HandCoins className="h-4 w-4 stroke-[1.8]" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-neutral-900">Record Debt Payment</h3>
            <p className="text-[11px] text-neutral-400">
              {isLent ? 'Collect from' : 'Repay to'} {debt.person_name}
            </p>
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

      {/* Debt Financial Summary Breakdown */}
      <div className="mt-3.5 rounded-xl border border-neutral-100 bg-neutral-50/70 p-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-neutral-500">Contact / Person:</span>
          <span className="font-semibold text-neutral-900">{debt.person_name}</span>
        </div>

        <div className="mt-2 grid grid-cols-3 divide-x divide-neutral-200/70 pt-2 border-t border-neutral-200/40 text-center">
          <div>
            <span className="text-[10px] uppercase tracking-wider text-neutral-400">Total</span>
            <p className="mt-0.5 text-xs font-semibold text-neutral-900">
              {formatCurrency(Number(debt.amount))}
            </p>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-wider text-neutral-400">Paid</span>
            <p className="mt-0.5 text-xs font-semibold text-neutral-600">
              {formatCurrency(paid)}
            </p>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-wider text-neutral-400">Remaining</span>
            <p className={`mt-0.5 text-xs font-bold ${isLent ? 'text-emerald-600' : 'text-neutral-900'}`}>
              {formatCurrency(remaining)}
            </p>
          </div>
        </div>
      </div>

      {/* Payment Form */}
      <form onSubmit={handleSubmit} className="mt-3.5 space-y-3.5">
        {/* Amount Input */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[10px] sm:text-[11px] font-medium uppercase tracking-wider text-neutral-400">
              Payment Amount (₹)
            </label>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPaymentAmount(Math.round(remaining / 2).toString())}
                className="rounded px-1.5 py-0.5 text-[10px] font-medium text-neutral-500 hover:bg-neutral-100"
              >
                Half (₹{Math.round(remaining / 2)})
              </button>
              <button
                type="button"
                onClick={() => setPaymentAmount(remaining.toString())}
                className="rounded px-1.5 py-0.5 text-[10px] font-medium text-neutral-900 bg-neutral-100 hover:bg-neutral-200"
              >
                Full (₹{remaining})
              </button>
            </div>
          </div>

          <div className="relative flex items-center">
            <span className="absolute left-3 text-sm font-semibold text-neutral-400">₹</span>
            <input
              type="number"
              step="any"
              min="1"
              max={remaining > 0 ? remaining : undefined}
              required
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-xl border border-neutral-200 bg-white py-2 pl-7 pr-3 text-base font-bold text-neutral-900 focus:border-neutral-900 focus:outline-hidden"
            />
          </div>

          {parsedAmount > 0 && (
            <p className="mt-1 text-[10px] sm:text-[11px] text-neutral-500">
              {isFullPayment ? (
                <span className="text-emerald-600 font-medium">
                  ✓ Full payment: Debt will be marked as Cleared.
                </span>
              ) : (
                <span>
                  Remaining after payment: <strong>{formatCurrency(newRemaining)}</strong>
                </span>
              )}
            </p>
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
              placeholder="e.g. GPay / Cash"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-900 placeholder:text-neutral-300 focus:border-neutral-900 focus:outline-hidden"
            />
          </div>
        </div>

        {/* Impact Notice */}
        <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-2.5 text-[10px] sm:text-[11px] text-neutral-600 flex items-start gap-2">
          {isLent ? (
            <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-emerald-600 mt-0.5" />
          ) : (
            <ArrowDownRight className="h-3.5 w-3.5 shrink-0 text-neutral-700 mt-0.5" />
          )}
          <div>
            <span className="font-semibold text-neutral-900">
              Automatic Cash Sync:
            </span>{' '}
            {isLent
              ? `Adds +${formatCurrency(parsedAmount)} as Income to your main cash balance.`
              : `Deducts -${formatCurrency(parsedAmount)} as Expense from your main cash balance.`}
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-600">
            {error}
          </div>
        )}

        {/* Buttons */}
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
              <Check className="h-3.5 w-3.5" />
            )}
            <span>Record Payment ({formatCurrency(parsedAmount)})</span>
          </motion.button>
        </div>
      </form>
    </AnimatedModal>
  );
}
