import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

// Safe fallbacks prevent build-time crashes on Vercel when environment variables are not yet configured
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-project.supabase.co';
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

export const supabase = createClient<Database>(
  supabaseUrl,
  supabaseAnonKey
);


