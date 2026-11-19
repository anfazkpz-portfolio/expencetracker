'use client';

import React, { useState } from 'react';
import { Bike, Check, Loader2, Fuel, Gauge } from 'lucide-react';
import { createSwiggyIncome, getTodayDateString } from '@/lib/supabase/api';
import { invalidateFinanceQueries } from '@/lib/queries/invalidation';
import { formatCurrency } from '@/lib/utils';
import type { SwiggyIncome } from '@/types/database';

interface SwiggyIncomeFormProps {
  onSuccess?: (income: SwiggyIncome) => void;
  onCancel?: () => void;
}

export function SwiggyIncomeForm({
  onSuccess,
  onCancel,
}: SwiggyIncomeFormProps) {
  const date = getTodayDateString();
  const [grossAmount, setGrossAmount] = useState<string>('');
  const [deductionAmount, setDeductionAmount] = useState<string>('0');
  const [deductionReason, setDeductionReason] = useState<string>('');
  const [fuelExpense, setFuelExpense] = useState<string>('');
  const [kmDriven, setKmDriven] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const gross = parseFloat(grossAmount) || 0;
  const deduction = parseFloat(deductionAmount) || 0;
  const fuel = parseFloat(fuelExpense) || 0;
  const km = parseFloat(kmDriven) || 0;
  const netAmount = Math.max(0, gross - (deduction + fuel));
  const earningsPerKm = km > 0 ? netAmount / km : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (gross <= 0) {
      setError('Please enter a valid Gross Amount greater than 0.');
      return;
    }

    if (deduction < 0) {
      setError('Deduction cannot be negative.');
      return;
    }

    if (fuel < 0) {
      setError('Fuel expense cannot be negative.');
      return;
    }

    if (km < 0) {
      setError('Kilometers driven cannot be negative.');
      return;
    }

    if (deduction > 0 && !deductionReason.trim()) {
      setError('Please specify a reason for the deduction.');
      return;
    }

    setIsLoading(true);
    try {
      const { data, error: err } = await createSwiggyIncome({
        date,
        gross_amount: gross,
        deduction_amount: deduction,
        deduction_reason: deduction > 0 ? deductionReason.trim() : undefined,
        fuel_expense: fuel,
        km_driven: km,
      });

      if (err || !data) {
        throw err || new Error('Failed to save Swiggy income');
      }

      // Reset form
      setGrossAmount('');
      setDeductionAmount('0');
      setDeductionReason('');
      setFuelExpense('');
      setKmDriven('');
      invalidateFinanceQueries('swiggy');
      onSuccess?.(data);
    } catch (err: any) {
      setError(err?.message || 'Error saving Swiggy income.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Header icon / title tag */}
      <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-neutral-100 text-neutral-800">
            <Bike className="h-4 w-4 stroke-[1.75]" />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-neutral-900">
              Swiggy Payout Entry
            </h3>
            <p className="text-[11px] text-neutral-400">
              Record shift or weekly delivery payout
            </p>
          </div>
        </div>
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-500">
          Today
        </span>
      </div>

      {/* Gross and Deduction */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-medium uppercase tracking-wider text-neutral-400 mb-1">
            Gross Amount
          </label>
          <div className="relative flex items-center">
            <span className="absolute left-3 text-xs font-medium text-neutral-400">
              ₹
            </span>
            <input
              type="number"
              step="any"
              min="0"
              required
              placeholder="0.00"
              value={grossAmount}
              onChange={(e) => setGrossAmount(e.target.value)}
              className="w-full rounded-md border border-neutral-200 bg-white py-1.5 pl-7 pr-3 text-sm font-semibold text-neutral-900 placeholder:text-neutral-300 focus:border-neutral-900 focus:outline-hidden"
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-medium uppercase tracking-wider text-neutral-400 mb-1">
            Deduction Amount
          </label>
          <div className="relative flex items-center">
            <span className="absolute left-3 text-xs font-medium text-neutral-400">
              ₹
            </span>
            <input
              type="number"
              step="any"
              min="0"
              placeholder="0.00"
              value={deductionAmount}
              onChange={(e) => setDeductionAmount(e.target.value)}
              className="w-full rounded-md border border-neutral-200 bg-white py-1.5 pl-7 pr-3 text-sm font-semibold text-neutral-900 placeholder:text-neutral-300 focus:border-neutral-900 focus:outline-hidden"
            />
          </div>
        </div>
      </div>

      {/* Deduction Reason - shown/highlighted especially when deduction > 0 */}
      <div>
        <label className="block text-[11px] font-medium uppercase tracking-wider text-neutral-400 mb-1">
          Deduction Reason {deduction > 0 && <span className="text-red-500">*</span>}
        </label>
        <input
          type="text"
          placeholder={
            deduction > 0
              ? 'e.g. Order cancellation penalty, Bag/T-shirt EMI'
              : 'Optional if deduction is 0'
          }
          value={deductionReason}
          onChange={(e) => setDeductionReason(e.target.value)}
          required={deduction > 0}
          className="w-full rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-hidden"
        />
      </div>

      {/* Fuel Expense & Kilometers Driven */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-medium uppercase tracking-wider text-neutral-400 mb-1">
            <span className="inline-flex items-center gap-1">
              <Fuel className="h-3 w-3 text-amber-600" />
              Fuel Expense (Petrol)
            </span>
          </label>
          <div className="relative flex items-center">
            <span className="absolute left-3 text-xs font-medium text-neutral-400">
              ₹
            </span>
            <input
              type="number"
              step="any"
              min="0"
              placeholder="0.00"
              value={fuelExpense}
              onChange={(e) => setFuelExpense(e.target.value)}
              className="w-full rounded-md border border-neutral-200 bg-white py-1.5 pl-7 pr-3 text-sm font-semibold text-neutral-900 placeholder:text-neutral-300 focus:border-neutral-900 focus:outline-hidden"
            />
          </div>
          <span className="mt-0.5 block text-[10px] text-neutral-400">
            Deducted from daily earnings
          </span>
        </div>

        <div>
          <label className="block text-[11px] font-medium uppercase tracking-wider text-neutral-400 mb-1">
            <span className="inline-flex items-center gap-1">
              <Gauge className="h-3 w-3 text-blue-600" />
              Kilometers Driven
            </span>
          </label>
          <div className="relative flex items-center">
            <input
              type="number"
              step="any"
              min="0"
              placeholder="0.0"
              value={kmDriven}
              onChange={(e) => setKmDriven(e.target.value)}
              className="w-full rounded-md border border-neutral-200 bg-white py-1.5 pl-3 pr-9 text-sm font-semibold text-neutral-900 placeholder:text-neutral-300 focus:border-neutral-900 focus:outline-hidden"
            />
            <span className="absolute right-3 text-xs font-medium text-neutral-400">
              km
            </span>
          </div>
          <span className="mt-0.5 block text-[10px] text-neutral-400">
            Total distance run on this shift
          </span>
        </div>
      </div>

      {/* Live Auto-Calculated Net Amount Display */}
      <div className="rounded-xl border border-neutral-200 bg-neutral-50/80 p-3.5 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-600">
              Auto-Calculated Net Earnings
            </span>
            <p className="text-[11px] text-neutral-400">
              {formatCurrency(gross)} - ({formatCurrency(deduction)} ded + {formatCurrency(fuel)} fuel)
            </p>
          </div>
          <div className="text-right">
            <span className="text-lg font-bold text-neutral-900">
              {formatCurrency(netAmount)}
            </span>
            <span className="block text-[10px] font-medium text-emerald-700">Actual in Hand</span>
          </div>
        </div>

        {km > 0 && (
          <div className="flex items-center justify-between border-t border-neutral-200/60 pt-2 text-[11px]">
            <span className="text-neutral-500">Delivery Efficiency:</span>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200/60">
                ₹{earningsPerKm.toFixed(2)}/km net
              </span>
              {fuel > 0 && (
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 border border-amber-200/60">
                  ₹{(fuel / km).toFixed(2)}/km fuel
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50/50 p-2 text-xs text-red-600">
          {error}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-2 pt-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="rounded-md border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 rounded-md bg-neutral-900 px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-neutral-800 disabled:opacity-50"
        >
          {isLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
          <span>Save Payout</span>
        </button>
      </div>
    </form>
  );
}

