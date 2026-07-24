import { corsHeaders } from '../_shared/cors.ts';
import { getAdminClient, getCaller } from '../_shared/supabaseAdmin.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const caller = await getCaller(req);
  if (!caller?.flatId) return json({ error: 'Sign in as a registered flat first.' }, 401);

  const { billId } = await req.json().catch(() => ({}));
  if (!billId) return json({ error: 'billId is required.' }, 400);

  const admin = getAdminClient();
  const { data, error } = await admin
    .from('bills')
    .update({ closed_manually: true })
    .eq('id', billId)
    .eq('paid_by_flat_id', caller.flatId)
    .select('id')
    .maybeSingle();

  if (error || !data) {
    return json({ error: 'Only the flat that fronted this bill can close it.' }, 403);
  }

  return json({ ok: true }, 200);
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
