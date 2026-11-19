'use client';

import React, { useMemo } from 'react';
import {
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Wallet,
  PiggyBank,
  TrendingUp,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { formatCurrency } from '@/lib/utils';
import {
  useTransactions,
  useSwiggyIncomes,
  usePendingMilkBill,
} from '@/lib/queries/hooks';
import {
  StaggerContainer,
  StaggerItem,
  CardMotion,
} from '@/components/animations/MotionWrapper';

export function DashboardStats() {
  const {
    data: txs = [],
    isLoading: txsLoading,
    isFetching: txsFetching,
    refetch: refetchTxs,
  } = useTransactions(250);

  const {
    data: swiggy = [],
    isLoading: swiggyLoading,
    isFetching: swiggyFetching,
    refetch: refetchSwiggy,
  } = useSwiggyIncomes(100);

  const {
    data: milkPending,
    isLoading: milkLoading,
    isFetching: milkFetching,
    refetch: refetchMilk,
  } = usePendingMilkBill();

  const isLoading = (txsLoading || swiggyLoading || milkLoading) && txs.length === 0;
  const isRefreshing = txsFetching || swiggyFetching || milkFetching;

  const stats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // All-time income & expense for liquid balance
    const txIncome = txs
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const swiggyNet = swiggy.reduce(
      (sum, s) =>
        sum +
        (Number(s.gross_amount || 0) -
          Number(s.deduction_amount || 0) -
          Number(s.fuel_expense || 0)),
      0
    );
    const totalInc = txIncome + swiggyNet;

    const txExpense = txs
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const totalBalance = totalInc - txExpense;
    const pendingMilkAmount = milkPending?.pendingAmount || 0;

    // Monthly calculation
    const isThisMonth = (dateStr: string) => {
      const d = new Date(dateStr);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    };

    const monthTxIncome = txs
      .filter((t) => t.type === 'income' && isThisMonth(t.date))
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const monthSwiggy = swiggy
      .filter((s) => isThisMonth(s.date))
      .reduce(
        (sum, s) =>
          sum +
          (Number(s.gross_amount || 0) -
            Number(s.deduction_amount || 0) -
            Number(s.fuel_expense || 0)),
        0
      );
    const monthlyIncome = monthTxIncome + monthSwiggy;

    const monthlyExpense = txs
      .filter((t) => t.type === 'expense' && isThisMonth(t.date))
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const netSavings = monthlyIncome - monthlyExpense;

    return {
      totalBalance,
      monthlyIncome,
      monthlyExpense,
      netSavings,
      pendingMilkAmount,
    };
  }, [txs, swiggy, milkPending]);

  const {
    totalBalance,
    monthlyIncome,
    monthlyExpense,
    netSavings,
    pendingMilkAmount,
  } = stats;

  const handleRefresh = async () => {
    await Promise.all([refetchTxs(), refetchSwiggy(), refetchMilk()]);
  };

  const savingsRate =
    monthlyIncome > 0
      ? Math.round((netSavings / monthlyIncome) * 100)
      : 0;

  return (
    <div className="space-y-3">
      {/* Top Header & Refresh */}
      <div className="flex items-center justify-between">
        <h1 className="text-sm font-semibold tracking-tight text-neutral-900 sm:text-base">
          Financial Overview
        </h1>

        <motion.button
          type="button"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-neutral-200/80 bg-white text-neutral-500 shadow-xs hover:bg-neutral-50 hover:text-neutral-900 transition-colors disabled:opacity-40"
          title="Refresh metrics"
        >
          <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
        </motion.button>
      </div>

      {/* 4 Metric Cards with Stagger Animation */}
      <StaggerContainer className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        {/* Total Cash Balance */}
        <StaggerItem>
          <CardMotion className="rounded-xl border border-neutral-200/80 bg-white p-3.5 sm:p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                Liquid Balance
              </span>
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-neutral-100 text-neutral-700">
                <Wallet className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="mt-2 text-xl font-bold tracking-tight text-neutral-900 sm:text-2xl">
              {isLoading ? '...' : formatCurrency(totalBalance)}
            </div>
          </CardMotion>
        </StaggerItem>

        {/* Monthly Income */}
        <StaggerItem>
          <CardMotion className="rounded-xl border border-neutral-200/80 bg-white p-3.5 sm:p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                Month Income
              </span>
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-50 text-emerald-600">
                <ArrowUpRight className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="mt-2 text-xl font-bold tracking-tight text-emerald-600 sm:text-2xl">
              {isLoading ? '...' : formatCurrency(monthlyIncome)}
            </div>
          </CardMotion>
        </StaggerItem>

        {/* Monthly Expenses */}
        <StaggerItem>
          <CardMotion className="rounded-xl border border-neutral-200/80 bg-white p-3.5 sm:p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                Month Expense
              </span>
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-rose-50 text-rose-600">
                <ArrowDownRight className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="mt-2 text-xl font-bold tracking-tight text-neutral-900 sm:text-2xl">
              {isLoading ? '...' : formatCurrency(monthlyExpense)}
            </div>
          </CardMotion>
        </StaggerItem>

        {/* Net Savings */}
        <StaggerItem>
          <CardMotion className="rounded-xl border border-neutral-200/80 bg-white p-3.5 sm:p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                Net Savings
              </span>
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-neutral-100 text-neutral-800">
                <PiggyBank className="h-3.5 w-3.5" />
              </div>
            </div>
            <div
              className={`mt-2 text-xl font-bold tracking-tight sm:text-2xl ${
                netSavings >= 0 ? 'text-neutral-900' : 'text-rose-600'
              }`}
            >
              {isLoading ? '...' : formatCurrency(netSavings)}
            </div>
            <div className="mt-1 flex items-center justify-between text-[10px] sm:text-[11px] text-neutral-400">
              <span>{savingsRate >= 0 ? `${savingsRate}% saved` : 'Deficit'}</span>
              {pendingMilkAmount > 0 && (
                <span className="text-amber-700 font-medium">
                  -₹{pendingMilkAmount} milk
                </span>
              )}
            </div>
          </CardMotion>
        </StaggerItem>
      </StaggerContainer>
    </div>
  );
}
