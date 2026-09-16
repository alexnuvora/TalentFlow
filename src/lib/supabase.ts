import { createClient } from '@supabase/supabase-js';
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const isConfigured = Boolean(url && key && !url.includes('YOUR_PROJECT'));
if (!isConfigured) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env.local and configure the deployment.');
}
export const supabase = createClient(url, key, {
  auth: {persistSession:true, autoRefreshToken:true, detectSessionInUrl:true},
});
