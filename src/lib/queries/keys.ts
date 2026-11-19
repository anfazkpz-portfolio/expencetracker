/**
 * React Query Keys for Intelligent Caching
 */

export const QUERY_KEYS = {
  transactions: (limit?: number) => ['transactions', limit ? { limit } : 'all'] as const,
  transactionsRoot: ['transactions'] as const,

  debts: (limit?: number) => ['debts', limit ? { limit } : 'all'] as const,
  debtsRoot: ['debts'] as const,

  ledger: ['ledger-overview'] as const,
  ledgerRoot: ['ledger-overview'] as const,

  ledgerContacts: ['ledger-contacts'] as const,

  swiggy: (limit?: number) => ['swiggy', limit ? { limit } : 'all'] as const,
  swiggyRoot: ['swiggy'] as const,

  milkLogs: (limit?: number) => ['milk-logs', limit ? { limit } : 'all'] as const,
  milkLogsRoot: ['milk-logs'] as const,

  milkPending: ['milk-pending'] as const,
  milkPendingRoot: ['milk-pending'] as const,

  milkPayments: ['milk-payments'] as const,
  milkPaymentsRoot: ['milk-payments'] as const,

  milkSubscription: ['milk-subscription'] as const,
  milkSubscriptionRoot: ['milk-subscription'] as const,

  externalFunds: ['external-funds'] as const,
  externalFundsRoot: ['external-funds'] as const,
} as const;
