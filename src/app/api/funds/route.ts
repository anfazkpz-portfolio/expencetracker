import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { MongoClient } from 'mongodb';
import { LAB_CONFIG, STORE_CONFIG, ROOM_SHEET_CONFIG } from '@/lib/fundsConfig';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ============================================================================
// ROBUST CSV PARSER (Handles quoted commas, newlines, 1-based indexing)
// ============================================================================
function parseCsvRows(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  // Normalize CRLF to LF
  const text = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentCell += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = '';
    } else if (char === '\n' && !inQuotes) {
      currentRow.push(currentCell.trim());
      rows.push(currentRow);
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += char;
    }
  }

  // Push last row if exists
  if (currentCell !== '' || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    rows.push(currentRow);
  }

  // If the last row is completely empty (due to trailing newline), pop it
  if (rows.length > 0) {
    const lastRow = rows[rows.length - 1];
    if (lastRow.length === 1 && lastRow[0] === '') {
      rows.pop();
    }
  }

  return rows;
}

function cleanNumericValue(raw: string): number | null {
  if (!raw || typeof raw !== 'string') return null;

  let str = raw.trim();

  // Handle accounting negative format: (1,234.50) => -1234.50
  if (str.startsWith('(') && str.endsWith(')')) {
    str = '-' + str.slice(1, -1);
  }

  // Remove currency signs (₹, $, €, £), commas, spaces
  const sanitized = str.replace(/[₹$€£\s,]/g, '');

  const val = parseFloat(sanitized);
  return isNaN(val) ? null : val;
}

