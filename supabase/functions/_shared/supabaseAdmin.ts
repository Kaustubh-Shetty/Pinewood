import { createClient } from 'npm:@supabase/supabase-js@2';

// Service-role client: this is what's allowed to write, bypassing RLS.
// Every Edge Function uses this, never the anon key — same "one place the
// business logic lives" reasoning as the security rules doc explains.
export function getAdminClient() {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

// Verifies the caller's JWT (sent by the frontend as the Authorization
// header) and returns their user id, email, and flatId claim — or null if
// the request isn't from a signed-in, registered flat.
export async function getCaller(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return null;

  const admin = getAdminClient();
  const token = authHeader.replace('Bearer ', '');
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;

  const flatId = (data.user.app_metadata as Record<string, unknown>)?.flat_id as string | undefined;
  return { userId: data.user.id, email: data.user.email ?? null, flatId: flatId ?? null };
}
