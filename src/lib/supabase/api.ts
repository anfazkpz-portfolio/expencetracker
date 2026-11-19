import { supabase } from './client';
import type {
  Transaction,
  SwiggyIncome,
  DailyMilkLog,
  Debt,
  TransactionType,
  DebtType,
  DebtStatus,
  MilkLogStatus,
} from '@/types/database';
import {
  getCache,
  setCache,
  enqueueSync,
} from '@/lib/offline/db';
import { isDeviceOnline, emitSyncStatus } from '@/lib/offline/syncEngine';
import {
  getISTTodayDateString,
  runMilkAutoBackfill,
  toggleMilkDateStatus,
} from '@/lib/milk/milkSubscription';

export function getTodayDateString(): string {
  return getISTTodayDateString();
}

const CACHE_KEYS = {
  TRANSACTIONS: 'cache_transactions',
  SWIGGY: 'cache_swiggy_incomes',
  MILK_LOGS: 'cache_daily_milk_logs',
  MILK_PENDING: 'cache_milk_pending_summary',
  DEBTS: 'cache_debts',
};

// ---------------- TRANSACTIONS (LOCAL-FIRST & OPTIMISTIC) ----------------

export async function fetchTransactions(limit = 150): Promise<Transaction[]> {
  const cached = await getCache<Transaction[]>(CACHE_KEYS.TRANSACTIONS);

  if (isDeviceOnline()) {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(limit);

      if (!error && data) {
        await setCache(CACHE_KEYS.TRANSACTIONS, data);
        return data;
      }
    } catch (err) {
      console.warn('Network fetchTransactions failed, using local cache:', err);
    }
  }

  return cached || [];
}

