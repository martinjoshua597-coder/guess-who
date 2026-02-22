import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || supabaseUrl.includes('your-project-id')) {
    console.warn(
        '⚠️  Supabase is not configured. Open .env and fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.\n' +
        '   Get these from supabase.com → Project Settings → API'
    );
}

export const supabase = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder-key'
);
