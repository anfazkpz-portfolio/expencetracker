'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  ArrowUpRight,
  ArrowDownRight,
  User,
  Calendar,
  FileText,
  UserPlus,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { AnimatedModal } from '@/components/animations/MotionWrapper';
import { addLedgerTransaction } from '@/lib/ledger/ledgerManager';
import { invalidateFinanceQueries } from '@/lib/queries/invalidation';
import { getTodayDateString } from '@/lib/supabase/api';
import type { LedgerEntryType } from '@/types/ledger';

interface AddLedgerEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultContactName?: string;
  defaultType?: LedgerEntryType;
  availableContacts: string[];
  onEntryAdded?: () => void;
  onOpenAddContact?: () => void;
}

const AMOUNT_SHORTCUTS = [100, 200, 500, 1000, 2000, 5000];

export function AddLedgerEntryModal({
  isOpen,
  onClose,
  defaultContactName,
  defaultType = 'give',
  availableContacts,
  onEntryAdded,
  onOpenAddContact,
}: AddLedgerEntryModalProps) {
  const [contactName, setContactName] = useState(defaultContactName || '');
  const [type, setType] = useState<LedgerEntryType>(defaultType);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(getTodayDateString());
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (defaultContactName) {
      setContactName(defaultContactName);
    } else if (availableContacts.length > 0 && !contactName) {
      setContactName(availableContacts[0]);
    }
  }, [defaultContactName, availableContacts, contactName]);

  useEffect(() => {
    if (defaultType) setType(defaultType);
  }, [defaultType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsedAmount = parseFloat(amount);
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Please enter a valid positive amount.');
      return;
    }

    if (!contactName.trim()) {
      setError('Please select or add a person/account.');
      return;
    }

    setIsSubmitting(true);
    try {
      const ok = await addLedgerTransaction({
        contactName: contactName.trim(),
        type,
        amount: parsedAmount,
        date: date || getTodayDateString(),
        notes: notes.trim() || undefined,
      });

      if (!ok) {
        throw new Error('Failed to record ledger entry');
      }

      setAmount('');
      setNotes('');
      invalidateFinanceQueries('ledger');
      onEntryAdded?.();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Error saving entry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatedModal isOpen={isOpen} onClose={onClose} maxWidth="max-w-lg">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
          <div>
            <h3 className="text-sm font-semibold text-neutral-900">New Ledger Entry</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50/60 p-2.5 text-xs text-red-600">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          {/* Big Two-Way Action Selector */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setType('give')}
              className={`flex flex-col items-center justify-center rounded-xl p-3 border transition-all ${
                type === 'give'
                  ? 'border-rose-300 bg-rose-50/80 text-rose-800 ring-2 ring-rose-500/20 shadow-xs'
                  : 'border-neutral-200 bg-neutral-50/50 text-neutral-500 hover:bg-neutral-100'
              }`}
            >
              <div className="flex items-center gap-1.5 font-semibold text-xs">
                <ArrowUpRight className="h-4 w-4 text-rose-600" />
                <span>You Gave</span>
              </div>
              <span className="text-[10px] text-neutral-500 mt-0.5">
                Debit (They owe you)
              </span>
            </button>

            <button
              type="button"
              onClick={() => setType('take')}
              className={`flex flex-col items-center justify-center rounded-xl p-3 border transition-all ${
                type === 'take'
                  ? 'border-emerald-300 bg-emerald-50/80 text-emerald-800 ring-2 ring-emerald-500/20 shadow-xs'
                  : 'border-neutral-200 bg-neutral-50/50 text-neutral-500 hover:bg-neutral-100'
              }`}
            >
              <div className="flex items-center gap-1.5 font-semibold text-xs">
                <ArrowDownRight className="h-4 w-4 text-emerald-600" />
                <span>You Got</span>
              </div>
              <span className="text-[10px] text-neutral-500 mt-0.5">
                Credit (Repaid / Borrowed)
              </span>
            </button>
          </div>

          {/* Contact / Person Dropdown */}
          <div>
            <div className="flex items-center justify-between mb-1 h-4">
              <label className="text-[11px] font-medium uppercase tracking-wider text-neutral-400">
                Person / Account *
              </label>
              {onOpenAddContact && (
                <button
                  type="button"
                  onClick={onOpenAddContact}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 hover:text-emerald-700"
                >
                  <UserPlus className="h-3 w-3" />
                  + New Person
                </button>
              )}
            </div>

            <div className="relative">
              <User className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
              <select
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                required
                className="h-10 w-full rounded-xl border border-neutral-200 bg-neutral-50/50 pl-9 pr-8 py-2 text-xs text-neutral-900 focus:bg-white focus:border-neutral-900 focus:outline-hidden"
              >
                <option value="" disabled>
                  Select a person / account
                </option>
                {availableContacts.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Amount with INR Symbol */}
          <div>
            <div className="flex items-center justify-between mb-1 h-4">
              <label className="text-[11px] font-medium uppercase tracking-wider text-neutral-400">
                Amount (₹) *
              </label>
            </div>
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-neutral-400">
                ₹
              </span>
              <input
                type="number"
                step="any"
                min="0"
                required
                autoFocus
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="h-11 w-full rounded-xl border border-neutral-200 bg-neutral-50/50 pl-8 pr-3 py-2 text-base font-bold text-neutral-900 placeholder:text-neutral-300 focus:bg-white focus:border-neutral-900 focus:outline-hidden"
              />
            </div>

            {/* Quick Amount Chips */}
            <div className="mt-2 grid grid-cols-3 sm:grid-cols-6 gap-1.5">
              {AMOUNT_SHORTCUTS.map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setAmount(String(val))}
                  className="flex items-center justify-center rounded-lg border border-neutral-200 bg-white py-1.5 text-[11px] font-medium text-neutral-600 hover:border-neutral-400 hover:bg-neutral-50 hover:text-neutral-900 transition-colors shadow-2xs"
                >
                  +₹{val.toLocaleString('en-IN')}
                </button>
              ))}
            </div>
          </div>

          {/* Date & Note Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1 h-4">
                <label className="text-[11px] font-medium uppercase tracking-wider text-neutral-400">
                  Date
                </label>
              </div>
              <div className="relative">
                <Calendar className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="h-10 w-full rounded-xl border border-neutral-200 bg-neutral-50/50 pl-9 pr-3 py-2 text-xs text-neutral-900 focus:bg-white focus:border-neutral-900 focus:outline-hidden"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1 h-4">
                <label className="text-[11px] font-medium uppercase tracking-wider text-neutral-400">
                  Note
                </label>
                <span className="text-[10px] text-neutral-400 font-normal">Optional</span>
              </div>
              <div className="relative">
                <FileText className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                <input
                  type="text"
                  placeholder="e.g. Lunch split, Milk payment"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="h-10 w-full rounded-xl border border-neutral-200 bg-neutral-50/50 pl-9 pr-3 py-2 text-xs text-neutral-900 placeholder:text-neutral-400 focus:bg-white focus:border-neutral-900 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-neutral-100 mt-5">
            <button
              type="button"
              onClick={onClose}
              className="h-9 rounded-xl border border-neutral-200 px-4 text-xs font-medium text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !amount || !contactName}
              className={`h-9 inline-flex items-center justify-center gap-1.5 rounded-xl px-5 text-xs font-semibold text-white shadow-xs disabled:opacity-50 transition-colors ${
                type === 'give'
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {isSubmitting
                ? 'Recording...'
                : type === 'give'
                ? 'Record You Gave'
                : 'Record You Got'}
            </button>
          </div>
        </form>
      </div>
    </AnimatedModal>
  );
}

