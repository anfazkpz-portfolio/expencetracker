'use client';

import React, { useState } from 'react';
import { HandCoins, Check, Loader2 } from 'lucide-react';
import { addLedgerTransaction } from '@/lib/ledger/ledgerManager';
import type { Debt, DebtType, DebtStatus } from '@/types/database';

interface DebtFormProps {
  onSuccess?: (debt: Debt) => void;
  onCancel?: () => void;
  defaultType?: DebtType;
}

export function DebtForm({
  onSuccess,
  onCancel,
  defaultType = 'lent',
}: DebtFormProps) {
  const [personName, setPersonName] = useState<string>('');
  const [type, setType] = useState<DebtType>(defaultType);
  const [amount, setAmount] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>('');
  const [status, setStatus] = useState<DebtStatus>('pending');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsedAmount = parseFloat(amount);
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Please enter a valid amount.');
      return;
    }

    if (!personName.trim()) {
      setError("Please enter the person's name.");
      return;
    }

    setIsLoading(true);
    try {
      const ok = await addLedgerTransaction({
        contactName: personName,
        type: type === 'lent' ? 'give' : 'take',
        amount: parsedAmount,
        date: dueDate || undefined,
      });

      if (!ok) {
        throw new Error('Failed to save debt entry');
      }

      setPersonName('');
      setAmount('');
      setDueDate('');
      setStatus('pending');
      onSuccess?.({} as any);
    } catch (err: any) {
      setError(err?.message || 'Error saving debt.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Type Toggle: Lent vs Borrowed */}
      <div className="grid grid-cols-2 gap-1 rounded-lg border border-neutral-200 bg-neutral-100 p-1">
        <button
          type="button"
          onClick={() => setType('lent')}
          className={`rounded-md py-1.5 text-xs font-medium transition-all ${
            type === 'lent'
              ? 'bg-white text-neutral-900 shadow-xs'
              : 'text-neutral-500 hover:text-neutral-900'
          }`}
        >
          I Lent (To Receive)
        </button>
        <button
          type="button"
          onClick={() => setType('borrowed')}
          className={`rounded-md py-1.5 text-xs font-medium transition-all ${
            type === 'borrowed'
              ? 'bg-white text-neutral-900 shadow-xs'
              : 'text-neutral-500 hover:text-neutral-900'
          }`}
        >
          I Borrowed (To Pay)
        </button>
      </div>

      {/* Person Name & Amount */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-medium uppercase tracking-wider text-neutral-400 mb-1">
            Person Name
          </label>
          <input
            type="text"
            required
            placeholder="e.g. Rahul, Sneha"
            value={personName}
            onChange={(e) => setPersonName(e.target.value)}
            className="w-full rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-hidden"
          />
        </div>

        <div>
          <label className="block text-[11px] font-medium uppercase tracking-wider text-neutral-400 mb-1">
            Amount
          </label>
          <div className="relative flex items-center">
            <span className="absolute left-3 text-xs font-medium text-neutral-400">
              ₹
            </span>
            <input
              type="number"
              step="any"
              min="0"
              required
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-md border border-neutral-200 bg-white py-1.5 pl-7 pr-3 text-sm font-semibold text-neutral-900 placeholder:text-neutral-300 focus:border-neutral-900 focus:outline-hidden"
            />
          </div>
        </div>
      </div>

      {/* Due Date & Status */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-medium uppercase tracking-wider text-neutral-400 mb-1">
            Due Date (Optional)
          </label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-900 focus:border-neutral-900 focus:outline-hidden"
          />
        </div>

        <div>
          <label className="block text-[11px] font-medium uppercase tracking-wider text-neutral-400 mb-1">
            Status
          </label>
          <div className="grid grid-cols-2 gap-1 rounded-md border border-neutral-200 bg-neutral-50 p-1">
            <button
              type="button"
              onClick={() => setStatus('pending')}
              className={`rounded py-1 text-xs font-medium transition-colors ${
                status === 'pending'
                  ? 'bg-neutral-900 text-white'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Pending
            </button>
            <button
              type="button"
              onClick={() => setStatus('settled')}
              className={`rounded py-1 text-xs font-medium transition-colors ${
                status === 'settled'
                  ? 'bg-neutral-900 text-white'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Cleared
            </button>
          </div>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50/50 p-2 text-xs text-red-600">
          {error}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-2 pt-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="rounded-md border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 rounded-md bg-neutral-900 px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-neutral-800 disabled:opacity-50"
        >
          {isLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
          <span>Save Debt</span>
        </button>
      </div>
    </form>
  );
}

