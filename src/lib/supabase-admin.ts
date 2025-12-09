import { createClient } from '@supabase/supabase-js';
import { Database } from './supabase';

// Note: This client uses the Service Role Key, which bypasses Row Level Security.
// Use this ONLY in server-side API routes for administrative tasks.
// never expose this key to the client.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
    // We don't throw immediately to allow build time to pass, 
    // but this will fail at runtime if used without keys.
    console.warn('Missing SUPABASE_SERVICE_ROLE_KEY environment variable. Admin client will not work.');
}

export const supabaseAdmin = createClient<Database>(
    supabaseUrl || '',
    supabaseServiceRoleKey || ''
);
