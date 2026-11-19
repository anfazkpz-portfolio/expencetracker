'use client';

import React, { useState } from 'react';
import { UserPlus, X, Phone, FileText, User } from 'lucide-react';
import { AnimatedModal } from '@/components/animations/MotionWrapper';
import { addLedgerContact } from '@/lib/ledger/ledgerManager';
import { invalidateFinanceQueries } from '@/lib/queries/invalidation';
import type { LedgerContact } from '@/types/ledger';

interface AddContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  onContactCreated?: (contact: LedgerContact) => void;
}

export function AddContactModal({
  isOpen,
  onClose,
  onContactCreated,
}: AddContactModalProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = name.trim();
    if (!trimmed) {
      setError('Please enter a person or account name.');
      return;
    }

    setIsSubmitting(true);
    try {
      const contact = await addLedgerContact({
        name: trimmed,
        phone: phone.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      setName('');
      setPhone('');
      setNotes('');
      invalidateFinanceQueries('ledger');
      onContactCreated?.(contact);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to create contact.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatedModal isOpen={isOpen} onClose={onClose}>
      <div>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-900 text-white">
              <UserPlus className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-neutral-900">Add Person / Account</h3>
            </div>
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          <div>
            <div className="flex items-center justify-between mb-1 h-4">
              <label className="text-[11px] font-medium uppercase tracking-wider text-neutral-400">
                Person / Account Name *
              </label>
            </div>
            <div className="relative">
              <User className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
              <input
                type="text"
                required
                autoFocus
                placeholder="e.g. Rahul, Landlord, Store"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-10 w-full rounded-xl border border-neutral-200 bg-neutral-50/50 pl-9 pr-3 py-2 text-xs text-neutral-900 placeholder:text-neutral-400 focus:bg-white focus:border-neutral-900 focus:outline-hidden"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1 h-4">
              <label className="text-[11px] font-medium uppercase tracking-wider text-neutral-400">
                Phone Number
              </label>
              <span className="text-[10px] text-neutral-400 font-normal">Optional</span>
            </div>
            <div className="relative">
              <Phone className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
              <input
                type="tel"
                placeholder="e.g. +91 9876543210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="h-10 w-full rounded-xl border border-neutral-200 bg-neutral-50/50 pl-9 pr-3 py-2 text-xs text-neutral-900 placeholder:text-neutral-400 focus:bg-white focus:border-neutral-900 focus:outline-hidden"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1 h-4">
              <label className="text-[11px] font-medium uppercase tracking-wider text-neutral-400">
                Note / Relationship
              </label>
              <span className="text-[10px] text-neutral-400 font-normal">Optional</span>
            </div>
            <div className="relative">
              <FileText className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
              <input
                type="text"
                placeholder="e.g. Roommate, Supplier, Friend"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="h-10 w-full rounded-xl border border-neutral-200 bg-neutral-50/50 pl-9 pr-3 py-2 text-xs text-neutral-900 placeholder:text-neutral-400 focus:bg-white focus:border-neutral-900 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-neutral-100 mt-5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-xs font-semibold text-neutral-600 hover:bg-neutral-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl bg-neutral-900 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-neutral-800 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Creating...' : 'Create Account'}
            </button>
          </div>
        </form>
      </div>
    </AnimatedModal>
  );
}
