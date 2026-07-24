import { corsHeaders } from '../_shared/cors.ts';
import { getAdminClient, getCaller } from '../_shared/supabaseAdmin.ts';

const CATEGORIES = ['electricity', 'water', 'cleaning', 'other'];

// The one place split math is actually trusted (mirrors src/lib/split.ts on
// the frontend, which is preview-only). Deterministic remainder handling:
// first N flats, sorted alphabetically by flatId, get the extra paisa.
function computeEqualSplit(totalAmountPaise: number, flatIds: string[]): Record<string, number> {
  const n = flatIds.length;
  const base = Math.floor(totalAmountPaise / n);
  const remainder = totalAmountPaise - base * n;
  const sorted = [...flatIds].sort();
  const shares: Record<string, number> = {};
  sorted.forEach((flatId, index) => {
    shares[flatId] = base + (index < remainder ? 1 : 0);
  });
  return shares;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const caller = await getCaller(req);
  if (!caller?.flatId) return json({ error: 'Sign in as a registered flat first.' }, 401);

  const input = await req.json().catch(() => null);
  if (!input?.title?.trim()) return json({ error: 'Title is required.' }, 400);
  if (!CATEGORIES.includes(input.category)) return json({ error: 'Invalid category.' }, 400);
  if (!Number.isInteger(input.totalAmountPaise) || input.totalAmountPaise <= 0) {
    return json({ error: 'Amount must be a positive number.' }, 400);
  }
  if (!input.billDate || input.billDate > Date.now() + 24 * 60 * 60 * 1000) {
    return json({ error: 'Bill date is invalid or in the future.' }, 400);
  }
  if (!input.receiptUrl) return json({ error: 'A receipt is required.' }, 400);
  if (!Array.isArray(input.flatIds) || input.flatIds.length === 0) {
    return json({ error: 'Select at least one flat.' }, 400);
  }

  const admin = getAdminClient();

  const { data: households, error: householdsError } = await admin
    .from('households')
    .select('flat_id')
    .in('flat_id', input.flatIds);
  if (householdsError || households.length !== input.flatIds.length) {
    return json({ error: 'One or more selected flats do not exist.' }, 400);
  }

  const { data: bill, error: billError } = await admin
    .from('bills')
    .insert({
      title: input.title.trim(),
      category: input.category,
      total_amount_paise: input.totalAmountPaise,
      receipt_url: input.receiptUrl,
      paid_by_flat_id: caller.flatId,
      flat_ids: input.flatIds,
      bill_date: new Date(input.billDate).toISOString()
    })
    .select('id')
    .single();

  if (billError || !bill) return json({ error: 'Could not save the bill.' }, 500);

  const shares = computeEqualSplit(input.totalAmountPaise, input.flatIds);
  const rows = Object.entries(shares).map(([flatId, shareAmountPaise]) => ({
    id: `${bill.id}_${flatId}`,
    bill_id: bill.id,
    flat_id: flatId,
    share_amount_paise: shareAmountPaise,
    // The fronting flat already paid the vendor directly — their own share is pre-settled.
    status: flatId === caller.flatId ? 'confirmed' : 'unpaid',
    paid_at: flatId === caller.flatId ? new Date().toISOString() : null,
    confirmed_at: flatId === caller.flatId ? new Date().toISOString() : null
  }));

  const { error: sharesError } = await admin.from('bill_shares').insert(rows);
  if (sharesError) {
    // Best-effort cleanup so a failed split doesn't leave an orphaned bill behind.
    await admin.from('bills').delete().eq('id', bill.id);
    return json({ error: 'Could not save the bill split. Try again.' }, 500);
  }

  return json({ billId: bill.id }, 200);
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
