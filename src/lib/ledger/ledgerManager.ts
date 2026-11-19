/**
 * Ledger Accounts & Contacts Business Logic
 * Converts disjointed debts into a unified double-entry style contact ledger.
 * Fully compatible with the Supabase 'debts' table and local-first IndexedDB cache.
 */

import {
  fetchDebts,
  createDebt,
  deleteDebt,
  createTransaction,
  getTodayDateString,
  DebtWithPaid,
} from '@/lib/supabase/api';
import { invalidateFinanceQueries } from '@/lib/queries/invalidation';
import type { TransactionType } from '@/types/database';
import { getCache, setCache } from '@/lib/offline/db';
import type {
  LedgerContact,
  LedgerEntry,
  ContactSummary,
  LedgerOverview,
  LedgerEntryType,
} from '@/types/ledger';

const CONTACTS_CACHE_KEY = 'cache_ledger_contacts';

// ----------------------------------------------------------------------------
// 1. CONTACT REGISTRY MANAGEMENT
// ----------------------------------------------------------------------------

export async function getLedgerContacts(): Promise<LedgerContact[]> {
  try {
    const cached = await getCache<LedgerContact[]>(CONTACTS_CACHE_KEY);
    return cached || [];
  } catch (err) {
    console.warn('Failed to load ledger contacts:', err);
    return [];
  }
}