export async function createTransaction(payload: {
  amount: number;
  type: TransactionType;
  category: string;
  date: string;
  description?: string;
}): Promise<{ data: Transaction | null; error: Error | null }> {
  const optimisticId = `opt_tx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const optimisticTx: Transaction = {
    id: optimisticId,
    amount: payload.amount,
    type: payload.type,
    category: payload.category.trim(),
    date: payload.date || getTodayDateString(),
    description: payload.description?.trim() || null,
    created_at: new Date().toISOString(),
  };

  // 1. Optimistic UI: Write to local cache immediately
  const existing = (await getCache<Transaction[]>(CACHE_KEYS.TRANSACTIONS)) || [];
  const updatedCache = [optimisticTx, ...existing];
  await setCache(CACHE_KEYS.TRANSACTIONS, updatedCache);

  // Notify UI immediately (0ms response time!)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('cashmanager:refresh'));
  }

  // 2. If online, send to Supabase; otherwise enqueue for offline sync
  if (isDeviceOnline()) {
    (async () => {
      try {
        const { data, error } = await supabase
          .from('transactions')
          .insert([
            {
              amount: payload.amount,
              type: payload.type,
              category: payload.category.trim(),
              date: payload.date || getTodayDateString(),
              description: payload.description?.trim() || null,
            },
          ])
          .select()
          .single();

        if (data && !error) {
          // Replace optimistic item in cache with real database record
          const current = (await getCache<Transaction[]>(CACHE_KEYS.TRANSACTIONS)) || [];
          const replaced = current.map((t) => (t.id === optimisticId ? data : t));
          await setCache(CACHE_KEYS.TRANSACTIONS, replaced);
        } else if (error) {
          throw error;
        }
      } catch (err) {
        console.warn('Network send failed, enqueuing to offline sync:', err);
        await enqueueSync('CREATE_TRANSACTION', {
          amount: payload.amount,
          type: payload.type,
          category: payload.category.trim(),
          date: payload.date || getTodayDateString(),
          description: payload.description?.trim() || null,
        });
        await emitSyncStatus();
      }
    })();
  } else {
    // Offline: queue mutation for background sync
    await enqueueSync('CREATE_TRANSACTION', {
      amount: payload.amount,
      type: payload.type,
      category: payload.category.trim(),
      date: payload.date || getTodayDateString(),
      description: payload.description?.trim() || null,
    });
    await emitSyncStatus();
  }

  return { data: optimisticTx, error: null };
}

export async function deleteTransaction(id: string): Promise<boolean> {
  // 1. Optimistic removal from cache
  const cached = (await getCache<Transaction[]>(CACHE_KEYS.TRANSACTIONS)) || [];
  const filtered = cached.filter((t) => t.id !== id);
  await setCache(CACHE_KEYS.TRANSACTIONS, filtered);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('cashmanager:refresh'));
  }

  // 2. Sync to server or enqueue
  if (isDeviceOnline() && !id.startsWith('opt_')) {
    try {
      const { error } = await supabase.from('transactions').delete().eq('id', id);
      if (error) throw error;
      return true;
    } catch (err) {
      console.warn('Delete transaction failed, queueing offline:', err);
      await enqueueSync('DELETE_TRANSACTION', { id });
      await emitSyncStatus();
    }
  } else if (!id.startsWith('opt_')) {
    await enqueueSync('DELETE_TRANSACTION', { id });
    await emitSyncStatus();
  }

  return true;
}

// ---------------- SWIGGY INCOME (LOCAL-FIRST) ----------------

export async function fetchSwiggyIncomes(limit = 100): Promise<SwiggyIncome[]> {
  const cached = await getCache<SwiggyIncome[]>(CACHE_KEYS.SWIGGY);

  if (isDeviceOnline()) {
    try {
      const { data, error } = await supabase
        .from('swiggy_income')
        .select('*')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(limit);

      if (!error && data) {
        const normalized: SwiggyIncome[] = data.map((s) => ({
          ...s,
          fuel_expense: Number(s.fuel_expense || 0),
          km_driven: Number(s.km_driven || 0),
          net_amount:
            Number(s.gross_amount) -
            Number(s.deduction_amount || 0) -
            Number(s.fuel_expense || 0),
        }));
        await setCache(CACHE_KEYS.SWIGGY, normalized);
        return normalized;
      }
    } catch (err) {
      console.warn('Network fetchSwiggyIncomes failed, using local cache:', err);
    }
  }

  return (cached || []).map((s) => ({
    ...s,
    fuel_expense: Number(s.fuel_expense || 0),
    km_driven: Number(s.km_driven || 0),
    net_amount:
      Number(s.gross_amount) -
      Number(s.deduction_amount || 0) -
      Number(s.fuel_expense || 0),
  }));
}

export async function createSwiggyIncome(payload: {
  date: string;
  gross_amount: number;
  deduction_amount: number;
  deduction_reason?: string;
  fuel_expense?: number;
  km_driven?: number;
}): Promise<{ data: SwiggyIncome | null; error: Error | null }> {
  const optimisticId = `opt_swiggy_${Date.now()}`;
  const gross = Number(payload.gross_amount || 0);
  const ded = Number(payload.deduction_amount || 0);
  const fuel = Number(payload.fuel_expense || 0);
  const km = Number(payload.km_driven || 0);
  const net = Math.max(0, gross - (ded + fuel));

  const optimistic: SwiggyIncome = {
    id: optimisticId,
    date: payload.date || getTodayDateString(),
    gross_amount: gross,
    deduction_amount: ded,
    deduction_reason: payload.deduction_reason?.trim() || null,
    fuel_expense: fuel,
    km_driven: km,
    net_amount: net,
    created_at: new Date().toISOString(),
  };

  const cached = (await getCache<SwiggyIncome[]>(CACHE_KEYS.SWIGGY)) || [];
  await setCache(CACHE_KEYS.SWIGGY, [optimistic, ...cached]);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('cashmanager:refresh'));
  }

  const { data, error } = await supabase
    .from('swiggy_income')
    .insert([
      {
        date: payload.date || getTodayDateString(),
        gross_amount: gross,
        deduction_amount: ded,
        deduction_reason: payload.deduction_reason?.trim() || null,
        fuel_expense: fuel,
        km_driven: km,
      },
    ])
    .select()
    .single();

  const finalData = data
    ? {
        ...data,
        fuel_expense: Number(data.fuel_expense || fuel),
        km_driven: Number(data.km_driven || km),
        net_amount: net,
      }
    : optimistic;

  return { data: finalData, error: error ? new Error(error.message) : null };
}

export async function deleteSwiggyIncome(id: string): Promise<boolean> {
  const cached = (await getCache<SwiggyIncome[]>(CACHE_KEYS.SWIGGY)) || [];
  await setCache(CACHE_KEYS.SWIGGY, cached.filter((s) => s.id !== id));

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('cashmanager:refresh'));
  }

  const { error } = await supabase.from('swiggy_income').delete().eq('id', id);
  return !error;
}

// ---------------- DAILY MILK LOGS & DYNAMIC SETTLEMENT ----------------

export {
  runMilkAutoBackfill,
  toggleMilkDateStatus,
  getISTTodayDateString,
  getMilkSubscriptionSettings,
  pauseMilkSubscription,
  resumeMilkSubscription,
} from '@/lib/milk/milkSubscription';

export async function fetchDailyMilkLogs(limit = 90): Promise<DailyMilkLog[]> {
  const cached = await getCache<DailyMilkLog[]>(CACHE_KEYS.MILK_LOGS);

  if (isDeviceOnline()) {
    try {
      const { data, error } = await supabase
        .from('daily_milk_logs')
        .select('*')
        .order('date', { ascending: false })
        .limit(limit);

      if (!error && data) {
        await setCache(CACHE_KEYS.MILK_LOGS, data);
        return data;
      }
    } catch (err) {
      console.warn('Fetch milk logs error:', err);
    }
  }

  return cached || [];
}

export async function getTodayMilkLog(): Promise<DailyMilkLog | null> {
  const today = getTodayDateString();
  const logs = await fetchDailyMilkLogs(30);
  const found = logs.find((l) => l.date === today);
  if (found) return found;

  const { data } = await supabase
    .from('daily_milk_logs')
    .select('*')
    .eq('date', today)
    .maybeSingle();

  return data;
}

export async function ensureTodayMilkLog(defaultAmount = 14): Promise<DailyMilkLog | null> {
  const today = getTodayDateString();
  const existing = await getTodayMilkLog();
  if (existing) return existing;

  const { data } = await supabase
    .from('daily_milk_logs')
    .insert([
      {
        date: today,
        amount: defaultAmount,
        status: 'pending',
      },
    ])
    .select()
    .single();

  return data;
}

export async function setTodayMilkStatus(
  status: MilkLogStatus,
  amount = 14
): Promise<{ data: DailyMilkLog | null; error: Error | null }> {
  const today = getTodayDateString();
  try {
    await toggleMilkDateStatus(today, status);
    const updated = await getTodayMilkLog();
    return { data: updated, error: null };
  } catch (err: any) {
    return { data: null, error: err };
  }
}

export async function getPendingMilkBill(): Promise<{
  count: number;
  totalIncurred: number;
  totalSettled: number;
  pendingAmount: number;
  advanceCredit: number;
  totalAmount: number;
  logs: DailyMilkLog[];
}> {
  const cachedPending = await getCache<any>(CACHE_KEYS.MILK_PENDING);

  const calculateDynamic = async () => {
    try {
      // Fetch ALL-TIME logs and transactions (not month-scoped)
      const [logs, txs] = await Promise.all([
        fetchDailyMilkLogs(1000), // all-time
        fetchTransactions(1000),  // all-time
      ]);

      // Total incurred = sum of all delivered days (status !== 'skipped') × ₹14
      const deliveredLogs = logs.filter((l) => l.status !== 'skipped');
      const totalIncurred = deliveredLogs.reduce(
        (sum, item) => sum + Number(item.amount || 0),
        0
      );

      // Total settled = sum of ALL expense transactions with category 'Milk Bill'
      const milkTxs = txs.filter((t) => {
        if (t.type !== 'expense') return false;
        const cat = (t.category || '').trim().toLowerCase();
        return cat === 'milk bill' || cat.includes('milk');
      });
      const totalSettled = milkTxs.reduce(
        (sum, item) => sum + Number(item.amount || 0),
        0
      );

      // Running balance
      const net = totalIncurred - totalSettled;
      const pendingAmount = Math.max(0, net);           // amount still owed
      const advanceCredit = Math.max(0, -net);           // overpayment credit
      const pendingDaysCount = pendingAmount > 0 ? Math.ceil(pendingAmount / 14) : 0;

      const result = {
        count: pendingDaysCount,
        totalIncurred,
        totalSettled,
        pendingAmount,
        advanceCredit,
        totalAmount: pendingAmount,
        logs,
      };

      await setCache(CACHE_KEYS.MILK_PENDING, result);
      return result;
    } catch (err) {
      console.error('Error calculating pending milk bill:', err);
      return (
        cachedPending || {
          count: 0,
          totalIncurred: 0,
          totalSettled: 0,
          pendingAmount: 0,
          advanceCredit: 0,
          totalAmount: 0,
          logs: [],
        }
      );
    }
  };

  if (!isDeviceOnline() && cachedPending) {
    return cachedPending;
  }

  return await calculateDynamic();
}

export async function recordMilkPayment(
  amount: number,
  date?: string,
  note?: string
): Promise<{ success: boolean; data?: Transaction | null; error?: string }> {
  try {
    if (!amount || amount <= 0) {
      return { success: false, error: 'Please enter a valid payment amount.' };
    }

    const paymentDate = date || getTodayDateString();
    const { data, error } = await createTransaction({
      amount,
      type: 'expense',
      category: 'Milk Bill',
      date: paymentDate,
      description: note?.trim() || `Daily milk bill payment (${paymentDate})`,
    });

    if (error || !data) {
      throw error || new Error('Failed to record milk payment');
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cashmanager:refresh'));
    }

    return { success: true, data };
  } catch (err: any) {
    console.error('Milk payment error:', err);
    return { success: false, error: err?.message || 'Failed to record milk payment' };
  }
}

export async function settleMilkBill(customAmount?: number): Promise<{
  success: boolean;
  settledAmount: number;
  settledDays: number;
  error?: string;
}> {
  try {
    const { pendingAmount, count } = await getPendingMilkBill();
    const amountToPay = customAmount !== undefined ? customAmount : pendingAmount;

    if (amountToPay <= 0) {
      return {
        success: false,
        settledAmount: 0,
        settledDays: 0,
        error: 'No pending milk bill to settle.',
      };
    }

    const res = await recordMilkPayment(
      amountToPay,
      getTodayDateString(),
      `Settled milk bill payment (₹${amountToPay})`
    );

    if (!res.success) {
      throw new Error(res.error || 'Failed to record settlement payment');
    }

    return {
      success: true,
      settledAmount: amountToPay,
      settledDays: count,
    };
  } catch (err: any) {
    console.error('Settlement error:', err);
    return {
      success: false,
      settledAmount: 0,
      settledDays: 0,
      error: err?.message || 'Failed to settle milk bill',
    };
  }
}

/**
 * Fetch all Milk Bill payments (expense transactions with category 'Milk Bill')
 * Returns them sorted newest-first for the Payment History section.
 */
export async function fetchMilkPayments(): Promise<Transaction[]> {
  const allTxs = await fetchTransactions(1000);
  return allTxs.filter((t) => {
    if (t.type !== 'expense') return false;
    const cat = (t.category || '').trim().toLowerCase();
    return cat === 'milk bill' || cat.includes('milk');
  });
}

// ---------------- DEBTS & LOANS (LOCAL-FIRST & OPTIMISTIC) ----------------

export interface DebtWithPaid extends Debt {
  paid_amount: number;
  remaining_amount: number;
}

export async function fetchDebts(limit = 150): Promise<DebtWithPaid[]> {
  const cached = await getCache<DebtWithPaid[]>(CACHE_KEYS.DEBTS);

  const fetchPromise = (async () => {
    try {
      const [debtsRes, txs] = await Promise.all([
        supabase
          .from('debts')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(limit),
        fetchTransactions(250),
      ]);

      if (debtsRes.error) {
        console.error('Error fetching debts:', debtsRes.error);
        return cached || [];
      }

      const rawDebts: Debt[] = debtsRes.data || [];

      // Map payments per debt ID from linked transactions
      const paymentsPerDebt = new Map<string, number>();
      for (const tx of txs) {
        const match = tx.description?.match(/\[Debt:([a-zA-Z0-9_-]+)\]/);
        if (match && match[1]) {
          const debtId = match[1];
          paymentsPerDebt.set(
            debtId,
            (paymentsPerDebt.get(debtId) || 0) + Number(tx.amount || 0)
          );
        }
      }

      const enriched: DebtWithPaid[] = rawDebts.map((d) => {
        let paid = 0;
        if (
          d.paid_amount !== undefined &&
          d.paid_amount !== null &&
          !isNaN(Number(d.paid_amount))
        ) {
          paid = Number(d.paid_amount);
        } else if (paymentsPerDebt.has(d.id)) {
          paid = paymentsPerDebt.get(d.id) || 0;
        } else if (d.status === 'settled') {
          paid = Number(d.amount);
        }

        const total = Number(d.amount);
        const remaining = Math.max(0, total - paid);

        return {
          ...d,
          paid_amount: paid,
          remaining_amount: remaining,
        };
      });

      await setCache(CACHE_KEYS.DEBTS, enriched);
      return enriched;
    } catch (err) {
      console.warn('Fetch debts failed:', err);
      return cached || [];
    }
  })();

  if (!isDeviceOnline() && cached && cached.length > 0) {
    return cached;
  }

  return await fetchPromise;
}

export async function createDebt(payload: {
  person_name: string;
  type: DebtType;
  amount: number;
  paid_amount?: number;
  due_date?: string | null;
  status?: DebtStatus;
}): Promise<{ data: Debt | null; error: Error | null }> {
  const optimisticId = `opt_debt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const optimisticDebt: DebtWithPaid = {
    id: optimisticId,
    person_name: payload.person_name.trim(),
    type: payload.type,
    amount: payload.amount,
    due_date: payload.due_date || null,
    status: payload.status || 'pending',
    paid_amount: payload.paid_amount || 0,
    remaining_amount: Math.max(0, payload.amount - (payload.paid_amount || 0)),
    created_at: new Date().toISOString(),
  };

  // 1. Optimistic write to local cache
  const cached = (await getCache<DebtWithPaid[]>(CACHE_KEYS.DEBTS)) || [];
  await setCache(CACHE_KEYS.DEBTS, [optimisticDebt, ...cached]);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('cashmanager:refresh'));
  }

  const insertPayload: any = {
    person_name: payload.person_name.trim(),
    type: payload.type,
    amount: payload.amount,
    due_date: payload.due_date || null,
    status: payload.status || 'pending',
  };
  if (payload.paid_amount !== undefined) {
    insertPayload.paid_amount = payload.paid_amount;
  }

  // 2. Sync to Supabase or queue offline
  if (isDeviceOnline()) {
    (async () => {
      try {
        const { data, error } = await supabase
          .from('debts')
          .insert([insertPayload])
          .select()
          .single();

        if (data && !error) {
          const current = (await getCache<DebtWithPaid[]>(CACHE_KEYS.DEBTS)) || [];
          const replaced = current.map((d) =>
            d.id === optimisticId
              ? {
                  ...data,
                  paid_amount: payload.paid_amount || 0,
                  remaining_amount: Math.max(0, payload.amount - (payload.paid_amount || 0)),
                }
              : d
          );
          await setCache(CACHE_KEYS.DEBTS, replaced);
        } else if (error) {
          throw error;
        }
      } catch (err) {
        console.warn('Create debt network send failed, queueing offline:', err);
        await enqueueSync('CREATE_DEBT', insertPayload);
        await emitSyncStatus();
      }
    })();
  } else {
    await enqueueSync('CREATE_DEBT', insertPayload);
    await emitSyncStatus();
  }

  return { data: optimisticDebt, error: null };
}

