'use client';

import React, { useState } from 'react';
import {
  Bike,
  Plus,
  Info,
  Trash2,
  X,
  AlertCircle,
  Fuel,
  Gauge,
  TrendingUp,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { SwiggyIncomeForm } from '@/components/SwiggyIncomeForm';
import { deleteSwiggyIncome } from '@/lib/supabase/api';
import { useSwiggyIncomes } from '@/lib/queries/hooks';
import { invalidateFinanceQueries } from '@/lib/queries/invalidation';
import { formatCurrency, formatDateDDMMYYYY } from '@/lib/utils';
import {
  PageTransition,
  StaggerContainer,
  StaggerItem,
  CardMotion,
  AnimatedModal,
} from '@/components/animations/MotionWrapper';
import type { SwiggyIncome } from '@/types/database';

export default function SwiggyIncomePage() {
  const { data: incomes = [], isLoading } = useSwiggyIncomes(100);
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [selectedItemDetails, setSelectedItemDetails] = useState<SwiggyIncome | null>(null);

  const handleDelete = async (id: string) => {
    if (confirm('Delete this payout entry?')) {
      const ok = await deleteSwiggyIncome(id);
      if (ok) {
        invalidateFinanceQueries('swiggy');
      }
    }
  };

  const totalGross = incomes.reduce((sum, i) => sum + Number(i.gross_amount || 0), 0);
  const totalDeductions = incomes.reduce(
    (sum, i) => sum + Number(i.deduction_amount || 0),
    0
  );
  const totalFuel = incomes.reduce((sum, i) => sum + Number(i.fuel_expense || 0), 0);
  const totalKm = incomes.reduce((sum, i) => sum + Number(i.km_driven || 0), 0);
  const totalNet = incomes.reduce(
    (sum, i) =>
      sum +
      (Number(i.gross_amount || 0) -
        Number(i.deduction_amount || 0) -
        Number(i.fuel_expense || 0)),
    0
  );
  const avgEarningsPerKm = totalKm > 0 ? totalNet / totalKm : 0;

  return (
    <PageTransition className="space-y-4 sm:space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-sm font-semibold tracking-tight text-neutral-900 sm:text-base">
            Swiggy Delivery Earnings
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
          <span>Log Payout</span>
        </motion.button>
      </div>

      {/* Summary Metrics (6 Key Cards) */}
      <StaggerContainer className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-3">
        {/* 1. Net Profit */}
        <StaggerItem>
          <CardMotion className="rounded-xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/40 via-white to-white p-3.5 sm:p-4 shadow-xs">
            <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-emerald-800">
              Total Net Profit
            </span>
            <div className="mt-1.5 text-lg font-bold tracking-tight text-emerald-700 sm:text-2xl">
              {formatCurrency(totalNet)}
            </div>
          </CardMotion>
        </StaggerItem>

        {/* 2. Gross Amount */}
        <StaggerItem>
          <CardMotion className="rounded-xl border border-neutral-200/80 bg-white p-3.5 sm:p-4 shadow-xs">
            <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
              Gross Earnings
            </span>
            <div className="mt-1.5 text-lg font-bold tracking-tight text-neutral-900 sm:text-2xl">
              {formatCurrency(totalGross)}
            </div>
          </CardMotion>
        </StaggerItem>

        {/* 3. Total Fuel Spent */}
        <StaggerItem>
          <CardMotion className="rounded-xl border border-amber-200/80 bg-amber-50/20 p-3.5 sm:p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-amber-800">
                Total Fuel Spent
              </span>
              <Fuel className="h-3.5 w-3.5 text-amber-600" />
            </div>
            <div className="mt-1.5 text-lg font-bold tracking-tight text-amber-700 sm:text-2xl">
              {formatCurrency(totalFuel)}
            </div>
          </CardMotion>
        </StaggerItem>

        {/* 4. Total KM Driven */}
        <StaggerItem>
          <CardMotion className="rounded-xl border border-blue-200/80 bg-blue-50/20 p-3.5 sm:p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-blue-800">
                Total KM Driven
              </span>
              <Gauge className="h-3.5 w-3.5 text-blue-600" />
            </div>
            <div className="mt-1.5 text-lg font-bold tracking-tight text-blue-700 sm:text-2xl">
              {totalKm.toLocaleString()} <span className="text-xs font-normal">km</span>
            </div>
          </CardMotion>
        </StaggerItem>

        {/* 5. Average Earnings per KM */}
        <StaggerItem>
          <CardMotion className="rounded-xl border border-neutral-200/80 bg-white p-3.5 sm:p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                Avg. Rate / KM
              </span>
              <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
            </div>
            <div className="mt-1.5 text-lg font-bold tracking-tight text-neutral-900 sm:text-2xl">
              ₹{avgEarningsPerKm.toFixed(2)}
              <span className="text-xs font-normal text-neutral-400">/km</span>
            </div>
          </CardMotion>
        </StaggerItem>

        {/* 6. Total Deductions */}
        <StaggerItem>
          <CardMotion className="rounded-xl border border-rose-200/80 bg-rose-50/20 p-3.5 sm:p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-rose-800">
                Total Deductions
              </span>
              <AlertCircle className="h-3.5 w-3.5 text-rose-600" />
            </div>
            <div className="mt-1.5 text-lg font-bold tracking-tight text-rose-600 sm:text-2xl">
              {formatCurrency(totalDeductions)}
            </div>
          </CardMotion>
        </StaggerItem>
      </StaggerContainer>

      {/* Pop-up Modal */}
      <AnimatedModal
        isOpen={showAddForm}
        onClose={() => setShowAddForm(false)}
        maxWidth="max-w-lg"
      >
        <div className="flex items-center justify-between border-b border-neutral-100 pb-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-50 text-orange-600">
              <Bike className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-neutral-900">
                Log Shift Payout
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
        <SwiggyIncomeForm
          onSuccess={() => {
            setShowAddForm(false);
            invalidateFinanceQueries('swiggy');
          }}
          onCancel={() => setShowAddForm(false)}
        />
      </AnimatedModal>

      {/* List */}
      <div className="rounded-xl border border-neutral-200/80 bg-white shadow-xs overflow-hidden">
        <div className="flex items-center justify-between border-b border-neutral-100 px-3.5 py-3 sm:px-4 sm:py-3.5">
          <h2 className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Shift & Payout History
          </h2>
          <span className="text-[10px] sm:text-[11px] text-neutral-400">
            {incomes.length} records
          </span>
        </div>

        <div className="divide-y divide-neutral-100">
          {isLoading ? (
            <div className="p-8 text-center text-xs text-neutral-400">
              Loading payout history...
            </div>
          ) : incomes.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-xs text-neutral-400">
                No Swiggy payout entries recorded yet.
              </p>
            </div>
          ) : (
            incomes.map((item) => {
              const gross = Number(item.gross_amount || 0);
              const ded = Number(item.deduction_amount || 0);
              const fuel = Number(item.fuel_expense || 0);
              const km = Number(item.km_driven || 0);
              const net = gross - ded - fuel;
              const ratePerKm = km > 0 ? net / km : 0;
              const hasDeduction = ded > 0;
              const hasFuel = fuel > 0;
              const hasKm = km > 0;

              return (
                <div
                  key={item.id}
                  className="group flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-3.5 py-2.5 sm:px-4 sm:py-3 hover:bg-neutral-50/60 transition-colors"
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                      <span className="text-xs font-semibold text-neutral-900">
                        {formatDateDDMMYYYY(item.date)}
                      </span>

                      {/* Fuel Spent Badge */}
                      {hasFuel && (
                        <span className="inline-flex items-center gap-0.5 rounded-md bg-amber-50 px-1.5 py-0.5 text-[9px] sm:text-[10px] font-semibold text-amber-700 border border-amber-200/60">
                          <Fuel className="h-2.5 w-2.5" />
                          -₹{fuel} fuel
                        </span>
                      )}

                      {/* Distance Badge */}
                      {hasKm && (
                        <span className="inline-flex items-center gap-0.5 rounded-md bg-blue-50 px-1.5 py-0.5 text-[9px] sm:text-[10px] font-semibold text-blue-700 border border-blue-200/60">
                          <Gauge className="h-2.5 w-2.5" />
                          {km} km
                        </span>
                      )}

                      {/* Rate / KM Pill */}
                      {hasKm && (
                        <span className="inline-flex items-center rounded-md bg-neutral-100 px-1.5 py-0.5 text-[9px] sm:text-[10px] font-medium text-neutral-600">
                          ₹{ratePerKm.toFixed(1)}/km
                        </span>
                      )}

                      {/* Deduction Badge */}
                      {hasDeduction && (
                        <span className="inline-flex items-center gap-0.5 rounded-md bg-rose-50 px-1.5 py-0.5 text-[9px] sm:text-[10px] font-medium text-rose-700 border border-rose-200/60">
                          -₹{ded} ded.
                        </span>
                      )}
                    </div>

                    <div className="mt-1 flex items-center gap-2 text-[10px] sm:text-[11px] text-neutral-400">
                      <span>Gross {formatCurrency(gross)}</span>
                      <button
                        type="button"
                        onClick={() => setSelectedItemDetails(item)}
                        className="flex items-center gap-0.5 text-neutral-500 hover:text-neutral-900 underline underline-offset-2"
                      >
                        <Info className="h-2.5 w-2.5" />
                        <span>breakdown</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 border-t border-neutral-100 sm:border-0 pt-2 sm:pt-0">
                    <div className="text-left sm:text-right">
                      <span className="text-xs sm:text-sm font-bold tracking-tight text-neutral-900">
                        {formatCurrency(net)}
                      </span>
                      <p className="text-[9px] text-emerald-700 font-semibold">Net Profit</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      className="opacity-70 sm:opacity-0 sm:group-hover:opacity-100 p-1 text-neutral-400 hover:text-rose-600 transition-opacity"
                      title="Delete entry"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Shift Breakdown Animated Modal */}
      <AnimatedModal
        isOpen={!!selectedItemDetails}
        onClose={() => setSelectedItemDetails(null)}
        maxWidth="max-w-sm"
      >
        {selectedItemDetails && (
          <div>
            <div className="flex items-center justify-between border-b border-neutral-100 pb-2.5">
              <div className="flex items-center gap-2">
                <Bike className="h-4 w-4 text-neutral-900" />
                <h3 className="text-xs font-semibold text-neutral-900">
                  Shift Payout Breakdown
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItemDetails(null)}
                className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 space-y-2 text-xs">
              <div className="flex justify-between text-neutral-500">
                <span>Date:</span>
                <span className="font-semibold text-neutral-900">
                  {formatDateDDMMYYYY(selectedItemDetails.date)}
                </span>
              </div>
              <div className="flex justify-between text-neutral-500">
                <span>Gross Earnings:</span>
                <span className="font-semibold text-neutral-900">
                  {formatCurrency(Number(selectedItemDetails.gross_amount))}
                </span>
              </div>
              <div className="flex justify-between text-neutral-500">
                <span>Fuel Expense:</span>
                <span className="font-semibold text-amber-700">
                  - {formatCurrency(Number(selectedItemDetails.fuel_expense || 0))}
                </span>
              </div>
              <div className="flex justify-between text-neutral-500">
                <span>Deductions:</span>
                <span className="font-semibold text-rose-600">
                  - {formatCurrency(Number(selectedItemDetails.deduction_amount || 0))}
                </span>
              </div>
              <div className="flex justify-between text-neutral-500">
                <span>Kilometers Driven:</span>
                <span className="font-semibold text-blue-700">
                  {Number(selectedItemDetails.km_driven || 0)} km
                </span>
              </div>

              {Number(selectedItemDetails.km_driven || 0) > 0 && (
                <div className="flex justify-between text-neutral-500 border-t border-neutral-100 pt-1.5">
                  <span>Net Efficiency:</span>
                  <span className="font-semibold text-neutral-900">
                    ₹
                    {(
                      (Number(selectedItemDetails.gross_amount) -
                        Number(selectedItemDetails.deduction_amount || 0) -
                        Number(selectedItemDetails.fuel_expense || 0)) /
                      Number(selectedItemDetails.km_driven)
                    ).toFixed(2)}
                    /km
                  </span>
                </div>
              )}

              {selectedItemDetails.deduction_reason && (
                <div className="pt-1.5">
                  <span className="text-[10px] uppercase font-semibold text-neutral-400">
                    Deduction Reason
                  </span>
                  <p className="mt-1 rounded-xl border border-neutral-200/80 bg-neutral-50 p-2.5 text-xs text-neutral-800">
                    {selectedItemDetails.deduction_reason}
                  </p>
                </div>
              )}

              <div className="flex justify-between items-center border-t border-neutral-200 pt-2 text-sm font-bold">
                <span className="text-neutral-900">Net Profit in Hand:</span>
                <span className="text-emerald-700">
                  {formatCurrency(
                    Number(selectedItemDetails.gross_amount) -
                      Number(selectedItemDetails.deduction_amount || 0) -
                      Number(selectedItemDetails.fuel_expense || 0)
                  )}
                </span>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedItemDetails(null)}
                className="rounded-lg bg-neutral-900 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-neutral-800 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </AnimatedModal>
    </PageTransition>
  );
}
