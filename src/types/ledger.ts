/**
 * Ledger & Contacts Accounting Types
 */

import { Debt, DebtType, DebtStatus } from '@/types/database';

export interface LedgerContact {
  id: string;
  name: string;
  phone?: string;
  notes?: string;
  createdAt: string;
}

export type LedgerEntryType = 'give' | 'take';

export interface LedgerEntry {
  id: string;
  contactName: string;
  amount: number;
  type: LedgerEntryType; // 'give' = You gave (Lent), 'take' = You got (Borrowed/Received)
  date: string;
  notes?: string;
  debtId?: string;
  status: DebtStatus;
  createdAt: string;
}

export interface ContactSummary {
  name: string;
  phone?: string;
  notes?: string;
  totalGiven: number; // You gave money (They owe you)
  totalTaken: number; // You got money (You owe them / they paid back)
  netBalance: number; // totalGiven - totalTaken: Positive = You will get (+); Negative = You will give (-)
  status: 'to_receive' | 'to_pay' | 'settled';
  lastEntryDate?: string;
  entriesCount: number;
  entries: LedgerEntry[];
}

export interface LedgerOverview {
  totalToReceive: number; // Sum of positive net balances
  totalToPay: number;     // Sum of negative net balances
  netBalance: number;     // totalToReceive - totalToPay
  contactsCount: number;
  activeContactsCount: number;
  contacts: ContactSummary[];
}
