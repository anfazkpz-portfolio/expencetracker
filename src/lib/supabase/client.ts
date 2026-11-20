import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

// Production Supabase project for Cash Manager
const DEFAULT_SUPABASE_URL = 'https://qvwmgofkwsexpnbruesm.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_M3Kvd-GTiZUFqBos0mfC7A_yaAlJ1Ew';

const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabaseUrl =
  envUrl && !envUrl.includes('placeholder')
    ? envUrl
    : DEFAULT_SUPABASE_URL;

const supabaseAnonKey =
  envKey && !envKey.includes('placeholder')
    ? envKey
    : DEFAULT_SUPABASE_ANON_KEY;

export const supabase = createClient<Database>(
  supabaseUrl,
  supabaseAnonKey
);


