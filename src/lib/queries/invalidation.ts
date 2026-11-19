/**
 * Smart Cache Invalidation Manager
 * Only hits the database when an actual mutation (add, edit, delete, settle) takes place.
 */

import { getQueryClient } from '@/providers/QueryProvider';
import { QUERY_KEYS } from './keys';

export type InvalidationScope =
  | 'all'
  | 'transactions'
  | 'debts'
  | 'ledger'
  | 'milk'
  | 'swiggy'
  | 'funds';

export function invalidateFinanceQueries(scope: InvalidationScope = 'all') {
  if (typeof window === 'undefined') return;

  const qc = getQueryClient();
  if (!qc) return;

  switch (scope) {
    case 'transactions':
      qc.invalidateQueries({ queryKey: QUERY_KEYS.transactionsRoot });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.ledgerRoot });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.milkPendingRoot });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.debtsRoot });
      break;

    case 'debts':
    case 'ledger':
      qc.invalidateQueries({ queryKey: QUERY_KEYS.debtsRoot });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.ledgerRoot });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.ledgerContacts });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.transactionsRoot });
      break;

    case 'milk':
      qc.invalidateQueries({ queryKey: QUERY_KEYS.milkLogsRoot });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.milkPendingRoot });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.milkPaymentsRoot });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.transactionsRoot });
      break;

    case 'swiggy':
      qc.invalidateQueries({ queryKey: QUERY_KEYS.swiggyRoot });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.transactionsRoot });
      break;

    case 'funds':
      qc.invalidateQueries({ queryKey: QUERY_KEYS.externalFundsRoot });
      break;

    case 'all':
    default:
      qc.invalidateQueries();
      break;
  }

  // Also broadcast for any standalone listeners
  window.dispatchEvent(
    new CustomEvent('cashmanager:refresh', { detail: { scope } })
  );
}
