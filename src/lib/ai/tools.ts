import { supabase } from '@/lib/supabase/client';
import { createClient } from '@supabase/supabase-js';
import { MongoClient } from 'mongodb';
import { LAB_CONFIG, STORE_CONFIG, ROOM_SHEET_CONFIG } from '@/lib/fundsConfig';

// ============================================================================
// TOOL 1: Financial Summary (Income, Expense, Savings)
// ============================================================================
export async function getFinancialSummary(period: 'month' | 'all' = 'month') {
  try {
    const [txRes, swiggyRes, milkRes] = await Promise.all([
      supabase.from('transactions').select('*'),
      supabase.from('swiggy_income').select('*'),
      supabase.from('daily_milk_logs').select('*'),
    ]);

    const txs = txRes.data || [];
    const swiggy = swiggyRes.data || [];
    const milk = milkRes.data || [];

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const isCurrentMonth = (dateStr: string) => {
      const d = new Date(dateStr);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    };

    const filterFn = period === 'month' ? (dateStr: string) => isCurrentMonth(dateStr) : () => true;

    // Income
    const txIncome = txs
      .filter((t) => t.type === 'income' && filterFn(t.date))
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const swiggyNet = swiggy
      .filter((s) => filterFn(s.date))
      .reduce(
        (sum, s) =>
          sum +
          (Number(s.gross_amount || 0) -
            Number(s.deduction_amount || 0) -
            Number(s.fuel_expense || 0)),
        0
      );

    const totalIncome = txIncome + swiggyNet;

    // Expenses
    const txExpense = txs
      .filter((t) => t.type === 'expense' && filterFn(t.date))
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const milkExpense = milk
      .filter((m) => m.status === 'paid' && filterFn(m.date))
      .reduce((sum, m) => sum + Number(m.amount), 0);

    const totalExpense = txExpense + milkExpense;
    const totalSavings = totalIncome - totalExpense;
    const savingsRate = totalIncome > 0 ? Math.round((totalSavings / totalIncome) * 100) : 0;

    return {
      period,
      total_income: totalIncome,
      total_expense: totalExpense,
      total_savings: totalSavings,
      savings_rate_percentage: `${savingsRate}%`,
      breakdown: {
        transactions_income: txIncome,
        swiggy_net_income: swiggyNet,
        transactions_expense: txExpense,
        milk_paid_expense: milkExpense,
      },
    };
  } catch (err: any) {
    return { error: err?.message || 'Failed to calculate financial summary' };
  }
}

// ============================================================================
// TOOL 2: Swiggy Payouts & Deductions
// ============================================================================
export async function getSwiggyDetails(limit = 10) {
  try {
    const { data, error } = await supabase
      .from('swiggy_income')
      .select('*')
      .order('date', { ascending: false })
      .limit(limit);

    if (error) throw error;
    const items = data || [];

    const totalGross = items.reduce((sum, s) => sum + Number(s.gross_amount), 0);
    const totalDeductions = items.reduce((sum, s) => sum + Number(s.deduction_amount), 0);
    const totalNet = items.reduce(
      (sum, s) => sum + Number(s.net_amount || s.gross_amount - s.deduction_amount),
      0
    );

    return {
      total_gross: totalGross,
      total_deductions: totalDeductions,
      total_net_payout: totalNet,
      recent_payouts: items.map((p) => ({
        date: p.date,
        gross: Number(p.gross_amount),
        deduction: Number(p.deduction_amount),
        deduction_reason: p.deduction_reason || 'None',
        net: Number(p.net_amount || p.gross_amount - p.deduction_amount),
      })),
    };
  } catch (err: any) {
    return { error: err?.message || 'Failed to fetch Swiggy details' };
  }
}

import { fetchDebts, getPendingMilkBill } from '@/lib/supabase/api';

