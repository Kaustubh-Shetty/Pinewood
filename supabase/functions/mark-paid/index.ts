import { corsHeaders } from '../_shared/cors.ts';
import { getAdminClient, getCaller } from '../_shared/supabaseAdmin.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const caller = await getCaller(req);
  if (!caller?.flatId) return json({ error: 'Sign in as a registered flat first.' }, 401);

  const { billId, proofUrl } = await req.json().catch(() => ({}));
  if (!billId || !proofUrl) return json({ error: 'billId and proofUrl are required.' }, 400);

  const admin = getAdminClient();
  const shareId = `${billId}_${caller.flatId}`;

  // Atomic: only succeeds if this share is currently 'unpaid'. A second tap,
  // or an attempt to mark someone else's share, both fail the WHERE clause
  // and come back with zero rows rather than silently double-applying.
  const { data, error } = await admin
    .from('bill_shares')
    .update({ status: 'claimed', proof_url: proofUrl, paid_at: new Date().toISOString() })
    .eq('id', shareId)
    .eq('flat_id', caller.flatId)
    .eq('status', 'unpaid')
    .select('id')
    .maybeSingle();

  if (error || !data) {
    return json({ error: 'This share has already been marked paid, or does not exist.' }, 409);
  }

  return json({ ok: true }, 200);
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
