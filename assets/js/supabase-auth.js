import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://zeryppqymzbqesllxnvk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InplcnlwcHF5bXpicWVzbGx4bnZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3NDAyODcsImV4cCI6MjEwMzMxNjI4N30.oOTXUTlBNoyB_jw_iPI1RoopOUE135aam1mtJk3mcFw';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
export const isSupabaseConfigured = !SUPABASE_URL.includes('YOUR_PROJECT_REF') && !SUPABASE_ANON_KEY.includes('YOUR_SUPABASE');
export const SITE_URL = window.location.origin;
export const AUTH_CALLBACK_URL = `${SITE_URL}/auth-callback`;

const signInWithOAuth = supabase.auth.signInWithOAuth.bind(supabase.auth);
supabase.auth.signInWithOAuth = (options) => signInWithOAuth({ ...options, options: { ...options.options, queryParams: { ...options.options?.queryParams, prompt: 'select_account' } } });

export function showAuthError(status, error) {
  status.textContent = error?.message || 'Something went wrong. Please try again.';
}