// ============================================================================
// TOOL 3: Debts & Upcoming Dues
// ============================================================================
export async function getDebtsAndDues(statusFilter: 'pending' | 'settled' | 'all' = 'pending') {
  try {
    const allDebts = await fetchDebts(100);
    const debts = statusFilter === 'all' ? allDebts : allDebts.filter((d) => d.status === statusFilter);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const pending = debts.filter((d) => d.status === 'pending');
    const totalLent = pending
      .filter((d) => d.type === 'lent')
      .reduce((sum, d) => sum + (d.remaining_amount !== undefined ? d.remaining_amount : Number(d.amount)), 0);
    const totalBorrowed = pending
      .filter((d) => d.type === 'borrowed')
      .reduce((sum, d) => sum + (d.remaining_amount !== undefined ? d.remaining_amount : Number(d.amount)), 0);

    const overdueDues = pending
      .filter((d) => d.due_date && new Date(d.due_date) < today)
      .map((d) => {
        const diffDays = Math.ceil(
          (today.getTime() - new Date(d.due_date!).getTime()) / (1000 * 60 * 60 * 24)
        );
        const remaining = d.remaining_amount !== undefined ? d.remaining_amount : Number(d.amount);
        return {
          person: d.person_name,
          type: d.type === 'lent' ? 'You lent (To Receive)' : 'You borrowed (To Pay)',
          total_amount: Number(d.amount),
          paid_amount: d.paid_amount || 0,
          remaining_amount: remaining,
          due_date: d.due_date,
          overdue_by_days: diffDays,
        };
      });

    const upcomingDues = pending
      .filter((d) => d.due_date && new Date(d.due_date) >= today)
      .map((d) => {
        const remaining = d.remaining_amount !== undefined ? d.remaining_amount : Number(d.amount);
        return {
          person: d.person_name,
          type: d.type === 'lent' ? 'You lent (To Receive)' : 'You borrowed (To Pay)',
          total_amount: Number(d.amount),
          paid_amount: d.paid_amount || 0,
          remaining_amount: remaining,
          due_date: d.due_date,
        };
      });

    return {
      total_lent_pending_to_receive: totalLent,
      total_borrowed_pending_to_pay: totalBorrowed,
      net_balance: totalLent - totalBorrowed,
      overdue_count: overdueDues.length,
      overdue_dues: overdueDues,
      upcoming_dues: upcomingDues,
      total_debts_count: debts.length,
    };
  } catch (err: any) {
    return { error: err?.message || 'Failed to fetch debts and dues' };
  }
}

