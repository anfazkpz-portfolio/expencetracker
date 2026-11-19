import React from 'react';

export default function Loading() {
  return (
    <div className="space-y-3.5 sm:space-y-5 animate-pulse">
      {/* 1. Grand Total Cash Widget Skeleton */}
      <div className="h-44 sm:h-52 w-full rounded-2xl border border-neutral-200/80 bg-white p-4 sm:p-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-neutral-200" />
            <div className="h-4 w-32 rounded-md bg-neutral-200" />
          </div>
          <div className="h-6 w-16 rounded-md bg-neutral-200" />
        </div>
        <div className="mt-4 h-10 w-48 rounded-lg bg-neutral-200" />
        <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="h-16 rounded-xl bg-neutral-100 border border-neutral-200/50" />
          <div className="h-16 rounded-xl bg-neutral-100 border border-neutral-200/50" />
          <div className="h-16 rounded-xl bg-neutral-100 border border-neutral-200/50" />
          <div className="h-16 rounded-xl bg-neutral-100 border border-neutral-200/50" />
        </div>
      </div>

      {/* 2. Primary Stats Grid Skeleton */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        <div className="h-28 rounded-xl border border-neutral-200/80 bg-white p-3.5" />
        <div className="h-28 rounded-xl border border-neutral-200/80 bg-white p-3.5" />
        <div className="h-28 rounded-xl border border-neutral-200/80 bg-white p-3.5" />
      </div>

      {/* 3. Upcoming Dues & Milk Action Skeleton */}
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        <div className="h-48 rounded-xl border border-neutral-200/80 bg-white p-4" />
        <div className="h-48 rounded-xl border border-neutral-200/80 bg-white p-4" />
      </div>

      {/* 4. Recent Transactions Skeleton */}
      <div className="h-56 rounded-xl border border-neutral-200/80 bg-white p-4" />
    </div>
  );
}
