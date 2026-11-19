import { supabase } from '@/lib/supabase/client';
import { getCache, setCache, enqueueSync } from '@/lib/offline/db';
import { isDeviceOnline, emitSyncStatus } from '@/lib/offline/syncEngine';
import { invalidateFinanceQueries } from '@/lib/queries/invalidation';
import type { DailyMilkLog, MilkLogStatus } from '@/types/database';

export type MilkSubscriptionStatus = 'active' | 'paused';

export interface PausedPeriod {
  startDate: string; // YYYY-MM-DD
  endDate?: string | null; // YYYY-MM-DD (null if currently active pause)
}

export interface MilkSubscriptionSettings {
  status: MilkSubscriptionStatus;
  dailyPrice: number; // default 14
  startDate?: string;
  pausedPeriods: PausedPeriod[];
  pausedAt?: string | null;
  lastBackfillRun?: string;
}

const STORAGE_KEY = 'cashmanager_milk_subscription';
const CACHE_KEY = 'milk_subscription_settings';

/**
 * Returns today's date formatted as YYYY-MM-DD in Indian Standard Time (IST, UTC+5:30)
 */
export function getISTTodayDateString(): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

/**
 * Adds (or subtracts) days to a YYYY-MM-DD string using UTC math to avoid DST/timezone drift
 */
export function addDaysToDateString(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Default settings for Milk Subscription
 */
export function getDefaultMilkSettings(): MilkSubscriptionSettings {
  return {
    status: 'paused',
    dailyPrice: 14,
    pausedPeriods: [],
    pausedAt: null,
    startDate: undefined,
  };
}

/**
 * Retrieves milk subscription settings (localStorage + IndexedDB cache)
 */
export async function getMilkSubscriptionSettings(): Promise<MilkSubscriptionSettings> {
  let settings: MilkSubscriptionSettings | null = null;

  // 1. Try synchronous localStorage for instant UI response
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        settings = JSON.parse(raw);
      }
    } catch (e) {
      console.warn('Failed to read milk settings from localStorage', e);
    }
  }

  // 2. Try IndexedDB cache
  if (!settings) {
    try {
      settings = await getCache<MilkSubscriptionSettings>(CACHE_KEY);
    } catch (e) {
      console.warn('Failed to read milk settings from IndexedDB', e);
    }
  }

  if (!settings) {
    settings = getDefaultMilkSettings();
  }

  // Ensure array safety
  if (!Array.isArray(settings.pausedPeriods)) {
    settings.pausedPeriods = [];
  }

  return settings;
}

/**
 * Saves milk subscription settings
 */
export async function saveMilkSubscriptionSettings(
  updates: Partial<MilkSubscriptionSettings>
): Promise<MilkSubscriptionSettings> {
  const current = await getMilkSubscriptionSettings();
  const updated: MilkSubscriptionSettings = {
    ...current,
    ...updates,
  };

  // 1. Save to localStorage
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to save milk settings to localStorage', e);
    }
  }

  // 2. Save to IndexedDB
  await setCache(CACHE_KEY, updated);

  // 3. Dispatch events to notify UI
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('cashmanager:milk-subscription-updated', { detail: updated })
    );
    window.dispatchEvent(new CustomEvent('cashmanager:refresh'));
  }

  return updated;
}

/**
 * Pauses the milk subscription (Stop Auto-Entry)
 */
export async function pauseMilkSubscription(): Promise<MilkSubscriptionSettings> {
  const today = getISTTodayDateString();
  const current = await getMilkSubscriptionSettings();

  const newPeriods = [...(current.pausedPeriods || [])];
  // Add new paused period if not already pausing
  const hasOpenPause = newPeriods.some((p) => !p.endDate);
  if (!hasOpenPause) {
    newPeriods.push({ startDate: today, endDate: null });
  }

  const updated = await saveMilkSubscriptionSettings({
    status: 'paused',
    pausedAt: today,
    pausedPeriods: newPeriods,
  });

  return updated;
}

/**
 * Resumes the milk subscription (Resume Auto-Entry)
 */
export async function resumeMilkSubscription(): Promise<MilkSubscriptionSettings> {
  const today = getISTTodayDateString();
  const current = await getMilkSubscriptionSettings();

  // Close any open paused period
  const newPeriods = (current.pausedPeriods || []).map((p) => {
    if (!p.endDate) {
      return { ...p, endDate: addDaysToDateString(today, -1) };
    }
    return p;
  });

  const updated = await saveMilkSubscriptionSettings({
    status: 'active',
    pausedAt: null,
    pausedPeriods: newPeriods,
  });

  // Automatically trigger backfill check to catch up immediately
  try {
    await runMilkAutoBackfill();
  } catch (err) {
    console.warn('Auto-backfill on resume failed:', err);
  }

  return updated;
}

