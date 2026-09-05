import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';

// Service-role client — server-side ONLY. This key bypasses Row Level Security,
// so it must never reach the browser. All tmail access control happens in the
// route handlers (scoped to the authenticated mailbox), not in RLS.
export const supabase = createClient(
  env.supabase.url,
  env.supabase.serviceRoleKey,
  {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { 'x-application-name': 'tmail-server' } },
  },
);