export async function recordDebtPayment(payload: {
  debt: DebtWithPaid | Debt;
  paymentAmount: number;
  date?: string;
  note?: string;
}): Promise<{
  success: boolean;
  transaction?: Transaction | null;
  newPaidAmount?: number;
  remainingBalance?: number;
  newStatus?: DebtStatus;
  error?: string;
}> {
  try {
    const { debt, paymentAmount, date, note } = payload;
    const parsedAmount = Number(paymentAmount);
    if (!parsedAmount || isNaN(parsedAmount) || parsedAmount <= 0) {
      return { success: false, error: 'Please enter a valid payment amount.' };
    }

    const currentPaid = Number((debt as any).paid_amount || 0);
    const totalAmount = Number(debt.amount);
    const newPaidAmount = Math.min(totalAmount, currentPaid + parsedAmount);
    const remainingBalance = Math.max(0, totalAmount - newPaidAmount);
    const newStatus: DebtStatus = remainingBalance <= 0 ? 'settled' : 'pending';
    const paymentDate = date || getTodayDateString();

    const txType: TransactionType = debt.type === 'lent' ? 'income' : 'expense';
    const category = debt.type === 'lent' ? 'Debt Collection' : 'Debt Repayment';
    const defaultDesc =
      debt.type === 'lent'
        ? `Debt collection from ${debt.person_name} [Debt:${debt.id}]`
        : `Debt repayment to ${debt.person_name} [Debt:${debt.id}]`;

    const txDesc = note?.trim() ? `${note.trim()} [Debt:${debt.id}]` : defaultDesc;

    // 1. Optimistic Transaction
    const { data: tx } = await createTransaction({
      amount: parsedAmount,
      type: txType,
      category,
      date: paymentDate,
      description: txDesc,
    });

    // 2. Optimistic Debt Update in Cache
    const cachedDebts = (await getCache<DebtWithPaid[]>(CACHE_KEYS.DEBTS)) || [];
    const updatedDebts = cachedDebts.map((d) =>
      d.id === debt.id
        ? {
            ...d,
            paid_amount: newPaidAmount,
            remaining_amount: remainingBalance,
            status: newStatus,
          }
        : d
    );
    await setCache(CACHE_KEYS.DEBTS, updatedDebts);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cashmanager:refresh'));
    }

    // 3. Sync to Supabase or queue
    if (isDeviceOnline() && !debt.id.startsWith('opt_')) {
      (async () => {
        try {
          const { error } = await supabase
            .from('debts')
            .update({
              paid_amount: newPaidAmount,
              status: newStatus,
            })
            .eq('id', debt.id);

          if (error) throw error;
        } catch (err) {
          console.warn('Update debt payment failed, enqueuing offline:', err);
          await enqueueSync('RECORD_DEBT_PAYMENT', {
            debtId: debt.id,
            newPaidAmount,
            newStatus,
            transaction: tx,
          });
          await emitSyncStatus();
        }
      })();
    } else if (!debt.id.startsWith('opt_')) {
      await enqueueSync('RECORD_DEBT_PAYMENT', {
        debtId: debt.id,
        newPaidAmount,
        newStatus,
        transaction: tx,
      });
      await emitSyncStatus();
    }

    return {
      success: true,
      transaction: tx,
      newPaidAmount,
      remainingBalance,
      newStatus,
    };
  } catch (err: any) {
    console.error('Error recording debt payment:', err);
    return {
      success: false,
      error: err?.message || 'Failed to record debt payment',
    };
  }
}

