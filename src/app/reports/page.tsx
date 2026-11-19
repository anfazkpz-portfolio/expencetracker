'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  PiggyBank,
  Calendar,
  Filter,
  BarChart3,
  PieChart as PieIcon,
  RefreshCw,
} from 'lucide-react';
import { motion } from 'framer-motion';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import {
  useTransactions,
  useSwiggyIncomes,
  useDailyMilkLogs,
} from '@/lib/queries/hooks';
import { formatCurrency } from '@/lib/utils';
import {
  PageTransition,
  StaggerContainer,
  StaggerItem,
  CardMotion,
} from '@/components/animations/MotionWrapper';
import type { Transaction, SwiggyIncome, DailyMilkLog } from '@/types/database';

export default function ReportsPage() {
  const { data: transactions = [], isLoading: txsLoading, isFetching: txsFetching, refetch: refetchTxs } = useTransactions(250);
  const { data: swiggyIncomes = [], isLoading: swiggyLoading, isFetching: swiggyFetching, refetch: refetchSwiggy } = useSwiggyIncomes(100);
  const { data: milkLogs = [], isLoading: milkLoading, isFetching: milkFetching, refetch: refetchMilk } = useDailyMilkLogs(90);

  const isLoading = (txsLoading || swiggyLoading || milkLoading) && transactions.length === 0;
  const isRefreshing = txsFetching || swiggyFetching || milkFetching;

  const handleRefresh = async () => {
    await Promise.all([refetchTxs(), refetchSwiggy(), refetchMilk()]);
  };

  const [selectedPeriod, setSelectedPeriod] = useState<
    'current_month' | 'last_month' | 'all'
  >('current_month');

  // Date filtering logic
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

  const filterByPeriod = useCallback(
    (dateStr: string) => {
      if (selectedPeriod === 'all') return true;
      const d = new Date(dateStr);
      if (selectedPeriod === 'current_month') {
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      }
      if (selectedPeriod === 'last_month') {
        return d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear;
      }
      return true;
    },
    [selectedPeriod, currentMonth, currentYear, lastMonth, lastMonthYear]
  );

  // Filtered collections
  const filteredTxs = useMemo(
    () => transactions.filter((t) => filterByPeriod(t.date)),
    [transactions, filterByPeriod]
  );
  const filteredSwiggy = useMemo(
    () => swiggyIncomes.filter((s) => filterByPeriod(s.date)),
    [swiggyIncomes, filterByPeriod]
  );
  const filteredMilk = useMemo(
    () => milkLogs.filter((m) => filterByPeriod(m.date)),
    [milkLogs, filterByPeriod]
  );

  // Calculations
  const txIncome = filteredTxs
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const swiggyNet = filteredSwiggy.reduce(
    (sum, s) =>
      sum +
      (Number(s.gross_amount || 0) -
        Number(s.deduction_amount || 0) -
        Number(s.fuel_expense || 0)),
    0
  );

  const totalIncome = txIncome + swiggyNet;

  const txExpense = filteredTxs
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  // Note: if user settled milk via transactions, it is already counted in txExpense.
  // We only add unsettled or direct logs if they aren't in txExpense yet.
  const totalExpense = txExpense;
  const totalSavings = totalIncome - totalExpense;
  const savingsRate =
    totalIncome > 0 ? Math.round((totalSavings / totalIncome) * 100) : 0;

  // Category Breakdown Data (Expenses)
  const categoryMap: Record<string, number> = {};
  filteredTxs
    .filter((t) => t.type === 'expense')
    .forEach((t) => {
      categoryMap[t.category] = (categoryMap[t.category] || 0) + Number(t.amount);
    });

  const categoryData = Object.entries(categoryMap)
    .map(([name, amount]) => ({
      name,
      amount,
      percentage:
        totalExpense > 0 ? Math.round((amount / totalExpense) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  return (
    <PageTransition className="space-y-4 sm:space-y-5">
      {/* Header & Period Filter */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between border-b border-neutral-100 pb-3">
        <div>
          <h1 className="text-sm font-semibold tracking-tight text-neutral-900 sm:text-base">
            Financial Reports & Analytics
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl border border-neutral-200/80 bg-neutral-100/80 p-1">
            <button
              type="button"
              onClick={() => setSelectedPeriod('current_month')}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                selectedPeriod === 'current_month'
                  ? 'bg-white text-neutral-900 shadow-2xs font-semibold'
                  : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              This Month
            </button>
            <button
              type="button"
              onClick={() => setSelectedPeriod('last_month')}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                selectedPeriod === 'last_month'
                  ? 'bg-white text-neutral-900 shadow-2xs font-semibold'
                  : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              Last Month
            </button>
            <button
              type="button"
              onClick={() => setSelectedPeriod('all')}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                selectedPeriod === 'all'
                  ? 'bg-white text-neutral-900 shadow-2xs font-semibold'
                  : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              All Time
            </button>
          </div>

          <motion.button
            type="button"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-500 hover:bg-neutral-50 transition-colors shadow-2xs"
            title="Refresh"
          >
            <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
          </motion.button>
        </div>
      </div>

      {/* Prominent Monthly Summary Cards */}
      <StaggerContainer className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        {/* Total Income */}
        <StaggerItem>
          <CardMotion className="rounded-xl border border-neutral-200/80 bg-white p-3.5 sm:p-4 shadow-xs">
            <div className="flex items-center justify-between text-neutral-500">
              <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                Total Income
              </span>
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-50 text-emerald-600">
                <ArrowUpRight className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="mt-1.5 text-xl font-bold tracking-tight text-neutral-900 sm:text-2xl">
              {isLoading ? '...' : formatCurrency(totalIncome)}
            </div>
            <div className="mt-1 flex items-center justify-between text-[10px] sm:text-[11px] text-neutral-400">
              <span>Direct {formatCurrency(txIncome)}</span>
              <span>Swiggy {formatCurrency(swiggyNet)}</span>
            </div>
          </CardMotion>
        </StaggerItem>

        {/* Total Expense */}
        <StaggerItem>
          <CardMotion className="rounded-xl border border-neutral-200/80 bg-white p-3.5 sm:p-4 shadow-xs">
            <div className="flex items-center justify-between text-neutral-500">
              <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                Total Expense
              </span>
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-rose-50 text-rose-600">
                <ArrowDownRight className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="mt-1.5 text-xl font-bold tracking-tight text-neutral-900 sm:text-2xl">
              {isLoading ? '...' : formatCurrency(totalExpense)}
            </div>
            <div className="mt-1 text-[10px] sm:text-[11px] text-neutral-400">
              All spending & settled payments
            </div>
          </CardMotion>
        </StaggerItem>

        {/* PROMINENTLY HIGHLIGHTED: Total Savings */}
        <StaggerItem>
          <CardMotion className="relative overflow-hidden rounded-xl border-2 border-neutral-900 bg-white p-3.5 sm:p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-neutral-900">
                Total Savings
              </span>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                {savingsRate}% saved
              </span>
            </div>
            <div
              className={`mt-1.5 text-2xl sm:text-3xl font-extrabold tracking-tight ${
                totalSavings >= 0 ? 'text-neutral-900' : 'text-rose-600'
              }`}
            >
              {isLoading ? '...' : formatCurrency(totalSavings)}
            </div>
            <div className="mt-1 text-[10px] sm:text-[11px] text-neutral-500">
              Net retained cash in pocket
            </div>
          </CardMotion>
        </StaggerItem>
      </StaggerContainer>

      {/* Graphical Representations: Chart Section */}
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        {/* Chart 1: Income vs Expense vs Savings Comparison */}
        <div className="rounded-xl border border-neutral-200/80 bg-white p-3.5 sm:p-4 shadow-xs">
          <div className="mb-3 flex items-center justify-between border-b border-neutral-100 pb-2.5">
            <div className="flex items-center gap-1.5">
              <BarChart3 className="h-3.5 w-3.5 text-neutral-600" />
              <h2 className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-neutral-600">
                Income vs Expense vs Savings
              </h2>
            </div>
            <span className="text-[10px] text-neutral-400 capitalize">
              {selectedPeriod.replace('_', ' ')}
            </span>
          </div>

          <div className="h-56 sm:h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[
                  { name: 'Income', amount: totalIncome, fill: '#10b981' },
                  { name: 'Expense', amount: totalExpense, fill: '#71717a' },
                  {
                    name: 'Savings',
                    amount: Math.max(0, totalSavings),
                    fill: '#09090b',
                  },
                ]}
                margin={{ top: 15, right: 10, left: -10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f5" />
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  axisLine={{ stroke: '#f0f0f0' }}
                  tick={{ fill: '#737373', fontSize: 11 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={{ stroke: '#f0f0f0' }}
                  tick={{ fill: '#737373', fontSize: 10 }}
                  tickFormatter={(val) => `₹${val}`}
                />
                <Tooltip
                  formatter={(value: any) => [formatCurrency(Number(value)), 'Amount']}
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderRadius: '10px',
                    border: '1px solid #e5e5e5',
                    fontSize: '11px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                  }}
                />
                <Bar dataKey="amount" radius={[6, 6, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-2.5 flex items-center justify-center gap-5 text-[10px] text-neutral-500">
            <div className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-xs bg-emerald-500" />
              <span>Income</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-xs bg-neutral-500" />
              <span>Expense</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-xs bg-neutral-900" />
              <span>Savings</span>
            </div>
          </div>
        </div>

        {/* Chart 2: Category Expense Breakdown */}
        <div className="rounded-xl border border-neutral-200/80 bg-white p-3.5 sm:p-4 shadow-xs">
          <div className="mb-3 flex items-center justify-between border-b border-neutral-100 pb-2.5">
            <div className="flex items-center gap-1.5">
              <PieIcon className="h-3.5 w-3.5 text-neutral-600" />
              <h2 className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-neutral-600">
                Expense by Category
              </h2>
            </div>
            <span className="text-[10px] text-neutral-400">
              {categoryData.length} categories
            </span>
          </div>

          {categoryData.length === 0 ? (
            <div className="flex h-56 sm:h-64 items-center justify-center text-xs text-neutral-400">
              No expenses recorded for this period.
            </div>
          ) : (
            <div className="h-56 sm:h-64 overflow-y-auto space-y-2.5 pr-1">
              {categoryData.map((cat) => (
                <div key={cat.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-neutral-800">{cat.name}</span>
                    <span className="font-semibold text-neutral-900">
                      {formatCurrency(cat.amount)}{' '}
                      <span className="text-[10px] font-normal text-neutral-400">
                        ({cat.percentage}%)
                      </span>
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-neutral-100 overflow-hidden">
                    <div
                      className="h-full bg-neutral-900 rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(100, Math.max(4, cat.percentage))}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </PageTransition>
  );
}
