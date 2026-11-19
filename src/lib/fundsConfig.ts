/**
 * Configuration & Placeholders for External Live Sync Databases
 * Update these constants to match your actual database tables and collections.
 */

// ============================================================================
// 1. IT LAB FUND (Separate Supabase Project - Double Entry Accounting)
// ============================================================================
export const LAB_CONFIG = {
  // Account details from 'accounts' table
  accountId: '10000000-0000-0000-0000-000000000003',
  accountName: 'Cash in Hand (In-Charge)',
  accountType: 'asset',

  // Tables
  accountsTable: 'accounts',
  linesTable: 'journal_entry_lines',

  // Column names in journal_entry_lines
  accountIdColumn: 'account_id',
  debitColumn: 'debit_amount',
  creditColumn: 'credit_amount',
};

// ============================================================================
// 2. STORE FUND (MongoDB Live Journal Calculation)
// ============================================================================
export const STORE_CONFIG = {
  // Optional database name (leave undefined to use the default DB in your connection string)
  dbName: undefined as string | undefined,

  // Collection names
  accountsCollection: 'accounts',
  journalCollection: 'journalentries',

  // Backwards-compatible aliases
  collectionName: 'accounts',
  accountField: 'name',
  balanceField: 'balance',

  // Store & Account IDs (Aman Store default IDs in MongoDB)
  storeCode: '12345',
  cashAccountId: '1',
  cashAccountName: 'Cash A/c',
  bankAccountId: '2',
  bankAccountName: 'Bank A/c',
};

// ============================================================================
// 3. ROOM FUND (Google Sheet CSV)
// ============================================================================
export const ROOM_SHEET_CONFIG = {
  // Exact cell to extract: Cell B19 = Row 19, Column 2
  targetRow: 19,
  targetColumn: 2, // Column B
};
