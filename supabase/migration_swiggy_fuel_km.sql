-- Migration: Add fuel_expense and km_driven to swiggy_income table
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)

-- 1. Add fuel_expense and km_driven columns if they do not exist
ALTER TABLE public.swiggy_income 
ADD COLUMN IF NOT EXISTS fuel_expense NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (fuel_expense >= 0),
ADD COLUMN IF NOT EXISTS km_driven NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (km_driven >= 0);

-- 2. Update net_amount generated column (if existing table used the old formula)
-- In Postgres, generated column expressions are altered by dropping and re-adding the column:
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'swiggy_income' 
          AND column_name = 'net_amount'
    ) THEN
        ALTER TABLE public.swiggy_income DROP COLUMN net_amount;
    END IF;
    ALTER TABLE public.swiggy_income ADD COLUMN net_amount NUMERIC(12, 2) 
        GENERATED ALWAYS AS (gross_amount - deduction_amount - fuel_expense) STORED;
END $$;
