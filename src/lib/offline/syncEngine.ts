/**
 * Background Sync Engine
 * Reconciles offline actions with Supabase when online.
 */

import { supabase } from '@/lib/supabase/client';
import {
  getSyncQueue,
  removeSyncItem,
  setCache,
  getCache,
  SyncItem,
} from './db';
import type { Transaction, Debt } from '@/types/database';

export interface SyncStatus {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  lastSyncedAt: string | null;
}

let isSyncingInProgress = false;

export function isDeviceOnline(): boolean {
  if (typeof window === 'undefined') return true;
  return typeof navigator.onLine === 'boolean' ? navigator.onLine : true;
}

/**
 * Dispatches an event with current sync status so any UI badge can reflect it
 */
export async function emitSyncStatus(pendingCount?: number) {
  if (typeof window === 'undefined') return;

  let count = pendingCount;
  if (count === undefined) {
    const queue = await getSyncQueue();
    count = queue.length;
  }

  const detail: SyncStatus = {
    isOnline: isDeviceOnline(),
    pendingCount: count,
    isSyncing: isSyncingInProgress,
    lastSyncedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  };

  window.dispatchEvent(new CustomEvent('cashmanager:sync-status', { detail }));
}

/**
 * Processes all items in the offline queue and submits them to Supabase
 */
export async function syncPendingOutbox(): Promise<{ synced: number; failed: number }> {
  if (typeof window === 'undefined' || isSyncingInProgress) {
    return { synced: 0, failed: 0 };
  }

  if (!isDeviceOnline()) {
    await emitSyncStatus();
    return { synced: 0, failed: 0 };
  }

  isSyncingInProgress = true;
  await emitSyncStatus();

  let synced = 0;
  let failed = 0;

  try {
    const queue = await getSyncQueue();
    if (queue.length === 0) {
      isSyncingInProgress = false;
      await emitSyncStatus(0);
      return { synced: 0, failed: 0 };
    }

    for (const item of queue) {
      try {
        let success = false;

        switch (item.type) {
          case 'CREATE_TRANSACTION': {
            const { error } = await supabase.from('transactions').insert([item.payload]);
            if (!error) success = true;
            break;
          }

          case 'DELETE_TRANSACTION': {
            const { error } = await supabase
              .from('transactions')
              .delete()
              .eq('id', item.payload.id);
            if (!error) success = true;
            break;
          }

          case 'CREATE_DEBT': {
            const { error } = await supabase.from('debts').insert([item.payload]);
            if (!error) success = true;
            break;
          }

          case 'UPDATE_DEBT_STATUS': {
            const { error } = await supabase
              .from('debts')
              .update({ status: item.payload.status })
              .eq('id', item.payload.id);
            if (!error) success = true;
            break;
          }

          case 'RECORD_DEBT_PAYMENT': {
            // 1. Create transaction
            if (item.payload.transaction) {
              await supabase.from('transactions').insert([item.payload.transaction]);
            }
            // 2. Update debt paid_amount & status
            const updatePayload: any = {
              status: item.payload.newStatus,
            };
            if (item.payload.newPaidAmount !== undefined) {
              updatePayload.paid_amount = item.payload.newPaidAmount;
            }
            const { error } = await supabase
              .from('debts')
              .update(updatePayload)
              .eq('id', item.payload.debtId);

            if (!error) success = true;
            break;
          }

          case 'DELETE_DEBT': {
            const { error } = await supabase.from('debts').delete().eq('id', item.payload.id);
            if (!error) success = true;
            break;
          }

          case 'RECORD_MILK_PAYMENT': {
            const { error } = await supabase.from('transactions').insert([item.payload]);
            if (!error) success = true;
            break;
          }

          case 'LOG_MILK': {
            const { error } = await supabase.from('daily_milk_logs').insert([item.payload]);
            if (!error) success = true;
            break;
          }

          case 'UPDATE_MILK_LOG': {
            const { id, date, ...updates } = item.payload;
            const query = id
              ? supabase.from('daily_milk_logs').update(updates).eq('id', id)
              : supabase.from('daily_milk_logs').update(updates).eq('date', date);
            const { error } = await query;
            if (!error) success = true;
            break;
          }

          default:
            success = true;
            break;
        }

        if (success) {
          await removeSyncItem(item.id);
          synced++;
        } else {
          failed++;
        }
      } catch (err) {
        console.warn(`Error syncing item ${item.id}:`, err);
        failed++;
      }
    }

    if (synced > 0) {
      window.dispatchEvent(new CustomEvent('cashmanager:refresh'));
    }
  } catch (err) {
    console.error('Fatal error during syncPendingOutbox:', err);
  } finally {
    isSyncingInProgress = false;
    await emitSyncStatus();
  }

  return { synced, failed };
}

