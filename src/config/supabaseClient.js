import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('your-project-url')) {
  console.error("Supabase URL or Anon Key is missing or using placeholder values. Please check your .env file.");
}

export const supabase = (supabaseUrl && !supabaseUrl.includes('your-project-url')) 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;