/**
 * Checks if a specific date (YYYY-MM-DD) falls in a paused period
 */
export function isDateInPausedPeriod(
  dateStr: string,
  settings: MilkSubscriptionSettings
): boolean {
  // If subscription is currently paused and date is on or after pause date
  if (settings.status === 'paused' && settings.pausedAt && dateStr >= settings.pausedAt) {
    return true;
  }

  // Check historical paused periods
  for (const period of settings.pausedPeriods || []) {
    if (dateStr >= period.startDate) {
      if (!period.endDate || dateStr <= period.endDate) {
        return true;
      }
    }
  }

  return false;
}

export interface BackfillResult {
  backfilledCount: number;
  backfilledDates: string[];
  today: string;
  status: MilkSubscriptionStatus;
}

/**
 * Core Auto-Backfill Engine:
 * Analyzes gaps between logged dates and today in IST.
 * For every day where subscription was active and no entry exists,
 * inserts a delivered record (amount: 14, status: 'pending').
 */
export async function runMilkAutoBackfill(): Promise<BackfillResult> {
  const today = getISTTodayDateString();
  const settings = await getMilkSubscriptionSettings();

  // Fetch existing logs from database or local cache
  let existingLogs: DailyMilkLog[] = [];
  if (isDeviceOnline()) {
    try {
      const { data, error } = await supabase
        .from('daily_milk_logs')
        .select('*')
        .order('date', { ascending: false })
        .limit(365);
      if (!error && data) {
        existingLogs = data;
        await setCache('cache_daily_milk_logs', data);
      }
    } catch (err) {
      console.warn('Supabase fetch failed during backfill, checking cache:', err);
    }
  }

  if (existingLogs.length === 0) {
    existingLogs = (await getCache<DailyMilkLog[]>('cache_daily_milk_logs')) || [];
  }

  // If there are NO existing logs in the database or cache, do NOT auto-generate ghost past entries!
  // The user starts cleanly at 0 days and ₹0.
  if (existingLogs.length === 0) {
    return {
      backfilledCount: 0,
      backfilledDates: [],
      today,
      status: settings.status,
    };
  }

  const existingDatesSet = new Set(existingLogs.map((l) => l.date));

  // Determine starting date to check
  // If we have previous logs, start checking from either the latest log date or up to 60 days ago
  let startDateToCheck: string;
  if (existingLogs.length > 0) {
    // Sort dates ascending
    const sortedDates = Array.from(existingDatesSet).sort();
    const latestDate = sortedDates[sortedDates.length - 1];
    const earliestDate = sortedDates[0];

    // Check gaps starting from earliest known date or at least 45 days ago
    const sixtyDaysAgo = addDaysToDateString(today, -60);
    startDateToCheck = earliestDate > sixtyDaysAgo ? earliestDate : sixtyDaysAgo;
  } else {
    startDateToCheck = settings.startDate || addDaysToDateString(today, -30);
  }

  // Iterate calendar day by day from startDateToCheck to today
  const missingToInsert: Array<{ date: string; amount: number; status: MilkLogStatus }> = [];
  let curr = startDateToCheck;

  while (curr <= today) {
    // 0. Historical protection: never auto-generate or overwrite dates on or before 2026-11-19
    if (curr <= '2026-11-19') {
      curr = addDaysToDateString(curr, 1);
      continue;
    }

    // 1. If entry already exists, skip
    if (!existingDatesSet.has(curr)) {
      // 2. If subscription was paused on this date, skip
      if (!isDateInPausedPeriod(curr, settings)) {
        missingToInsert.push({
          date: curr,
          amount: settings.dailyPrice || 14,
          status: 'pending', // Delivered on credit
        });
      }
    }
    curr = addDaysToDateString(curr, 1);
  }

  if (missingToInsert.length === 0) {
    return {
      backfilledCount: 0,
      backfilledDates: [],
      today,
      status: settings.status,
    };
  }

  // Perform insertion
  const insertedDates: string[] = [];
  if (isDeviceOnline()) {
    try {
      // Insert in chunks of 50 to prevent payload limits
      for (let i = 0; i < missingToInsert.length; i += 50) {
        const chunk = missingToInsert.slice(i, i + 50);
        const { data, error } = await supabase
          .from('daily_milk_logs')
          .insert(chunk)
          .select();

        if (error) {
          throw error;
        }

        if (data) {
          data.forEach((d) => insertedDates.push(d.date));
        }
      }
    } catch (err) {
      console.error('Failed to insert backfilled milk logs to Supabase:', err);
    }
  }

  // If offline or some failed, queue them and update local cache
  if (insertedDates.length < missingToInsert.length) {
    const uninserted = missingToInsert.filter((m) => !insertedDates.includes(m.date));
    for (const item of uninserted) {
      const offlineLog: DailyMilkLog = {
        id: `offline-milk-${item.date}-${Date.now()}`,
        date: item.date,
        amount: item.amount,
        status: item.status,
        created_at: new Date().toISOString(),
      };
      existingLogs.push(offlineLog);
      insertedDates.push(item.date);
      await enqueueSync('LOG_MILK', item);
    }
    await emitSyncStatus();
  }

  // Update local cache
  const refreshedLogs = [...existingLogs].sort((a, b) => b.date.localeCompare(a.date));
  await setCache('cache_daily_milk_logs', refreshedLogs);

  // Invalidate queries so UI and pending bill update immediately
  invalidateFinanceQueries('milk');
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('cashmanager:refresh'));
  }

  await saveMilkSubscriptionSettings({
    lastBackfillRun: today,
  });

  return {
    backfilledCount: insertedDates.length,
    backfilledDates: insertedDates,
    today,
    status: settings.status,
  };
}