export async function updateDebtStatus(id: string, status: DebtStatus): Promise<boolean> {
  const cached = (await getCache<DebtWithPaid[]>(CACHE_KEYS.DEBTS)) || [];
  const updated = cached.map((d) => (d.id === id ? { ...d, status } : d));
  await setCache(CACHE_KEYS.DEBTS, updated);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('cashmanager:refresh'));
  }

  if (isDeviceOnline() && !id.startsWith('opt_')) {
    const { error } = await supabase.from('debts').update({ status }).eq('id', id);
    if (!error) return true;
  }

  if (!id.startsWith('opt_')) {
    await enqueueSync('UPDATE_DEBT_STATUS', { id, status });
    await emitSyncStatus();
  }
  return true;
}

export async function deleteDebt(id: string): Promise<boolean> {
  const cached = (await getCache<DebtWithPaid[]>(CACHE_KEYS.DEBTS)) || [];
  await setCache(CACHE_KEYS.DEBTS, cached.filter((d) => d.id !== id));

  // Also clean up any linked cash flow transaction associated with this debt entry
  try {
    const cachedTxs = (await getCache<Transaction[]>(CACHE_KEYS.TRANSACTIONS)) || [];
    const linkedTx = cachedTxs.find((t) => t.description && t.description.includes(`[Debt:${id}]`));
    if (linkedTx) {
      await deleteTransaction(linkedTx.id);
    } else if (isDeviceOnline()) {
      const { data: dbTxs } = await supabase
        .from('transactions')
        .select('id')
        .ilike('description', `%[Debt:${id}]%`);
      if (dbTxs && dbTxs.length > 0) {
        for (const tx of dbTxs) {
          await deleteTransaction(tx.id);
        }
      }
    }
  } catch (cleanErr) {
    console.warn('Failed to clean up linked transaction for deleted debt:', cleanErr);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('cashmanager:refresh'));
  }

  if (isDeviceOnline() && !id.startsWith('opt_')) {
    const { error } = await supabase.from('debts').delete().eq('id', id);
    if (!error) return true;
  }

  if (!id.startsWith('opt_')) {
    await enqueueSync('DELETE_DEBT', { id });
    await emitSyncStatus();
  }
  return true;
}
