'use client';

import React, { useMemo } from 'react';
import {
  Wallet,
  Users,
  Printer,
  Store,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Layers,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { useTransactions, useSwiggyIncomes, useExternalFunds } from '@/lib/queries/hooks';
import { QUERY_KEYS } from '@/lib/queries/keys';
import { formatCurrency, parseCurrencyToNumber } from '@/lib/utils';
import { CardMotion } from '@/components/animations/MotionWrapper';
import { clearAllOfflineData } from '@/lib/offline/db';

interface BalanceBreakdown {
  mainBalance: number;
  roomFund: number;
  itLabFund: number;
  storeFund: number;
  grandTotal: number;
  roomFundRaw?: any;
  itLabFundRaw?: any;
  storeFundRaw?: any;
}

export function GrandTotalCashWidget() {
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
    data: fundsRes,
    isLoading: fundsLoading,
    isFetching: fundsFetching,
    refetch: refetchFunds,
    dataUpdatedAt,
  } = useExternalFunds();

  const isLoading = (txsLoading || swiggyLoading || fundsLoading) && !fundsRes && txs.length === 0;
  const isRefreshing = txsFetching || swiggyFetching || fundsFetching;

  const balances: BalanceBreakdown = useMemo(() => {
    // 1. Calculate Main App Balance
    const txIncome = txs
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);

    const swiggyNet = swiggy.reduce(
      (sum, s) =>
        sum +
        (Number(s.gross_amount || 0) -
          Number(s.deduction_amount || 0) -
          Number(s.fuel_expense || 0)),
      0
    );

    const totalIncome = txIncome + swiggyNet;

    const txExpense = txs
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);

    const mainBalance = totalIncome - txExpense;

    // 2. Parse external fund amounts (strip currency symbols and commas)
    const roomFund = parseCurrencyToNumber(fundsRes?.roomFund?.amount);
    const itLabFund = parseCurrencyToNumber(fundsRes?.itLabFund?.amount);
    const storeFund = parseCurrencyToNumber(fundsRes?.storeFund?.amount);

    // 3. Grand Total Sum
    const grandTotal = mainBalance + roomFund + itLabFund + storeFund;

    return {
      mainBalance,
      roomFund,
      itLabFund,
      storeFund,
      grandTotal,
      roomFundRaw: fundsRes?.roomFund?.amount,
      itLabFundRaw: fundsRes?.itLabFund?.amount,
      storeFundRaw: fundsRes?.storeFund?.amount,
    };
  }, [txs, swiggy, fundsRes]);

  const lastUpdated = useMemo(() => {
    if (!dataUpdatedAt) return '';
    return new Date(dataUpdatedAt).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  }, [dataUpdatedAt]);

  const queryClient = useQueryClient();

  const handleRefresh = async () => {
    // Clear offline cache and invalidate React Query cache to force bypass, then refetch all data fresh
    await clearAllOfflineData().catch(() => {});
    await Promise.all([
      queryClient.invalidateQueries(),
      refetchFunds(),
      refetchTxs(),
      refetchSwiggy(),
    ]);
  };

  return (
    <motion.div
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="relative overflow-hidden rounded-2xl border border-neutral-200/90 bg-gradient-to-b from-white via-white to-neutral-50/70 p-4 sm:p-6 shadow-sm"
    >
      {/* Subtle top accent gradient */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-neutral-900 via-emerald-500 to-neutral-900 opacity-90" />

      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-neutral-900 text-white shadow-2xs">
            <Layers className="h-3.5 w-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-neutral-900">
                Grand Total Cash
              </h2>
              <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200/60">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="hidden sm:inline-block text-[11px] text-neutral-400">
              Updated {lastUpdated}
            </span>
          )}
          <motion.button
            type="button"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-600 shadow-2xs hover:bg-neutral-50 hover:text-neutral-900 transition-colors disabled:opacity-40"
            title="Refresh Grand Total"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </motion.button>
        </div>
      </div>

      {/* Hero Grand Total Amount Display */}
      <div className="py-4 sm:py-5">
        <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-neutral-400">
          Total Liquid Net Worth
        </span>

        {isLoading ? (
          /* Shimmer Skeleton */
          <div className="mt-2 space-y-2">
            <div className="h-10 sm:h-12 w-56 sm:w-72 rounded-xl bg-neutral-200/70 animate-pulse" />
            <div className="h-4 w-40 rounded-md bg-neutral-100 animate-pulse" />
          </div>
        ) : (
          <div className="mt-1">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-neutral-950">
                {formatCurrency(balances.grandTotal)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 4 Contributing Sources Breakdown */}
      <div className="mt-1 pt-3 border-t border-neutral-100">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 block mb-2">
          Repository Breakdown
        </span>

        {isLoading ? (
          /* Breakdown skeleton */
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-16 rounded-xl bg-neutral-100/80 animate-pulse border border-neutral-200/50"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {/* 1. Main Application Cash Balance */}
            <CardMotion className="rounded-xl border border-neutral-200/80 bg-white p-2.5 sm:p-3 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium text-neutral-500 truncate">
                  Main Cash
                </span>
                <Wallet className="h-3 w-3 text-neutral-400" />
              </div>
              <div className="mt-1 text-sm sm:text-base font-bold text-neutral-900 tracking-tight">
                {formatCurrency(balances.mainBalance)}
              </div>
              <span className="text-[9px] text-neutral-400 block truncate">
                Liquid Balance
              </span>
            </CardMotion>

            {/* 2. Room Fund (Google Sheet Cell B19) */}
            <CardMotion className="rounded-xl border border-neutral-200/80 bg-white p-2.5 sm:p-3 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium text-neutral-500 truncate">
                  Room Fund
                </span>
                <Users className="h-3 w-3 text-neutral-400" />
              </div>
              <div className="mt-1 text-sm sm:text-base font-bold text-neutral-900 tracking-tight">
                {formatCurrency(balances.roomFund)}
              </div>
              <span className="text-[9px] text-emerald-600 font-medium block truncate">
                Sheet Cell B19
              </span>
            </CardMotion>

            {/* 3. IT Lab Print Fund (Supabase) */}
            <CardMotion className="rounded-xl border border-neutral-200/80 bg-white p-2.5 sm:p-3 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium text-neutral-500 truncate">
                  IT Lab Fund
                </span>
                <Printer className="h-3 w-3 text-neutral-400" />
              </div>
              <div className="mt-1 text-sm sm:text-base font-bold text-neutral-900 tracking-tight">
                {formatCurrency(balances.itLabFund)}
              </div>
              <span className="text-[9px] text-emerald-600 font-medium block truncate" title="Cash in Hand (In-Charge)">
                Cash in Hand
              </span>
            </CardMotion>

            {/* 4. Store Fund (MongoDB Trial Balance) */}
            <CardMotion className="rounded-xl border border-neutral-200/80 bg-white p-2.5 sm:p-3 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium text-neutral-500 truncate">
                  Store Fund
                </span>
                <Store className="h-3 w-3 text-neutral-400" />
              </div>
              <div className="mt-1 text-sm sm:text-base font-bold text-neutral-900 tracking-tight">
                {formatCurrency(balances.storeFund)}
              </div>
              <span
                className="text-[9px] text-emerald-600 font-semibold block truncate"
                title={
                  fundsRes?.storeFund?.breakdown ||
                  (fundsRes?.storeFund?.cashBalance !== undefined && fundsRes?.storeFund?.bankBalance !== undefined
                    ? `Cash: ${formatCurrency(fundsRes.storeFund.cashBalance)} | Bank: ${formatCurrency(fundsRes.storeFund.bankBalance)}`
                    : 'MongoDB (Cash + Bank)')
                }
              >
                {fundsRes?.storeFund?.breakdown ||
                  (fundsRes?.storeFund?.cashBalance !== undefined && fundsRes?.storeFund?.bankBalance !== undefined
                    ? `Cash: ${formatCurrency(fundsRes.storeFund.cashBalance)} | Bank: ${formatCurrency(fundsRes.storeFund.bankBalance)}`
                    : 'MongoDB (Cash + Bank)')}
              </span>
            </CardMotion>
          </div>
        )}
      </div>
    </motion.div>
  );
}

