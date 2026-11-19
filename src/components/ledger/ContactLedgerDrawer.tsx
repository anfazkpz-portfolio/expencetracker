'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Phone,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  Trash2,
  Calendar,
  CreditCard,
  Plus,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatCurrency, formatDateDDMMYYYY } from '@/lib/utils';
import { settleContactLedger } from '@/lib/ledger/ledgerManager';
import { deleteDebt } from '@/lib/supabase/api';
import type { ContactSummary, LedgerEntry } from '@/types/ledger';

interface ContactLedgerDrawerProps {
  contact: ContactSummary | null;
  onClose: () => void;
  onOpenAddEntry: (type: 'give' | 'take', contactName: string) => void;
  onRefresh: () => void;
}

export function ContactLedgerDrawer({
  contact,
  onClose,
  onOpenAddEntry,
  onRefresh,
}: ContactLedgerDrawerProps) {
  const [isSettling, setIsSettling] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!contact) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [contact, onClose]);

  if (!contact) return null;

  const handleSettle = async () => {
    if (!confirm(`Settle full balance of ${formatCurrency(Math.abs(contact.netBalance))} with ${contact.name}?`)) {
      return;
    }

    setIsSettling(true);
    try {
      await settleContactLedger(contact.name);
      onRefresh();
    } catch (err) {
      console.error('Failed to settle balance:', err);
    } finally {
      setIsSettling(false);
    }
  };

  const handleDeleteEntry = async (entry: LedgerEntry) => {
    if (!confirm(`Delete this entry of ${formatCurrency(entry.amount)}?`)) return;

    setDeletingId(entry.id);
    try {
      await deleteDebt(entry.id);
      onRefresh();
    } catch (err) {
      console.error('Failed to delete entry:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const initials = contact.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm">
        {/* Backdrop click to dismiss */}
        <div className="fixed inset-0" onClick={onClose} />

        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          className="relative z-10 flex h-full w-full max-w-md flex-col bg-white shadow-2xl"
        >
          {/* Header */}
          <div className="border-b border-neutral-100 bg-white/95 p-4 backdrop-blur-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-xs font-bold text-white">
                  {initials}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-neutral-900">{contact.name}</h3>
                  {contact.phone ? (
                    <a
                      href={`tel:${contact.phone}`}
                      className="inline-flex items-center gap-1 text-[11px] text-emerald-600 hover:underline"
                    >
                      <Phone className="h-3 w-3" />
                      {contact.phone}
                    </a>
                  ) : (
                    <span className="text-[11px] text-neutral-400">Ledger Account</span>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Net Balance Hero Card */}
            <div
              className={`mt-4 rounded-xl border p-3.5 transition-colors ${
                contact.status === 'to_receive'
                  ? 'border-emerald-200 bg-emerald-50/40 text-emerald-900'
                  : contact.status === 'to_pay'
                  ? 'border-rose-200 bg-rose-50/40 text-rose-900'
                  : 'border-neutral-200 bg-neutral-50/60 text-neutral-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                    Net Outstanding
                  </span>
                  <div className="text-xl sm:text-2xl font-bold tracking-tight">
                    {formatCurrency(Math.abs(contact.netBalance))}
                  </div>
                  <span
                    className={`text-xs font-semibold ${
                      contact.status === 'to_receive'
                        ? 'text-emerald-700'
                        : contact.status === 'to_pay'
                        ? 'text-rose-700'
                        : 'text-neutral-500'
                    }`}
                  >
                    {contact.status === 'to_receive'
                      ? 'You will receive (They owe you)'
                      : contact.status === 'to_pay'
                      ? 'You will give (You owe them)'
                      : 'Account is settled'}
                  </span>
                </div>

                {contact.netBalance !== 0 && (
                  <button
                    type="button"
                    onClick={handleSettle}
                    disabled={isSettling}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-800 hover:bg-neutral-50 shadow-2xs disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    {isSettling ? 'Settling...' : 'Settle'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Statement Entries List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
            <div className="flex items-center justify-between pb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                Transaction Statement ({contact.entries.length})
              </span>
              <span className="text-[11px] text-neutral-400">Recent first</span>
            </div>

            {contact.entries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-neutral-400">
                <CreditCard className="h-8 w-8 stroke-[1.2] mb-2 text-neutral-300" />
                <p className="text-xs">No transactions recorded yet.</p>
                <p className="text-[10px] text-neutral-400">Use the buttons below to record Give or Take.</p>
              </div>
            ) : (
              contact.entries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between rounded-xl border border-neutral-100 bg-white p-3 shadow-2xs hover:border-neutral-200 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                        entry.type === 'give'
                          ? 'bg-rose-50 text-rose-600'
                          : 'bg-emerald-50 text-emerald-600'
                      }`}
                    >
                      {entry.type === 'give' ? (
                        <ArrowUpRight className="h-4 w-4" />
                      ) : (
                        <ArrowDownRight className="h-4 w-4" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-neutral-900">
                          {entry.type === 'give' ? 'You Gave' : 'You Got'}
                        </span>
                        {entry.status === 'settled' && (
                          <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[9px] font-medium text-neutral-500">
                            Settled
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-neutral-400 mt-0.5">
                        <span>{formatDateDDMMYYYY(entry.date)}</span>
                        {entry.notes && (
                          <>
                            <span>•</span>
                            <span className="text-neutral-600 italic truncate max-w-[140px]">
                              {entry.notes}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-sm font-bold tracking-tight ${
                        entry.type === 'give' ? 'text-rose-600' : 'text-emerald-600'
                      }`}
                    >
                      {entry.type === 'give' ? '-' : '+'}
                      {formatCurrency(entry.amount)}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleDeleteEntry(entry)}
                      disabled={deletingId === entry.id}
                      className="rounded-md p-1 text-neutral-300 hover:bg-neutral-100 hover:text-red-500 transition-colors"
                      title="Delete entry"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Mobile Bottom Quick Actions */}
          <div className="border-t border-neutral-100 bg-white p-3.5 shadow-lg">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onOpenAddEntry('give', contact.name)}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-rose-600 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-rose-700 transition-colors"
              >
                <ArrowUpRight className="h-4 w-4" />
                <span>You Gave (Debit)</span>
              </button>

              <button
                type="button"
                onClick={() => onOpenAddEntry('take', contact.name)}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 transition-colors"
              >
                <ArrowDownRight className="h-4 w-4" />
                <span>You Got (Credit)</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
