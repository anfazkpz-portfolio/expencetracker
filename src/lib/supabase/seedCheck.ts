import { supabase } from './client';

let isSeedingRunning = false;

/**
 * Ensures initial opening balances (8 Creditors = ₹24,915, 1 Debtor = ₹200)
 * and November daily milk logs exist in Supabase without duplicating on repeated loads.
 */
export async function ensureInitialDataSeeded() {
  if (isSeedingRunning) return;
  isSeedingRunning = true;

  try {
    // 1. Check Debts table: only seed if table is completely empty (0 rows)
    const { count: debtsCount, error: debtsErr } = await supabase
      .from('debts')
      .select('*', { count: 'exact', head: true });

    if (!debtsErr && debtsCount === 0) {
      const creditors = [
        { person_name: 'murshid', amount: 500, type: 'borrowed' as const, status: 'pending' as const, due_date: '2026-11-01' },
        { person_name: 'shammas alp', amount: 1200, type: 'borrowed' as const, status: 'pending' as const, due_date: '2026-11-01' },
        { person_name: 'risala calender', amount: 150, type: 'borrowed' as const, status: 'pending' as const, due_date: '2026-11-01' },
        { person_name: 'ssf member ship', amount: 460, type: 'borrowed' as const, status: 'pending' as const, due_date: '2026-11-01' },
        { person_name: 'shammas kdr', amount: 800, type: 'borrowed' as const, status: 'pending' as const, due_date: '2026-11-01' },
        { person_name: 'aban', amount: 3600, type: 'borrowed' as const, status: 'pending' as const, due_date: '2026-11-01' },
        { person_name: 'swabah', amount: 805, type: 'borrowed' as const, status: 'pending' as const, due_date: '2026-11-01' },
        { person_name: 'umma', amount: 17400, type: 'borrowed' as const, status: 'pending' as const, due_date: '2026-11-01' },
      ];

      const debtors = [
        { person_name: 'aflah kannur', amount: 200, type: 'lent' as const, status: 'pending' as const, due_date: '2026-11-01' },
      ];

      await supabase.from('debts').insert([...creditors, ...debtors]);
    }

    // 2. Check Daily Milk Logs table: only seed if table is completely empty (0 rows)
    const { count: milkCount, error: milkErr } = await supabase
      .from('daily_milk_logs')
      .select('*', { count: 'exact', head: true });

    if (!milkErr && milkCount === 0) {
      const milkLogs = [
        { date: '2026-11-01', amount: 0, status: 'skipped' as const },
        { date: '2026-11-02', amount: 14, status: 'pending' as const },
        { date: '2026-11-03', amount: 14, status: 'pending' as const },
        { date: '2026-11-04', amount: 14, status: 'pending' as const },
        { date: '2026-11-05', amount: 14, status: 'pending' as const },
        { date: '2026-11-06', amount: 14, status: 'pending' as const },
        { date: '2026-11-07', amount: 14, status: 'pending' as const },
        { date: '2026-11-08', amount: 14, status: 'pending' as const },
        { date: '2026-11-09', amount: 14, status: 'pending' as const },
        { date: '2026-11-10', amount: 14, status: 'pending' as const },
        { date: '2026-11-11', amount: 14, status: 'pending' as const },
        { date: '2026-11-12', amount: 14, status: 'pending' as const },
        { date: '2026-11-13', amount: 0, status: 'skipped' as const },
        { date: '2026-11-14', amount: 0, status: 'skipped' as const },
        { date: '2026-11-15', amount: 0, status: 'skipped' as const },
        { date: '2026-11-16', amount: 14, status: 'pending' as const },
        { date: '2026-11-17', amount: 14, status: 'pending' as const },
        { date: '2026-11-18', amount: 14, status: 'pending' as const },
        { date: '2026-11-19', amount: 14, status: 'pending' as const },
      ];

      await supabase.from('daily_milk_logs').insert(milkLogs);
    }

    // 3. Check App Settings for milk subscription
    const { data: milkSettingsData } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'milk_subscription')
      .maybeSingle();

    if (!milkSettingsData) {
      await supabase.from('app_settings').upsert({
        key: 'milk_subscription',
        value: {
          status: 'active',
          dailyPrice: 14,
          startDate: '2026-11-01',
          pausedPeriods: [
            { startDate: '2026-11-01', endDate: '2026-11-01' },
            { startDate: '2026-11-13', endDate: '2026-11-15' },
          ],
          pausedAt: null,
        },
        updated_at: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.warn('[SeedCheck] Non-fatal initial data check:', err);
  } finally {
    isSeedingRunning = false;
  }
}