// ============================================================================
// TOOL 4: External Live Funds (Room Sheet, Lab Supabase, Store Mongo)
// ============================================================================
export async function getExternalLiveFunds() {
  const result: Record<string, any> = {};

  // 1. Room Fund
  const roomSheetUrl = process.env.ROOM_FUND_SHEET_URL;
  if (roomSheetUrl && roomSheetUrl.trim() !== '') {
    try {
      const res = await fetch(roomSheetUrl.trim(), { cache: 'no-store' });
      if (res.ok) {
        const text = await res.text();
        const lines = text.trim().split(/\r?\n/);
        const row19 = lines[ROOM_SHEET_CONFIG.targetRow - 1]?.split(',');
        const cell = row19 ? row19[ROOM_SHEET_CONFIG.targetColumn - 1] : null;
        const amt = cell ? parseFloat(cell.replace(/[^0-9.-]+/g, '')) : null;
        if (amt !== null && !isNaN(amt)) {
          result.room_fund = { amount: amt, status: 'live', source: 'Google Sheet (Cell B19)' };
        } else {
          result.room_fund = { amount: 0, status: 'error', error: `Cell B19 value "${cell}" is not a valid number` };
        }
      } else {
        result.room_fund = { amount: 0, status: 'error', error: `HTTP ${res.status}: ${res.statusText}` };
      }
    } catch (e: any) {
      result.room_fund = { amount: 0, status: 'error', error: e?.message || 'Failed to fetch Room Fund sheet' };
    }
  } else {
    result.room_fund = { amount: 0, status: 'error', error: 'ROOM_FUND_SHEET_URL is not configured' };
  }

  // 2. IT Lab Fund (Double-entry calculation for 'Cash in Hand (In-Charge)')
  const labUrl = process.env.LAB_SUPABASE_URL;
  const labKey = process.env.LAB_SUPABASE_ANON_KEY;
  if (labUrl && labKey && !labUrl.includes('placeholder')) {
    try {
      const labClient = createClient(labUrl, labKey);
      const { data } = await labClient
        .from(LAB_CONFIG.linesTable)
        .select(`${LAB_CONFIG.debitColumn}, ${LAB_CONFIG.creditColumn}`)
        .eq(LAB_CONFIG.accountIdColumn, LAB_CONFIG.accountId)
        .limit(10000);

      let totalDebit = 0;
      let totalCredit = 0;
      for (const line of (data || []) as any[]) {
        totalDebit += Number(line[LAB_CONFIG.debitColumn] || 0);
        totalCredit += Number(line[LAB_CONFIG.creditColumn] || 0);
      }
      const balance = totalDebit - totalCredit;

      result.it_lab_fund = {
        amount: balance,
        status: 'live',
        source: `Lab Supabase (${LAB_CONFIG.accountName})`,
        debits: totalDebit,
        credits: totalCredit,
        linesCount: data?.length || 0,
      };
    } catch {
      result.it_lab_fund = { amount: 0, status: 'error', source: 'Lab Supabase' };
    }
  } else {
    result.it_lab_fund = { amount: 320, status: 'placeholder', source: 'Lab Supabase' };
  }

  // 3. Store Fund (Double-entry calculation from journal entries)
  const storeUri = process.env.STORE_MONGODB_URI;
  if (storeUri && !storeUri.includes('placeholder')) {
    let client: MongoClient | null = null;
    try {
      client = new MongoClient(storeUri, { serverSelectionTimeoutMS: 5000 });
      await client.connect();
      const db = client.db(STORE_CONFIG.dbName);
      const journalColl = db.collection(STORE_CONFIG.journalCollection || 'journalentries');

      const targetIds = [
        STORE_CONFIG.cashAccountId || '1',
        STORE_CONFIG.bankAccountId || '2',
        1,
        2,
      ];

      const aggResults = await journalColl
        .aggregate([
          { $unwind: '$lines' },
          { $match: { 'lines.accountId': { $in: targetIds } } },
          {
            $group: {
              _id: { accountId: '$lines.accountId', type: '$lines.type' },
              totalAmount: { $sum: '$lines.amount' },
            },
          },
        ])
        .toArray();

      let cashDebit = 0;
      let cashCredit = 0;
      let bankDebit = 0;
      let bankCredit = 0;

      for (const r of aggResults) {
        const accId = String(r._id.accountId);
        const type = String(r._id.type || '').trim().toLowerCase();
        const amt = Number(r.totalAmount || 0);

        if (accId === String(STORE_CONFIG.cashAccountId || '1')) {
          if (type === 'debit') cashDebit += amt;
          else if (type === 'credit') cashCredit += amt;
        } else if (accId === String(STORE_CONFIG.bankAccountId || '2')) {
          if (type === 'debit') bankDebit += amt;
          else if (type === 'credit') bankCredit += amt;
        }
      }

      const cashBalance = cashDebit - cashCredit;
      const bankBalance = bankDebit - bankCredit;
      const totalBalance = cashBalance + bankBalance;

      result.store_fund = {
        amount: totalBalance,
        bank_balance: bankBalance,
        cash_balance: cashBalance,
        status: 'live',
        source: 'MongoDB Journal Entries',
        debits: { cash: cashDebit, bank: bankDebit },
        credits: { cash: cashCredit, bank: bankCredit },
      };
    } catch {
      result.store_fund = { amount: 1450, bank_balance: 1100, cash_balance: 350, status: 'fallback' };
    } finally {
      if (client) await client.close().catch(() => {});
    }
  } else {
    result.store_fund = { amount: 1450, bank_balance: 1100, cash_balance: 350, status: 'placeholder' };
  }

  return result;
}

// ============================================================================
// TOOL 5: Recent Transactions
// ============================================================================
export async function getRecentTransactions(limit = 6) {
  try {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return {
      transactions: (data || []).map((t) => ({
        date: t.date,
        type: t.type,
        category: t.category,
        amount: Number(t.amount),
        description: t.description || '',
      })),
    };
  } catch (err: any) {
    return { error: err?.message || 'Failed to fetch recent transactions' };
  }
}

