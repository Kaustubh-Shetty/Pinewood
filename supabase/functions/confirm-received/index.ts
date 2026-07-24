import { corsHeaders } from '../_shared/cors.ts';
import { getAdminClient, getCaller } from '../_shared/supabaseAdmin.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const caller = await getCaller(req);
  if (!caller?.flatId) return json({ error: 'Sign in as a registered flat first.' }, 401);

  const { billId, flatId } = await req.json().catch(() => ({}));
  if (!billId || !flatId) return json({ error: 'billId and flatId are required.' }, 400);

  const admin = getAdminClient();

  const { data: bill, error: billError } = await admin.from('bills').select('paid_by_flat_id').eq('id', billId).maybeSingle();
  if (billError || !bill) return json({ error: 'Bill not found.' }, 404);

  // The core rule, enforced here and nowhere else: only the flat that
  // fronted the money can confirm receipt — never the paying flat itself.
  if (bill.paid_by_flat_id !== caller.flatId) {
    return json({ error: 'Only the flat that paid this bill can confirm receipt.' }, 403);
  }

  const { data, error } = await admin
    .from('bill_shares')
    .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
    .eq('id', `${billId}_${flatId}`)
    .eq('status', 'claimed')
    .select('id')
    .maybeSingle();

  if (error || !data) {
    return json({ error: 'This share has not been marked paid, or is already confirmed.' }, 409);
  }

  return json({ ok: true }, 200);
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
