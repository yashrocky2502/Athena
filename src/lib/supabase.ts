import { createClient } from '@supabase/supabase-js';

const env = typeof process !== 'undefined' && process.env ? process.env : {};

const supabaseUrl = env.SUPABASE_URL || 'https://guyneushexdlcsmpzjus.supabase.co';
const supabaseAnonKey = env.SUPABASE_ANON_KEY || 'sb_publishable_dpOtsuwUMzhrcqC0X_B0hg_X41eRRCF';
const supabaseServiceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

// Use Service Role key on server-side for bypass RLS and full control
// If missing, fallback to Anon Key (though it might have limited permissions)
export const supabase = createClient(supabaseUrl, supabaseServiceRoleKey || supabaseAnonKey);

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey || supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});