export async function addLedgerContact(payload: {
  name: string;
  phone?: string;
  notes?: string;
}): Promise<LedgerContact> {
  const trimmedName = payload.name.trim();
  const existing = await getLedgerContacts();

  // Check if contact already exists
  const found = existing.find(
    (c) => c.name.toLowerCase() === trimmedName.toLowerCase()
  );
  if (found) {
    return found;
  }

  const newContact: LedgerContact = {
    id: `contact_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: trimmedName,
    phone: payload.phone?.trim() || undefined,
    notes: payload.notes?.trim() || undefined,
    createdAt: new Date().toISOString(),
  };

  const updated = [newContact, ...existing];
  await setCache(CONTACTS_CACHE_KEY, updated);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('cashmanager:refresh'));
  }

  return newContact;
}

export async function deleteLedgerContact(contactName: string): Promise<void> {
  const existing = await getLedgerContacts();
  const filtered = existing.filter(
    (c) => c.name.toLowerCase() !== contactName.toLowerCase()
  );
  await setCache(CONTACTS_CACHE_KEY, filtered);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('cashmanager:refresh'));
  }
}

// ----------------------------------------------------------------------------
// 2. LEDGER OVERVIEW & AGGREGATIONS
// ----------------------------------------------------------------------------

export async function fetchLedgerOverview(): Promise<LedgerOverview> {
  // 1. Fetch debts (Local-first from IndexedDB / Supabase)
  const rawDebts = await fetchDebts(300);

  // 2. Fetch saved contacts
  const savedContacts = await getLedgerContacts();
  const contactsMap = new Map<string, LedgerContact>();
  for (const c of savedContacts) {
    contactsMap.set(c.name.toLowerCase(), c);
  }

  // Group entries by person name (case-insensitive)
  const grouped = new Map<
    string,
    {
      displayName: string;
      phone?: string;
      notes?: string;
      entries: LedgerEntry[];
    }
  >();

  // Populate from debts table
  for (const d of rawDebts) {
    const personName = (d.person_name || 'Unnamed').trim();
    const key = personName.toLowerCase();

    if (!grouped.has(key)) {
      const contactInfo = contactsMap.get(key);
      grouped.set(key, {
        displayName: contactInfo?.name || personName,
        phone: contactInfo?.phone,
        notes: contactInfo?.notes,
        entries: [],
      });
    }

    const target = grouped.get(key)!;

    // Convert debt record to LedgerEntry:
    // 'lent' = You gave money to them (Debit)
    // 'borrowed' = You took/received money from them (Credit)
    const entryType: LedgerEntryType = d.type === 'lent' ? 'give' : 'take';

    target.entries.push({
      id: d.id,
      contactName: target.displayName,
      amount: Number(d.amount),
      type: entryType,
      date: d.due_date || (d.created_at ? d.created_at.slice(0, 10) : getTodayDateString()),
      notes: d.status === 'settled' ? 'Settled' : undefined,
      debtId: d.id,
      status: d.status,
      createdAt: d.created_at,
    });
  }

  // Calculate summaries for each contact
  const contactSummaries: ContactSummary[] = [];
  let totalToReceive = 0;
  let totalToPay = 0;

  for (const [, group] of grouped) {
    // Sort entries by date descending
    group.entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    let totalGiven = 0; // You gave (They owe you)
    let totalTaken = 0; // You took (You owe them / they repaid)

    for (const e of group.entries) {
      if (e.status === 'settled') {
        // If settled, contributions cancel each other out in the net balance
        continue;
      }
      if (e.type === 'give') {
        totalGiven += e.amount;
      } else {
        totalTaken += e.amount;
      }
    }

    const netBalance = totalGiven - totalTaken;
    let status: ContactSummary['status'] = 'settled';

    if (netBalance > 0) {
      status = 'to_receive';
      totalToReceive += netBalance;
    } else if (netBalance < 0) {
      status = 'to_pay';
      totalToPay += Math.abs(netBalance);
    }

    contactSummaries.push({
      name: group.displayName,
      phone: group.phone,
      notes: group.notes,
      totalGiven,
      totalTaken,
      netBalance,
      status,
      lastEntryDate: group.entries[0]?.date,
      entriesCount: group.entries.length,
      entries: group.entries,
    });
  }

  // Sort: Contacts with active balances first, then by name
  contactSummaries.sort((a, b) => {
    if (a.status !== 'settled' && b.status === 'settled') return -1;
    if (a.status === 'settled' && b.status !== 'settled') return 1;
    return Math.abs(b.netBalance) - Math.abs(a.netBalance);
  });

  const activeContactsCount = contactSummaries.filter((c) => c.status !== 'settled').length;

  return {
    totalToReceive,
    totalToPay,
    netBalance: totalToReceive - totalToPay,
    contactsCount: contactSummaries.length,
    activeContactsCount,
    contacts: contactSummaries,
  };
}

// ----------------------------------------------------------------------------
// 3. LEDGER MUTATIONS (Give & Take)
// ----------------------------------------------------------------------------

export async function addLedgerTransaction(payload: {
  contactName: string;
  type: LedgerEntryType; // 'give' (You gave) or 'take' (You got)
  amount: number;
  date?: string;
  notes?: string;
  skipCashFlow?: boolean;
}): Promise<boolean> {
  const trimmedName = payload.contactName.trim();
  if (!trimmedName || !payload.amount || payload.amount <= 0) {
    return false;
  }

  // 1. Ensure contact is saved in registry
  await addLedgerContact({ name: trimmedName });

  // 2. Fetch current contact status before applying mutation (to know if debtor or creditor)
  let existingContact: ContactSummary | undefined;
  if (!payload.skipCashFlow) {
    try {
      const overview = await fetchLedgerOverview();
      existingContact = overview.contacts.find(
        (c) => c.name.toLowerCase() === trimmedName.toLowerCase()
      );
    } catch (e) {
      console.warn('Could not inspect existing contact balance:', e);
    }
  }

  // 3. Map 'give' to 'lent' (Debit) and 'take' to 'borrowed' (Credit)
  const debtType = payload.type === 'give' ? 'lent' : 'borrowed';

  const { data, error } = await createDebt({
    person_name: trimmedName,
    type: debtType,
    amount: payload.amount,
    due_date: payload.date || getTodayDateString(),
    status: 'pending',
  });

  if (error || !data) {
    console.error('Failed to create ledger entry:', error);
    return false;
  }

  // 4. Synchronize cash flow in 'transactions' table so Cash in Hand reflects immediately
  if (!payload.skipCashFlow) {
    try {
      let txType: TransactionType;
      let category: string;
      let defaultDesc: string;

      if (payload.type === 'take') {
        // You took money in hand -> Cash Inflow (income)
        txType = 'income';
        if (existingContact && existingContact.netBalance > 0) {
          // Debtor paying back money they owed you
          category = 'Debt Collection';
          defaultDesc = `Repayment received from ${trimmedName}`;
        } else {
          // Borrowing money from a creditor or new loan
          category = 'Borrowed / Loan Taken';
          defaultDesc = `Borrowed from ${trimmedName}`;
        }
      } else {
        // You gave money out of hand -> Cash Outflow (expense)
        txType = 'expense';
        if (existingContact && existingContact.netBalance < 0) {
          // Repaying money you owed to a creditor
          category = 'Debt Repayment';
          defaultDesc = `Repaid loan to ${trimmedName}`;
        } else {
          // Lending money to a debtor or new loan given
          category = 'Lent / Loan Given';
          defaultDesc = `Lent to ${trimmedName}`;
        }
      }

      const noteText = payload.notes?.trim();
      const txDesc = noteText
        ? `${noteText} [Debt:${data.id}]`
        : `${defaultDesc} [Debt:${data.id}]`;

      await createTransaction({
        amount: payload.amount,
        type: txType,
        category,
        date: payload.date || getTodayDateString(),
        description: txDesc,
      });
    } catch (txErr) {
      console.warn('Failed to record matching cash flow transaction:', txErr);
    }
  }

  invalidateFinanceQueries('ledger');

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('cashmanager:refresh'));
  }

  return true;
}

/**
 * Settles a contact's net balance directly by creating an offsetting entry
 * or clearing pending debts for that contact.
 */
export async function settleContactLedger(contactName: string): Promise<boolean> {
  const overview = await fetchLedgerOverview();
  const contact = overview.contacts.find(
    (c) => c.name.toLowerCase() === contactName.trim().toLowerCase()
  );

  if (!contact || contact.netBalance === 0) return true;

  // If netBalance > 0: they owed you money (+₹X). To settle, you record that you received (take) ₹X.
  // If netBalance < 0: you owed them money (-₹X). To settle, you record that you gave (give) ₹|X|.
  const settleType: LedgerEntryType = contact.netBalance > 0 ? 'take' : 'give';
  const settleAmount = Math.abs(contact.netBalance);

  return await addLedgerTransaction({
    contactName: contact.name,
    type: settleType,
    amount: settleAmount,
    date: getTodayDateString(),
    notes: 'Settled full balance',
  });
}
