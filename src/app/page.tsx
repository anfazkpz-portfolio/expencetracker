import React from 'react';
import { GrandTotalCashWidget } from '@/components/GrandTotalCashWidget';
import { DashboardStats } from '@/components/DashboardStats';
import { UpcomingDues } from '@/components/UpcomingDues';
import { DailyMilkQuickAction } from '@/components/DailyMilkQuickAction';
import { ExternalFunds } from '@/components/ExternalFunds';
import { RecentTransactions } from '@/components/RecentTransactions';
import { PageTransition } from '@/components/animations/MotionWrapper';

export default function DashboardPage() {
  return (
    <PageTransition className="space-y-3.5 sm:space-y-5">
      {/* Absolute Grand Total Cash Across All Repositories */}
      <GrandTotalCashWidget />

      {/* Primary Balance and Monthly Cash Flow */}
      <DashboardStats />

      {/* Grid: Upcoming Dues Reminder & Daily Milk Quick Action */}
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        <UpcomingDues />
        <DailyMilkQuickAction />
      </div>

      {/* Monthly Internal Summary (Swiggy Payouts & Milk Expense) */}
      <ExternalFunds />

      {/* Recent Cash Flow Activity */}
      <RecentTransactions />
    </PageTransition>
  );
}
