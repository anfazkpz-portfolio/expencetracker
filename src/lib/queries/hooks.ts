'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from './keys';
import { invalidateFinanceQueries, type InvalidationScope } from './invalidation';
import {
  fetchTransactions,
  fetchDebts,
  fetchSwiggyIncomes,
  fetchDailyMilkLogs,
  getPendingMilkBill,
  fetchMilkPayments,
  DebtWithPaid,
} from '@/lib/supabase/api';
import {
  getMilkSubscriptionSettings,
  pauseMilkSubscription,
  resumeMilkSubscription,
  runMilkAutoBackfill,
  getDefaultMilkSettings,
  type MilkSubscriptionSettings,
} from '@/lib/milk/milkSubscription';

import { fetchLedgerOverview, getLedgerContacts } from '@/lib/ledger/ledgerManager';
import type { Transaction, SwiggyIncome, DailyMilkLog } from '@/types/database';
import type { LedgerOverview, LedgerContact } from '@/types/ledger';

/**
 * 1. Transactions Hook
 * Caches transaction lists in memory. 
 * Re-renders and page navigation read strictly from cache with zero DB hits.
 */
export function useTransactions(limit = 150) {
  return useQuery<Transaction[]>({
    queryKey: QUERY_KEYS.transactions(limit),
    queryFn: () => fetchTransactions(limit),
  });
}

/**
 * 2. Swiggy Payouts Hook
 */
export function useSwiggyIncomes(limit = 100) {
  return useQuery<SwiggyIncome[]>({
    queryKey: QUERY_KEYS.swiggy(limit),
    queryFn: () => fetchSwiggyIncomes(limit),
  });
}

/**
 * 3. Debts & Dues Hook
 */
export function useDebts(limit = 150) {
  return useQuery<DebtWithPaid[]>({
    queryKey: QUERY_KEYS.debts(limit),
    queryFn: () => fetchDebts(limit),
  });
}

/**
 * 4. Ledger Overview Hook (Person / Account Ledger)
 */
export function useLedgerOverview() {
  return useQuery<LedgerOverview>({
    queryKey: QUERY_KEYS.ledger,
    queryFn: () => fetchLedgerOverview(),
  });
}

/**
 * 5. Ledger Contacts Registry
 */
export function useLedgerContacts() {
  return useQuery<LedgerContact[]>({
    queryKey: QUERY_KEYS.ledgerContacts,
    queryFn: () => getLedgerContacts(),
  });
}

/**
 * 6. Daily Milk Logs Hook
 */
export function useDailyMilkLogs(limit = 90) {
  return useQuery<DailyMilkLog[]>({
    queryKey: QUERY_KEYS.milkLogs(limit),
    queryFn: () => fetchDailyMilkLogs(limit),
  });
}

/**
 * 7. Pending Milk Bill Dynamic Summary Hook
 */
export function usePendingMilkBill() {
  return useQuery({
    queryKey: QUERY_KEYS.milkPending,
    queryFn: () => getPendingMilkBill(),
  });
}

/**
 * 8. Milk Payment History Hook
 * Returns all 'Milk Bill' expense transactions sorted newest-first.
 */
export function useMilkPayments() {
  return useQuery<Transaction[]>({
    queryKey: QUERY_KEYS.milkPayments,
    queryFn: () => fetchMilkPayments(),
  });
}

/**
 * 9. Milk Subscription State & Control Hook
 */
export function useMilkSubscription() {
  const queryClient = useQueryClient();

  const query = useQuery<MilkSubscriptionSettings>({
    queryKey: QUERY_KEYS.milkSubscription,
    queryFn: () => getMilkSubscriptionSettings(),
  });

  const pauseMutation = useMutation({
    mutationFn: () => pauseMilkSubscription(),
    onSuccess: (data) => {
      queryClient.setQueryData(QUERY_KEYS.milkSubscription, data);
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.milkLogsRoot });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.milkPendingRoot });
    },
  });

  const resumeMutation = useMutation({
    mutationFn: () => resumeMilkSubscription(),
    onSuccess: (data) => {
      queryClient.setQueryData(QUERY_KEYS.milkSubscription, data);
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.milkLogsRoot });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.milkPendingRoot });
    },
  });

  const backfillMutation = useMutation({
    mutationFn: () => runMilkAutoBackfill(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.milkLogsRoot });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.milkPendingRoot });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.milkSubscription });
    },
  });

  return {
    ...query,
    settings: query.data || getDefaultMilkSettings(),
    pause: pauseMutation.mutateAsync,
    resume: resumeMutation.mutateAsync,
    runBackfill: backfillMutation.mutateAsync,
    isPausing: pauseMutation.isPending,
    isResuming: resumeMutation.isPending,
    isBackfilling: backfillMutation.isPending,
  };
}

export interface ExternalFundsResponse {
  roomFund?: {
    accountName: string;
    amount: string | number;
    error?: string;
  };
  itLabFund?: {
    accountName: string;
    amount: string | number;
    error?: string;
  };
  storeFund?: {
    accountName: string;
    amount: string | number;
    bankAmount?: number;
    cashAmount?: number;
    bankBalance?: number;
    cashBalance?: number;
    breakdown?: string;
    error?: string;
  };
}

/**
 * 8. Live External Funds Hook (Google Sheets, Supabase, MongoDB)
 * Protects external databases and APIs from redundant hits.
 * Served directly from cache across page navigation.
 */
export function useExternalFunds() {
  return useQuery<ExternalFundsResponse>({
    queryKey: QUERY_KEYS.externalFunds,
    queryFn: async () => {
      const res = await fetch(`/api/funds?t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
        },
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch external funds (${res.status})`);
      }
      return res.json();
    },
    // External APIs (Google Sheets, MongoDB, external Supabase) can be cached safely across page transitions
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * 9. Invalidation Hook for React components
 */
export function useInvalidateFinance() {
  const queryClient = useQueryClient();

  return (scope: InvalidationScope = 'all') => {
    invalidateFinanceQueries(scope);
  };
}
