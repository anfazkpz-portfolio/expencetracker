'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { Bike, Milk, HandCoins, ArrowRight } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import {
  useSwiggyIncomes,
  useDebts,
  usePendingMilkBill,
} from '@/lib/queries/hooks';
import {
  CardMotion,
  StaggerContainer,
  StaggerItem,
  ScrollReveal,
} from '@/components/animations/MotionWrapper';

export function ExternalFunds() {
  const { data: swiggy = [], isLoading: swiggyLoading } = useSwiggyIncomes(100);
  const { data: debts = [], isLoading: debtsLoading } = useDebts(150);
  const { data: pendingMilk, isLoading: milkLoading } = usePendingMilkBill();

  const isLoading = (swiggyLoading || debtsLoading || milkLoading) && swiggy.length === 0 && debts.length === 0;

  const data = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const isThisMonth = (dateStr: string) => {
      const d = new Date(dateStr);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    };

    const monthSwiggy = swiggy.filter((s) => isThisMonth(s.date));
    const swiggyGross = monthSwiggy.reduce((acc, s) => acc + Number(s.gross_amount), 0);
    const swiggyDeduction = monthSwiggy.reduce((acc, s) => acc + Number(s.deduction_amount), 0);
    const swiggyNet = monthSwiggy.reduce(
      (acc, s) =>
        acc +
        (Number(s.gross_amount || 0) -
          Number(s.deduction_amount || 0) -
          Number(s.fuel_expense || 0)),
      0
    );

    const milkTotal = pendingMilk?.totalSettled || 0;
    const milkPendingAmount = pendingMilk?.pendingAmount || 0;

    const pending = debts.filter((d) => d.status === 'pending');
    const debtLent = pending
      .filter((d) => d.type === 'lent')
      .reduce((sum, d) => sum + (d.remaining_amount !== undefined ? d.remaining_amount : Number(d.amount)), 0);
    const debtBorrowed = pending
      .filter((d) => d.type === 'borrowed')
      .reduce((sum, d) => sum + (d.remaining_amount !== undefined ? d.remaining_amount : Number(d.amount)), 0);

    return {
      swiggyGross,
      swiggyDeduction,
      swiggyNet,
      milkTotal,
      milkPending: milkPendingAmount,
      debtLent,
      debtBorrowed,
    };
  }, [swiggy, debts, pendingMilk]);

  const {
    swiggyGross,
    swiggyDeduction,
    swiggyNet,
    milkTotal,
    milkPending,
    debtLent,
    debtBorrowed,
  } = data;

  return (
    <ScrollReveal className="rounded-xl border border-neutral-200/80 bg-white p-3.5 sm:p-4 shadow-xs">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Monthly Payouts & Debts
        </h2>
        <span className="text-[10px] sm:text-[11px] text-neutral-400">Current Month</span>
      </div>

      <StaggerContainer className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        {/* Swiggy Income Card */}
        <StaggerItem>
          <Link href="/swiggy">
            <CardMotion className="group rounded-lg border border-neutral-100 bg-neutral-50/60 p-3 transition-colors hover:border-neutral-300 hover:bg-neutral-50">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-neutral-700">Swiggy Net</span>
                <div className="flex items-center gap-1 text-neutral-400 group-hover:text-neutral-900 transition-colors">
                  <Bike className="h-3.5 w-3.5 stroke-[1.8]" />
                  <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                </div>
              </div>
              <div className="mt-1.5 text-lg sm:text-xl font-bold text-neutral-900">
                {isLoading ? '...' : formatCurrency(swiggyNet)}
              </div>
              <div className="mt-1 flex items-center justify-between text-[10px] text-neutral-400">
                <span>Gross {formatCurrency(swiggyGross)}</span>
                <span className="text-neutral-500">
                  {swiggyDeduction > 0 ? `-${formatCurrency(swiggyDeduction)}` : '₹0 ded.'}
                </span>
              </div>
            </CardMotion>
          </Link>
        </StaggerItem>

        {/* Debts Summary Card */}
        <StaggerItem>
          <Link href="/debts">
            <CardMotion className="group rounded-lg border border-neutral-100 bg-neutral-50/60 p-3 transition-colors hover:border-neutral-300 hover:bg-neutral-50">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-neutral-700">Debts & Loans</span>
                <div className="flex items-center gap-1 text-neutral-400 group-hover:text-neutral-900 transition-colors">
                  <HandCoins className="h-3.5 w-3.5 stroke-[1.8]" />
                  <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                </div>
              </div>
              <div className="mt-1.5 flex items-baseline gap-1.5">
                <span className="text-lg sm:text-xl font-bold text-neutral-900">
                  {isLoading ? '...' : formatCurrency(debtLent)}
                </span>
                <span className="text-[10px] text-emerald-600 font-medium">to receive</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[10px] text-neutral-400">
                <span>Lent: {formatCurrency(debtLent)}</span>
                <span>Owed: {formatCurrency(debtBorrowed)}</span>
              </div>
            </CardMotion>
          </Link>
        </StaggerItem>

        {/* Daily Milk Logs Card */}
        <StaggerItem>
          <Link href="/milk">
            <CardMotion className="group rounded-lg border border-neutral-100 bg-neutral-50/60 p-3 transition-colors hover:border-neutral-300 hover:bg-neutral-50">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-neutral-700">Milk Bill</span>
                <div className="flex items-center gap-1 text-neutral-400 group-hover:text-neutral-900 transition-colors">
                  <Milk className="h-3.5 w-3.5 stroke-[1.8]" />
                  <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                </div>
              </div>
              <div className="mt-1.5 text-lg sm:text-xl font-bold text-neutral-900">
                {isLoading ? '...' : formatCurrency(milkTotal)}
              </div>
              <div className="mt-1 flex items-center justify-between text-[10px] text-neutral-400">
                <span>Paid: {formatCurrency(milkTotal)}</span>
                <span className="text-amber-700 font-medium">Pending: {formatCurrency(milkPending)}</span>
              </div>
            </CardMotion>
          </Link>
        </StaggerItem>
      </StaggerContainer>
    </ScrollReveal>
  );
}