/**
 * Toggles a specific date's milk log between 'skipped' (₹0) and 'pending' / delivered (₹14).
 * Affects ONLY that single specific date.
 */
export async function toggleMilkDateStatus(
  dateStr: string,
  forceStatus?: MilkLogStatus
): Promise<{ success: boolean; date: string; newStatus: MilkLogStatus }> {
  // 1. Fetch current log for this date
  let existing: DailyMilkLog | null = null;
  const cached = (await getCache<DailyMilkLog[]>('cache_daily_milk_logs')) || [];
  existing = cached.find((l) => l.date === dateStr) || null;

  if (!existing && isDeviceOnline()) {
    try {
      const { data } = await supabase
        .from('daily_milk_logs')
        .select('*')
        .eq('date', dateStr)
        .maybeSingle();
      existing = data;
    } catch (e) {
      console.warn('Failed to query single milk log:', e);
    }
  }

  // Determine target status
  let newStatus: MilkLogStatus;
  if (forceStatus) {
    newStatus = forceStatus;
  } else if (existing) {
    newStatus = existing.status === 'skipped' ? 'pending' : 'skipped';
  } else {
    newStatus = 'skipped';
  }

  const amount = newStatus === 'skipped' ? 0 : 14;

  if (existing) {
    // Update existing record
    if (isDeviceOnline()) {
      await supabase
        .from('daily_milk_logs')
        .update({ status: newStatus, amount })
        .eq('id', existing.id);
    } else {
      await enqueueSync('UPDATE_MILK_LOG', { id: existing.id, date: dateStr, status: newStatus, amount });
      await emitSyncStatus();
    }

    // Optimistic cache update
    const updatedCache = cached.map((l) =>
      l.id === existing!.id ? { ...l, status: newStatus, amount } : l
    );
    await setCache('cache_daily_milk_logs', updatedCache);
  } else {
    // Insert new record for this date
    const payload = {
      date: dateStr,
      status: newStatus,
      amount,
    };

    if (isDeviceOnline()) {
      const { data } = await supabase.from('daily_milk_logs').insert([payload]).select().single();
      if (data) {
        cached.unshift(data);
      }
    } else {
      const offlineItem: DailyMilkLog = {
        id: `offline-milk-${dateStr}-${Date.now()}`,
        date: dateStr,
        status: newStatus,
        amount,
        created_at: new Date().toISOString(),
      };
      cached.unshift(offlineItem);
      await enqueueSync('LOG_MILK', payload);
      await emitSyncStatus();
    }

    await setCache('cache_daily_milk_logs', cached);
  }

  // Invalidate finance caches
  invalidateFinanceQueries('milk');
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('cashmanager:refresh'));
  }

  return {
    success: true,
    date: dateStr,
    newStatus,
  };
}
