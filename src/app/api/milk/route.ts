import { NextResponse } from 'next/server';
import {
  runMilkAutoBackfill,
  getMilkSubscriptionSettings,
  pauseMilkSubscription,
  resumeMilkSubscription,
  toggleMilkDateStatus,
  getISTTodayDateString,
} from '@/lib/milk/milkSubscription';
import { getPendingMilkBill } from '@/lib/supabase/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    // 1. Run automatic backfill from last logged date up to today in IST
    const backfillResult = await runMilkAutoBackfill();

    // 2. Fetch current settings and pending bill summary
    const settings = await getMilkSubscriptionSettings();
    const pendingBill = await getPendingMilkBill();

    return NextResponse.json(
      {
        success: true,
        today: getISTTodayDateString(),
        backfill: backfillResult,
        settings,
        pendingBill: {
          count: pendingBill.count,
          totalIncurred: pendingBill.totalIncurred,
          totalSettled: pendingBill.totalSettled,
          pendingAmount: pendingBill.pendingAmount,
          advanceCredit: pendingBill.advanceCredit,
        },
        timestamp: new Date().toISOString(),
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    );
  } catch (error: any) {
    console.error('API /api/milk GET error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Failed to process milk backfill',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { action, date, status } = body;

    let result: any = null;

    if (action === 'pause') {
      result = await pauseMilkSubscription();
    } else if (action === 'resume') {
      result = await resumeMilkSubscription();
    } else if (action === 'toggle' && date) {
      result = await toggleMilkDateStatus(date, status);
    } else {
      // Default action is backfill check
      result = await runMilkAutoBackfill();
    }

    const settings = await getMilkSubscriptionSettings();
    const pendingBill = await getPendingMilkBill();

    return NextResponse.json({
      success: true,
      action: action || 'backfill',
      result,
      settings,
      pendingBill: {
        count: pendingBill.count,
        totalIncurred: pendingBill.totalIncurred,
        totalSettled: pendingBill.totalSettled,
        pendingAmount: pendingBill.pendingAmount,
        advanceCredit: pendingBill.advanceCredit,
      },
    });
  } catch (error: any) {
    console.error('API /api/milk POST error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Failed to execute milk action',
      },
      { status: 500 }
    );
  }
}
