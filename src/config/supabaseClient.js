import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Supabase URL or Anon Key is missing from environment variables.");
} else if (supabaseAnonKey.startsWith("http")) {
  console.error("Supabase Anon Key looks like a URL. Check your .env.local configuration.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
