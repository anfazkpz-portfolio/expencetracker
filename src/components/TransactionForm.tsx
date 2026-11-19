'use client';

import React, { useState } from 'react';
import { Plus, Check, Loader2 } from 'lucide-react';
import { createTransaction, getTodayDateString } from '@/lib/supabase/api';
import { invalidateFinanceQueries } from '@/lib/queries/invalidation';
import type { Transaction, TransactionType } from '@/types/database';

const DEFAULT_EXPENSE_CATEGORIES = [
  'Food & Dining',
  'Groceries',
  'Travel & Fuel',
  'Bills & Utilities',
  'Shopping',
  'Health',
  'Entertainment',
  'Debt Repayment',
  'Lent / Loan Given',
];

const DEFAULT_INCOME_CATEGORIES = [
  'Salary',
  'Swiggy',
  'Freelance',
  'Investments',
  'Gifts',
  'Cashback',
  'Borrowed / Loan Taken',
  'Debt Collection',
];

interface TransactionFormProps {
  onSuccess?: (transaction: Transaction) => void;
  onCancel?: () => void;
  defaultType?: TransactionType;
}

export function TransactionForm({
  onSuccess,
  onCancel,
  defaultType = 'expense',
}: TransactionFormProps) {
  const [type, setType] = useState<TransactionType>(defaultType);
  const [amount, setAmount] = useState<string>('');
  const [category, setCategory] = useState<string>('');
  const [customCategory, setCustomCategory] = useState<string>('');
  const [isTypingCustom, setIsTypingCustom] = useState<boolean>(false);
  const [date, setDate] = useState<string>(getTodayDateString());
  const [description, setDescription] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const categories =
    type === 'expense' ? DEFAULT_EXPENSE_CATEGORIES : DEFAULT_INCOME_CATEGORIES;

  const handleSelectCategory = (cat: string) => {
    setCategory(cat);
    setCustomCategory('');
    setIsTypingCustom(false);
  };

  const handleCustomCategoryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomCategory(val);
    setCategory(val);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsedAmount = parseFloat(amount);
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Please enter a valid amount greater than 0.');
      return;
    }

    const finalCategory = category.trim();
    if (!finalCategory) {
      setError('Please select or type a category.');
      return;
    }

    setIsLoading(true);
    try {
      const { data, error: err } = await createTransaction({
        amount: parsedAmount,
        type,
        category: finalCategory,
        date,
        description,
      });

      if (err || !data) {
        throw err || new Error('Failed to create transaction');
      }

      // Reset form
      setAmount('');
      setCategory('');
      setCustomCategory('');
      setIsTypingCustom(false);
      setDescription('');
      invalidateFinanceQueries('transactions');
      onSuccess?.(data);
    } catch (err: any) {
      setError(err?.message || 'Error saving transaction.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Type Toggle: Expense / Income */}
      <div className="grid grid-cols-2 gap-1 rounded-lg border border-neutral-200 bg-neutral-100 p-1">
        <button
          type="button"
          onClick={() => {
            setType('expense');
            setCategory('');
            setCustomCategory('');
          }}
          className={`rounded-md py-1.5 text-xs font-medium transition-all ${
            type === 'expense'
              ? 'bg-white text-neutral-900 shadow-xs'
              : 'text-neutral-500 hover:text-neutral-900'
          }`}
        >
          Expense
        </button>
        <button
          type="button"
          onClick={() => {
            setType('income');
            setCategory('');
            setCustomCategory('');
          }}
          className={`rounded-md py-1.5 text-xs font-medium transition-all ${
            type === 'income'
              ? 'bg-white text-neutral-900 shadow-xs'
              : 'text-neutral-500 hover:text-neutral-900'
          }`}
        >
          Income
        </button>
      </div>

      {/* Amount Input */}
      <div>
        <label className="block text-[11px] font-medium uppercase tracking-wider text-neutral-400 mb-1">
          Amount
        </label>
        <div className="relative flex items-center">
          <span className="absolute left-3 text-sm font-medium text-neutral-400">
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
            className="w-full rounded-md border border-neutral-200 bg-white py-2 pl-7 pr-3 text-base font-semibold text-neutral-900 placeholder:text-neutral-300 focus:border-neutral-900 focus:outline-hidden"
          />
        </div>
      </div>

      {/* Category Selection & Custom Category */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[11px] font-medium uppercase tracking-wider text-neutral-400">
            Category
          </label>
          <button
            type="button"
            onClick={() => {
              setIsTypingCustom(!isTypingCustom);
              if (!isTypingCustom) {
                setCategory('');
              }
            }}
            className="text-[11px] font-medium text-neutral-600 hover:text-neutral-900"
          >
            {isTypingCustom ? 'Pick from list' : '+ Custom category'}
          </button>
        </div>

        {isTypingCustom ? (
          <input
            type="text"
            required
            placeholder="e.g. Bike Maintenance, Freelance Gig"
            value={customCategory}
            onChange={handleCustomCategoryChange}
            autoFocus
            className="w-full rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-hidden"
          />
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {categories.map((cat) => {
              const isSelected = category === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => handleSelectCategory(cat)}
                  className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                    isSelected
                      ? 'border-neutral-900 bg-neutral-900 text-white'
                      : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:bg-neutral-50'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Date & Optional Description */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-medium uppercase tracking-wider text-neutral-400 mb-1">
            Date
          </label>
          <input
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-900 focus:border-neutral-900 focus:outline-hidden"
          />
        </div>
        <div>
          <label className="block text-[11px] font-medium uppercase tracking-wider text-neutral-400 mb-1">
            Note (optional)
          </label>
          <input
            type="text"
            placeholder="Short description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-hidden"
          />
        </div>
      </div>

      {/* Error display */}
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
          <span>Save {type === 'income' ? 'Income' : 'Expense'}</span>
        </button>
      </div>
    </form>
  );
}

