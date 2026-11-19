'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Store, Printer, Users, RefreshCw, Radio, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/lib/queries/keys';
import { formatCurrency } from '@/lib/utils';
import { CardMotion, StaggerContainer, StaggerItem } from '@/components/animations/MotionWrapper';

interface FundItem {
  name: string;
  source: string;
  amount: number;
  bankAmount?: number;
  cashAmount?: number;
  bankBalance?: number;
  cashBalance?: number;
  breakdown?: string;
  status: 'live' | 'placeholder' | 'error';
  updatedAt: string;
  cell?: string;
  table?: string;
  collection?: string;
  details?: string;
  error?: string | null;
}

interface FundsApiResponse {
  roomFund: FundItem;
  itLabFund: FundItem;
  storeFund: FundItem;
  timestamp: string;
}

export function ExternalLiveFunds() {
  const [data, setData] = useState<FundsApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const queryClient = useQueryClient();

  const fetchFunds = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch(`/api/funds?t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
        },
      });
      if (res.ok) {
        const json: FundsApiResponse = await res.json();
        setData(json);
      }
    } catch (err: any) {
      console.error('Failed to sync external funds:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  const handleRefresh = async () => {
    try {
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.externalFunds });
    } catch {}
    await fetchFunds();
  };

  useEffect(() => {
    fetchFunds();
  }, [fetchFunds]);

  return (
    <div className="rounded-xl border border-neutral-200/80 bg-white p-3.5 sm:p-4 shadow-xs">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
        <div className="flex items-center gap-2">
          <Radio className="h-3.5 w-3.5 text-emerald-600 animate-pulse" />
          <h2 className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-neutral-600">
            External Live Funds
          </h2>
          <span className="hidden sm:inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
            Direct DB & Sheets
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] sm:text-[11px] text-neutral-400">
            {data ? `Synced ${data.roomFund.updatedAt}` : 'Connecting...'}
          </span>
          <motion.button
            type="button"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex h-6 w-6 items-center justify-center rounded-md border border-neutral-200 text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900 transition-colors disabled:opacity-40"
            title="Refresh live external balances"
          >
            <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
          </motion.button>
        </div>
      </div>

      {/* 3 Fund Cards */}
      <StaggerContainer className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        {/* 1. ROOM FUND: GOOGLE SHEET CSV CELL B19 */}
        <StaggerItem>
          <CardMotion
            className={`rounded-lg border p-3 transition-colors ${
              data?.roomFund.status === 'error'
                ? 'border-red-200 bg-red-50/30'
                : data?.roomFund.status === 'live'
                ? 'border-emerald-200/70 bg-emerald-50/20'
                : 'border-neutral-100 bg-neutral-50/60'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-neutral-700">Room Fund</span>
              <Users className="h-3.5 w-3.5 text-neutral-400 stroke-[1.8]" />
            </div>

            <div className="mt-1.5 text-lg sm:text-xl font-bold tracking-tight text-neutral-900">
              {isLoading
                ? '...'
                : data?.roomFund.status === 'error'
                ? 'Error'
                : formatCurrency(data?.roomFund.amount || 0)}
            </div>

            <div className="mt-1 flex items-center justify-between text-[10px] text-neutral-400">
              <span className="truncate max-w-[150px]">{data?.roomFund.source}</span>
              {data?.roomFund.status === 'live' ? (
                <span className="text-emerald-700 font-medium">● Cell B19</span>
              ) : data?.roomFund.status === 'error' ? (
                <span className="text-red-600 font-medium flex items-center gap-0.5">
                  <AlertCircle className="h-2.5 w-2.5" /> Fail
                </span>
              ) : (
                <span>Syncing</span>
              )}
            </div>
          </CardMotion>
        </StaggerItem>

        {/* 2. IT LAB PRINT FUND: LAB SUPABASE 'CASH IN HAND' */}
        <StaggerItem>
          <CardMotion
            className={`rounded-lg border p-3 transition-colors ${
              data?.itLabFund.status === 'error'
                ? 'border-red-200 bg-red-50/30'
                : data?.itLabFund.status === 'live'
                ? 'border-emerald-200/70 bg-emerald-50/20'
                : 'border-neutral-100 bg-neutral-50/60'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-neutral-700">IT Lab Print Fund</span>
              <Printer className="h-3.5 w-3.5 text-neutral-400 stroke-[1.8]" />
            </div>

            <div className="mt-1.5 text-lg sm:text-xl font-bold tracking-tight text-neutral-900">
              {isLoading
                ? '...'
                : data?.itLabFund.status === 'error'
                ? 'Error'
                : formatCurrency(data?.itLabFund.amount || 0)}
            </div>

            <div className="mt-1 flex items-center justify-between text-[10px] text-neutral-400">
              <span className="truncate max-w-[150px]">{data?.itLabFund.source}</span>
              {data?.itLabFund.status === 'live' ? (
                <span className="text-emerald-700 font-medium">● Supabase</span>
              ) : (
                <span>Syncing</span>
              )}
            </div>
          </CardMotion>
        </StaggerItem>

        {/* 3. STORE FUND: MONGODB JOURNAL ENTRIES (BANK + CASH) */}
        <StaggerItem>
          <CardMotion
            className={`rounded-lg border p-3 transition-colors ${
              data?.storeFund.status === 'error'
                ? 'border-red-200 bg-red-50/30'
                : data?.storeFund.status === 'live'
                ? 'border-emerald-200/70 bg-emerald-50/20'
                : 'border-neutral-100 bg-neutral-50/60'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-neutral-700">Store Fund</span>
              <Store className="h-3.5 w-3.5 text-neutral-400 stroke-[1.8]" />
            </div>

            <div className="mt-1.5 text-lg sm:text-xl font-bold tracking-tight text-neutral-900">
              {isLoading
                ? '...'
                : data?.storeFund.status === 'error'
                ? 'Error'
                : formatCurrency(data?.storeFund.amount || 0)}
            </div>

            <div className="mt-1 flex items-center justify-between text-[10px] text-neutral-400">
              <span
                className="truncate max-w-[150px] font-medium text-neutral-500"
                title={data?.storeFund.breakdown || data?.storeFund.source}
              >
                {data?.storeFund.breakdown || data?.storeFund.source}
              </span>
              {data?.storeFund.status === 'live' ? (
                <span className="text-emerald-700 font-medium">● Journal Entries</span>
              ) : (
                <span>Syncing</span>
              )}
            </div>
          </CardMotion>
        </StaggerItem>
      </StaggerContainer>
    </div>
  );
}
