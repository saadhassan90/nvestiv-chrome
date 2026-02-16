import { createClient } from '@supabase/supabase-js';

// Use placeholder values during build time when env vars aren't available.
// Runtime requests will always have proper env vars set.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || 'placeholder-service-key';

// Client-side (anon key)
export const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

// Server-side (service key)
export const supabaseServer = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
