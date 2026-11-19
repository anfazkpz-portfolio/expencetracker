-- Supabase Schema for Personal Expense Tracker (Cash Manager)
-- Run this script in the Supabase SQL Editor (Dashboard > SQL Editor)

-- 1. TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    category TEXT NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. DEBTS TABLE
CREATE TABLE IF NOT EXISTS public.debts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('lent', 'borrowed')),
    amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
    due_date DATE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'settled', 'overdue')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. SWIGGY INCOME TABLE
CREATE TABLE IF NOT EXISTS public.swiggy_income (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    gross_amount NUMERIC(12, 2) NOT NULL CHECK (gross_amount >= 0),
    deduction_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (deduction_amount >= 0),
    deduction_reason TEXT,
    fuel_expense NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (fuel_expense >= 0),
    km_driven NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (km_driven >= 0),
    net_amount NUMERIC(12, 2) GENERATED ALWAYS AS (gross_amount - deduction_amount - fuel_expense) STORED,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. DAILY MILK LOGS TABLE
CREATE TABLE IF NOT EXISTS public.daily_milk_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
    status TEXT NOT NULL CHECK (status IN ('paid', 'skipped', 'pending')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- INDEXES for common queries (date filtering and category lookups)
CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.transactions (date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON public.transactions (type);
CREATE INDEX IF NOT EXISTS idx_debts_status ON public.debts (status);
CREATE INDEX IF NOT EXISTS idx_debts_due_date ON public.debts (due_date);
CREATE INDEX IF NOT EXISTS idx_swiggy_date ON public.swiggy_income (date DESC);
CREATE INDEX IF NOT EXISTS idx_milk_logs_date ON public.daily_milk_logs (date DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.swiggy_income ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_milk_logs ENABLE ROW LEVEL SECURITY;

-- Default permissive policies for local/dev use (can be refined with Supabase Auth)
CREATE POLICY "Allow public read access on transactions" ON public.transactions FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on transactions" ON public.transactions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access on transactions" ON public.transactions FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access on transactions" ON public.transactions FOR DELETE USING (true);

CREATE POLICY "Allow public read access on debts" ON public.debts FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on debts" ON public.debts FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access on debts" ON public.debts FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access on debts" ON public.debts FOR DELETE USING (true);

CREATE POLICY "Allow public read access on swiggy_income" ON public.swiggy_income FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on swiggy_income" ON public.swiggy_income FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access on swiggy_income" ON public.swiggy_income FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access on swiggy_income" ON public.swiggy_income FOR DELETE USING (true);

CREATE POLICY "Allow public read access on daily_milk_logs" ON public.daily_milk_logs FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on daily_milk_logs" ON public.daily_milk_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access on daily_milk_logs" ON public.daily_milk_logs FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access on daily_milk_logs" ON public.daily_milk_logs FOR DELETE USING (true);

