import webpush from 'npm:web-push@3.6.7';
import { corsHeaders } from '../_shared/cors.ts';
import { getAdminClient } from '../_shared/supabaseAdmin.ts';

// Triggered by the `on_bill_created` Postgres trigger (see migration 0001)
// via a Database Webhook — not called directly by the frontend.
webpush.setVapidDetails(
  'mailto:admin@pinewood.local',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!
);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // Supabase Database Webhooks (configured in the dashboard — see SETUP.md
  // step 8) POST { type, table, record, old_record, schema } on every insert.
  const payload = await req.json().catch(() => ({}));
  const billId = payload?.record?.id;
  if (!billId) return new Response('missing record.id', { status: 400 });

  const admin = getAdminClient();

  const { data: bill } = await admin.from('bills').select('title').eq('id', billId).maybeSingle();
  if (!bill) return new Response('bill not found', { status: 404 });

  const { data: shares } = await admin
    .from('bill_shares')
    .select('flat_id, share_amount_paise, status')
    .eq('bill_id', billId);

  const results = await Promise.allSettled(
    (shares ?? [])
      .filter((s) => s.status !== 'confirmed') // skip the fronting flat's own pre-settled share
      .map(async (share) => {
        const { data: household } = await admin
          .from('households')
          .select('push_subscription')
          .eq('flat_id', share.flat_id)
          .maybeSingle();

        const subscription = household?.push_subscription;
        if (!subscription) return;

        const rupees = (share.share_amount_paise / 100).toFixed(2);
        await webpush.sendNotification(
          subscription,
          JSON.stringify({
            title: `New bill: ${bill.title}`,
            body: `Your share is ₹${rupees}. Tap to view and pay.`,
            billId
          })
        );
      })
  );

  const failures = results.filter((r) => r.status === 'rejected').length;
  if (failures) console.warn(`on-bill-created: ${failures} notification(s) failed for bill ${billId}`);

  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
});