// ============================================================================
// API ROUTE HANDLER
// ============================================================================
export async function GET() {
  const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // --------------------------------------------------------------------------
  // 1. ROOM FUND: GOOGLE SHEET CSV (Exact Cell B19 = Row 19, Column 2)
  // --------------------------------------------------------------------------
  const roomSheetUrl = process.env.ROOM_FUND_SHEET_URL;

  // 1-based indexing config
  const targetRow1Based = ROOM_SHEET_CONFIG.targetRow; // 19
  const targetCol1Based = ROOM_SHEET_CONFIG.targetColumn; // 2 (Column B)

  // 0-based array indexes
  const rowIndex = targetRow1Based - 1; // 18
  const colIndex = targetCol1Based - 1; // 1

  let roomFund = {
    name: 'Room Fund',
    source: `Google Sheet (Cell B19: Row ${targetRow1Based}, Col ${targetCol1Based})`,
    amount: 0,
    status: 'error' as 'live' | 'placeholder' | 'error',
    updatedAt: now,
    cell: 'B19',
    details: '',
    error: null as string | null,
  };

  if (!roomSheetUrl || roomSheetUrl.trim() === '') {
    roomFund.status = 'error';
    roomFund.error = 'ROOM_FUND_SHEET_URL is missing in .env.local';
    roomFund.details = 'Please set ROOM_FUND_SHEET_URL in .env.local';
  } else {
    try {
      const res = await fetch(roomSheetUrl.trim(), {
        cache: 'no-store',
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) {
        throw new Error(`Google Sheet request failed with HTTP ${res.status}: ${res.statusText}`);
      }

      const csvText = await res.text();

      if (!csvText || csvText.trim() === '') {
        throw new Error('Received empty response from Google Sheet URL');
      }

      // Check if Google returned an HTML login or error page instead of raw CSV
      if (csvText.includes('<!DOCTYPE html>') || csvText.includes('<html')) {
        throw new Error(
          'Google Sheet URL returned HTML instead of CSV. Ensure the sheet is Published to Web as CSV (File > Share > Publish to web > CSV).'
        );
      }

      const rows = parseCsvRows(csvText);

      // Validate 1-based Row 19 (index 18)
      if (rows.length < targetRow1Based) {
        throw new Error(
          `Sheet has only ${rows.length} row(s). Row ${targetRow1Based} (index ${rowIndex}) does not exist in the CSV.`
        );
      }

      const targetRowData = rows[rowIndex];

      // Validate 1-based Column 2 (index 1)
      if (targetRowData.length < targetCol1Based) {
        throw new Error(
          `Row ${targetRow1Based} has only ${targetRowData.length} column(s). Column ${targetCol1Based} (Column B, index ${colIndex}) does not exist. (Row contents: [${targetRowData.join(' | ')}])`
        );
      }

      const rawCell = targetRowData[colIndex];
      const parsedAmount = cleanNumericValue(rawCell);

      if (parsedAmount === null) {
        throw new Error(
          `Cell B19 (Row ${targetRow1Based}, Col ${targetCol1Based}) contains "${rawCell}", which could not be parsed as a numeric balance.`
        );
      }

      // Success: Live dynamic extraction
      roomFund = {
        name: 'Room Fund',
        source: `Google Sheet (Cell B19)`,
        amount: parsedAmount,
        status: 'live',
        updatedAt: now,
        cell: 'B19',
        details: `Extracted ₹${parsedAmount} from Row ${targetRow1Based}, Column ${targetCol1Based} (raw: "${rawCell}")`,
        error: null,
      };
    } catch (err: any) {
      roomFund.status = 'error';
      roomFund.amount = 0;
      roomFund.error = err?.message || 'Failed to fetch or parse Room Fund CSV';
      roomFund.details = `URL: ${roomSheetUrl.slice(0, 45)}...`;
    }
  }

  // --------------------------------------------------------------------------
  // 2. IT LAB FUND: SEPARATE LAB SUPABASE ('Cash in Hand (In-Charge)')
  // Dynamic double-entry calculation: Balance = Sum(Debits) - Sum(Credits)
  // --------------------------------------------------------------------------
  const labUrl = process.env.LAB_SUPABASE_URL;
  const labKey = process.env.LAB_SUPABASE_ANON_KEY;
  let itLabFund = {
    name: 'IT Lab Fund',
    source: `Lab Supabase ("${LAB_CONFIG.accountName}")`,
    accountName: LAB_CONFIG.accountName,
    accountId: LAB_CONFIG.accountId,
    amount: 0,
    totalDebit: 0,
    totalCredit: 0,
    linesCount: 0,
    status: 'placeholder' as 'live' | 'placeholder' | 'error',
    updatedAt: now,
    table: LAB_CONFIG.linesTable,
    details: `Querying '${LAB_CONFIG.linesTable}' for account ${LAB_CONFIG.accountId}`,
    error: null as string | null,
  };

  if (
    labUrl &&
    labKey &&
    !labUrl.includes('placeholder') &&
    !labKey.includes('placeholder')
  ) {
    try {
      const labClient = createClient(labUrl, labKey);

      // Query journal_entry_lines for this specific Asset account ID
      const { data, error } = await labClient
        .from(LAB_CONFIG.linesTable)
        .select(`${LAB_CONFIG.debitColumn}, ${LAB_CONFIG.creditColumn}`)
        .eq(LAB_CONFIG.accountIdColumn, LAB_CONFIG.accountId)
        .limit(10000);

      if (error) {
        throw new Error(error.message);
      }

      if (data && data.length > 0) {
        let totalDebit = 0;
        let totalCredit = 0;

        for (const line of (data as any[])) {
          totalDebit += Number(line[LAB_CONFIG.debitColumn] || 0);
          totalCredit += Number(line[LAB_CONFIG.creditColumn] || 0);
        }

        // Double-entry Asset balance formula: Sum of Debits - Sum of Credits
        const realTimeBalance = totalDebit - totalCredit;

        itLabFund = {
          name: 'IT Lab Fund',
          source: `Lab Supabase ("${LAB_CONFIG.accountName}")`,
          accountName: LAB_CONFIG.accountName,
          accountId: LAB_CONFIG.accountId,
          amount: realTimeBalance,
          totalDebit,
          totalCredit,
          linesCount: data.length,
          status: 'live',
          updatedAt: now,
          table: LAB_CONFIG.linesTable,
          details: `Double-entry balance computed from ${data.length} journal lines (Debits: ₹${totalDebit}, Credits: ₹${totalCredit})`,
          error: null,
        };
      } else {
        itLabFund = {
          name: 'IT Lab Fund',
          source: `Lab Supabase ("${LAB_CONFIG.accountName}")`,
          accountName: LAB_CONFIG.accountName,
          accountId: LAB_CONFIG.accountId,
          amount: 0,
          totalDebit: 0,
          totalCredit: 0,
          linesCount: 0,
          status: 'live',
          updatedAt: now,
          table: LAB_CONFIG.linesTable,
          details: `Account found, but 0 journal entry lines recorded for account ${LAB_CONFIG.accountId}`,
          error: null,
        };
      }
    } catch (err: any) {
      itLabFund.status = 'error';
      itLabFund.amount = 0;
      itLabFund.error = `${err?.message || 'Query failed'}. (Check table '${LAB_CONFIG.linesTable}')`;
    }
  } else {
    // If not configured, show clean placeholder indicator
    itLabFund.status = 'placeholder';
    itLabFund.amount = 320;
    itLabFund.details = 'Configure LAB_SUPABASE_URL and LAB_SUPABASE_ANON_KEY in .env.local';
  }

  // --------------------------------------------------------------------------
  // 3. STORE FUND: MONGODB (Live Journal Calculation: Cash A/c + Bank A/c)
  // Dynamic double-entry calculation from journal entries matching Aman Store dashboard
  // --------------------------------------------------------------------------
  const storeMongoUri = process.env.STORE_MONGODB_URI;
  let storeFund = {
    name: 'Store Fund',
    source: `MongoDB Journal Entries ("Cash A/c" + "Bank A/c")`,
    amount: 0,
    bankAmount: 0,
    cashAmount: 0,
    bankBalance: 0,
    cashBalance: 0,
    cashDebit: 0,
    cashCredit: 0,
    bankDebit: 0,
    bankCredit: 0,
    cashLinesCount: 0,
    bankLinesCount: 0,
    totalLinesCount: 0,
    breakdown: 'Cash: ₹0 | Bank: ₹0',
    status: 'placeholder' as 'live' | 'placeholder' | 'error',
    updatedAt: now,
    collection: STORE_CONFIG.journalCollection || 'journalentries',
    details: `Calculating live balance from '${STORE_CONFIG.journalCollection || 'journalentries'}'`,
    error: null as string | null,
  };

  if (storeMongoUri && storeMongoUri.trim() !== '') {
    // If not default placeholder, connect and query
    if (!storeMongoUri.includes('user:password@cluster')) {
      let mongoClient: MongoClient | null = null;
      try {
        mongoClient = new MongoClient(storeMongoUri.trim(), {
          serverSelectionTimeoutMS: 5000,
          connectTimeoutMS: 5000,
        });

        await mongoClient.connect();
        const db = mongoClient.db(STORE_CONFIG.dbName);
        const accountsCollection = db.collection(STORE_CONFIG.accountsCollection || 'accounts');
        const journalCollection = db.collection(STORE_CONFIG.journalCollection || 'journalentries');

        // 1. Discover or resolve Cash and Bank account documents from accounts collection
        const accountQuery: any = {
          $or: [
            { _id: { $in: [STORE_CONFIG.cashAccountId, STORE_CONFIG.bankAccountId] } },
            {
              [STORE_CONFIG.accountField || 'name']: {
                $in: [
                  /^Cash(\s+A\/?c)?$/i,
                  /^Bank(\s+A\/?c)?$/i,
                  'Cash A/c',
                  'Bank A/c',
                  'Cash A/C',
                  'Bank A/C',
                  'Cash',
                  'Bank',
                ],
              },
            },
          ],
        };

        const matchedAccounts = await accountsCollection.find(accountQuery).toArray();

        // Identify specific Cash and Bank account records (prioritizing storeCode if multiple)
        const storeAccounts = STORE_CONFIG.storeCode
          ? matchedAccounts.filter((a: any) => !a.storeCode || a.storeCode === STORE_CONFIG.storeCode)
          : matchedAccounts;

        const cashAcc =
          storeAccounts.find((a: any) => String(a._id) === STORE_CONFIG.cashAccountId) ||
          storeAccounts.find((a: any) => /^Cash(\s+A\/?c)?$/i.test(String(a.name || ''))) ||
          matchedAccounts.find((a: any) => /cash/i.test(String(a.name || '')));

        const bankAcc =
          storeAccounts.find((a: any) => String(a._id) === STORE_CONFIG.bankAccountId) ||
          storeAccounts.find((a: any) => /^Bank(\s+A\/?c)?$/i.test(String(a.name || ''))) ||
          matchedAccounts.find((a: any) => /bank/i.test(String(a.name || '')));

        const cashId = cashAcc ? String(cashAcc._id) : STORE_CONFIG.cashAccountId || '1';
        const bankId = bankAcc ? String(bankAcc._id) : STORE_CONFIG.bankAccountId || '2';
        const cashName = cashAcc?.name || 'Cash A/c';
        const bankName = bankAcc?.name || 'Bank A/c';

        // Target IDs to search for in journal entry lines (supporting both string and numeric types)
        const targetIds: (string | number)[] = [cashId, bankId];
        if (!isNaN(Number(cashId))) targetIds.push(Number(cashId));
        if (!isNaN(Number(bankId))) targetIds.push(Number(bankId));

        // 2. Aggregate Debits and Credits directly from journalentries
        // Asset account balance = Sum(Debits) - Sum(Credits)
        const aggResults = await journalCollection
          .aggregate([
            { $unwind: '$lines' },
            { $match: { 'lines.accountId': { $in: targetIds } } },
            {
              $group: {
                _id: { accountId: '$lines.accountId', type: '$lines.type' },
                totalAmount: { $sum: '$lines.amount' },
                count: { $sum: 1 },
              },
            },
          ])
          .toArray();

        let cashDebit = 0;
        let cashCredit = 0;
        let bankDebit = 0;
        let bankCredit = 0;
        let cashLinesCount = 0;
        let bankLinesCount = 0;

        for (const r of aggResults) {
          const accId = String(r._id.accountId);
          const type = String(r._id.type || '').trim().toLowerCase();
          const amt = Number(r.totalAmount || 0);
          const count = Number(r.count || 0);

          if (accId === cashId) {
            cashLinesCount += count;
            if (type === 'debit') {
              cashDebit += amt;
            } else if (type === 'credit') {
              cashCredit += amt;
            }
          } else if (accId === bankId) {
            bankLinesCount += count;
            if (type === 'debit') {
              bankDebit += amt;
            } else if (type === 'credit') {
              bankCredit += amt;
            }
          }
        }

        // Live Balance for Asset accounts: Debits - Credits
        const cashBalance = cashDebit - cashCredit;
        const bankBalance = bankDebit - bankCredit;
        const totalBalance = cashBalance + bankBalance;
        const totalLinesCount = cashLinesCount + bankLinesCount;

        const formattedCash = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(cashBalance);
        const formattedBank = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(bankBalance);
        const breakdown = `Cash: ₹${formattedCash} | Bank: ₹${formattedBank}`;

        // Clear console breakdown logging for server terminal verification
        console.log('====================================================');
        console.log('[DEBUG /api/funds] MongoDB Store Fund (Live Journal Calculation):');
        console.log(
          `- ${cashName} (ID: "${cashId}"): Debits: ₹${cashDebit}, Credits: ₹${cashCredit} => Live Balance: ₹${cashBalance} (${cashLinesCount} lines)`
        );
        console.log(
          `- ${bankName} (ID: "${bankId}"): Debits: ₹${bankDebit}, Credits: ₹${bankCredit} => Live Balance: ₹${bankBalance} (${bankLinesCount} lines)`
        );
        console.log(
          `- Total Store Fund (Cash + Bank): ₹${totalBalance} (from ${totalLinesCount} journal lines)`
        );
        console.log('====================================================');

        storeFund = {
          name: 'Store Fund',
          source: `MongoDB Journal Entries ("${cashName}" + "${bankName}")`,
          amount: totalBalance,
          bankAmount: bankBalance,
          cashAmount: cashBalance,
          bankBalance: bankBalance,
          cashBalance: cashBalance,
          cashDebit,
          cashCredit,
          bankDebit,
          bankCredit,
          cashLinesCount,
          bankLinesCount,
          totalLinesCount,
          breakdown,
          status: 'live',
          updatedAt: now,
          collection: STORE_CONFIG.journalCollection || 'journalentries',
          details: `Double-entry balance computed from ${totalLinesCount} journal lines (${breakdown})`,
          error: null,
        };
      } catch (err: any) {
        storeFund.status = 'error';
        storeFund.amount = 0;
        storeFund.error = `${err?.message || 'MongoDB calculation failed'}. (Collection: '${STORE_CONFIG.journalCollection || 'journalentries'}')`;
      } finally {
        if (mongoClient) {
          await mongoClient.close().catch(() => {});
        }
      }
    } else {
      storeFund.status = 'placeholder';
      storeFund.amount = 1450;
      storeFund.bankAmount = 1100;
      storeFund.cashAmount = 350;
      storeFund.bankBalance = 1100;
      storeFund.cashBalance = 350;
      storeFund.cashDebit = 350;
      storeFund.cashCredit = 0;
      storeFund.bankDebit = 1100;
      storeFund.bankCredit = 0;
      storeFund.cashLinesCount = 0;
      storeFund.bankLinesCount = 0;
      storeFund.totalLinesCount = 0;
      storeFund.breakdown = 'Cash: ₹350 | Bank: ₹1,100';
      storeFund.details = 'Configure STORE_MONGODB_URI in .env.local';
    }
  } else {
    storeFund.status = 'error';
    storeFund.error = 'STORE_MONGODB_URI is not set in .env.local';
  }

  return NextResponse.json(
    {
      roomFund,
      itLabFund,
      storeFund,
      timestamp: new Date().toISOString(),
    },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    }
  );
}
