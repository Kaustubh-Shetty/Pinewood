import { corsHeaders } from '../_shared/cors.ts';
import { getAdminClient, getCaller } from '../_shared/supabaseAdmin.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const caller = await getCaller(req);
  if (!caller?.flatId) return json({ error: 'Sign in as a registered flat first.' }, 401);

  const { subscription } = await req.json().catch(() => ({}));
  if (!subscription) return json({ error: 'subscription is required.' }, 400);

  const admin = getAdminClient();
  await admin.from('households').update({ push_subscription: subscription }).eq('flat_id', caller.flatId);

  return json({ ok: true }, 200);
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
