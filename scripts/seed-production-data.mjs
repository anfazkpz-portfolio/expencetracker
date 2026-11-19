import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://qvwmgofkwsexpnbruesm.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_M3Kvd-GTiZUFqBos0mfC7A_yaAlJ1Ew';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
  console.log('--- Step 1: Clearing Cash Manager Trial Entries ---');

  // Delete all records from transactions, debts, swiggy_logs, daily_milk_logs
  const [delTxs, delDebts, delSwiggy, delMilk] = await Promise.all([
    supabase.from('transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
    supabase.from('debts').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
    supabase.from('swiggy_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
    supabase.from('daily_milk_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
  ]);

  console.log('Cleared transactions error:', delTxs.error);
  console.log('Cleared debts error:', delDebts.error);
  console.log('Cleared swiggy_logs error:', delSwiggy.error);
  console.log('Cleared daily_milk_logs error:', delMilk.error);

  console.log('\n--- Step 2: Seeding Creditors & Debtors Opening Balances ---');

  const creditors = [
    { person_name: 'murshid', amount: 500, type: 'borrowed', status: 'pending', due_date: '2026-11-01' },
    { person_name: 'shammas alp', amount: 1200, type: 'borrowed', status: 'pending', due_date: '2026-11-01' },
    { person_name: 'risala calender', amount: 150, type: 'borrowed', status: 'pending', due_date: '2026-11-01' },
    { person_name: 'ssf member ship', amount: 460, type: 'borrowed', status: 'pending', due_date: '2026-11-01' },
    { person_name: 'shammas kdr', amount: 800, type: 'borrowed', status: 'pending', due_date: '2026-11-01' },
    { person_name: 'aban', amount: 3600, type: 'borrowed', status: 'pending', due_date: '2026-11-01' },
    { person_name: 'swabah', amount: 805, type: 'borrowed', status: 'pending', due_date: '2026-11-01' },
    { person_name: 'umma', amount: 17400, type: 'borrowed', status: 'pending', due_date: '2026-11-01' },
  ];

  const debtors = [
    { person_name: 'aflah kannur', amount: 200, type: 'lent', status: 'pending', due_date: '2026-11-01' },
  ];

  const { data: insertedDebts, error: debtsErr } = await supabase
    .from('debts')
    .insert([...creditors, ...debtors])
    .select();

  if (debtsErr) {
    console.error('Error seeding debts:', debtsErr);
  } else {
    console.log(`Successfully seeded ${insertedDebts.length} ledger accounts:`);
    const totalCreditors = creditors.reduce((sum, c) => sum + c.amount, 0);
    const totalDebtors = debtors.reduce((sum, d) => sum + d.amount, 0);
    console.log(`  Creditors: 8 accounts, Total: ₹${totalCreditors}`);
    console.log(`  Debtors: 1 account, Total: ₹${totalDebtors}`);
  }

  console.log('\n--- Step 3: Seeding November Milk Logs (01/11/2026 to 19/11/2026) ---');

  const milkLogs = [
    // 01/11/2026: skipped (₹0)
    { date: '2026-11-01', amount: 0, status: 'skipped' },

    // 02/11/2026 to 12/11/2026 (11 days): delivered (₹14/day)
    { date: '2026-11-02', amount: 14, status: 'pending' },
    { date: '2026-11-03', amount: 14, status: 'pending' },
    { date: '2026-11-04', amount: 14, status: 'pending' },
    { date: '2026-11-05', amount: 14, status: 'pending' },
    { date: '2026-11-06', amount: 14, status: 'pending' },
    { date: '2026-11-07', amount: 14, status: 'pending' },
    { date: '2026-11-08', amount: 14, status: 'pending' },
    { date: '2026-11-09', amount: 14, status: 'pending' },
    { date: '2026-11-10', amount: 14, status: 'pending' },
    { date: '2026-11-11', amount: 14, status: 'pending' },
    { date: '2026-11-12', amount: 14, status: 'pending' },

    // 13/11/2026 to 15/11/2026 (3 days): skipped (₹0)
    { date: '2026-11-13', amount: 0, status: 'skipped' },
    { date: '2026-11-14', amount: 0, status: 'skipped' },
    { date: '2026-11-15', amount: 0, status: 'skipped' },

    // 16/11/2026 to 19/11/2026 (4 days): delivered (₹14/day)
    { date: '2026-11-16', amount: 14, status: 'pending' },
    { date: '2026-11-17', amount: 14, status: 'pending' },
    { date: '2026-11-18', amount: 14, status: 'pending' },
    { date: '2026-11-19', amount: 14, status: 'pending' },
  ];

  const { data: insertedMilk, error: milkErr } = await supabase
    .from('daily_milk_logs')
    .insert(milkLogs)
    .select();

  if (milkErr) {
    console.error('Error seeding milk logs:', milkErr);
  } else {
    const deliveredCount = milkLogs.filter((m) => m.status !== 'skipped').length;
    const skippedCount = milkLogs.filter((m) => m.status === 'skipped').length;
    const totalAmount = milkLogs.reduce((sum, m) => sum + m.amount, 0);
    console.log(`Successfully seeded ${insertedMilk.length} daily milk records:`);
    console.log(`  Delivered days: ${deliveredCount} × ₹14 = ₹${totalAmount}`);
    console.log(`  Skipped days: ${skippedCount} × ₹0 = ₹0`);
    console.log(`  Net Pending: ₹${totalAmount}`);
  }

  console.log('\n--- Final Verification ---');
  const [chkDebts, chkMilk, chkTxs] = await Promise.all([
    supabase.from('debts').select('*'),
    supabase.from('daily_milk_logs').select('*'),
    supabase.from('transactions').select('*'),
  ]);

  console.log(`Debts in DB: ${chkDebts.data?.length}`);
  console.log(`Milk logs in DB: ${chkMilk.data?.length}`);
  console.log(`Transactions in DB: ${chkTxs.data?.length} (should be 0)`);
}

run().catch(console.error);
