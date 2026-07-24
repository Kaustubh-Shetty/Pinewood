import { corsHeaders } from '../_shared/cors.ts';
import { getAdminClient } from '../_shared/supabaseAdmin.ts';

// Called right after the household verifies their email OTP. The client
// also sends the phone number they typed on the login screen — this
// function is what actually enforces "one phone = one flat = one login",
// by checking the (phone, email) pair against the pre-seeded allow-list.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const admin = getAdminClient();
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return json({ error: 'Sign in first.' }, 401);
  }
  const token = authHeader.replace('Bearer ', '');
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) {
    return json({ error: 'Sign in first.' }, 401);
  }
  const uid = userData.user.id;
  const email = userData.user.email?.toLowerCase();

  const { phoneNumber } = await req.json().catch(() => ({}));
  if (!phoneNumber || !email) {
    return json({ error: 'Phone number is required.' }, 400);
  }

  const { data: allowListRow, error: allowListError } = await admin
    .from('phone_to_flat')
    .select('flat_id, email, display_name')
    .eq('phone_number', phoneNumber)
    .maybeSingle();

  if (allowListError || !allowListRow || allowListRow.email.toLowerCase() !== email) {
    // Phone and email don't match a pre-approved flat together — reject and
    // clean up the auth user so a mistyped attempt doesn't leave debris.
    await admin.auth.admin.deleteUser(uid);
    return json({ error: 'This phone number and email are not a registered Pinewood flat.' }, 403);
  }

  // Atomic claim: this UPDATE only succeeds on a row that hasn't been
  // claimed yet (user_id IS NULL), so two people racing for the same flat
  // can't both win.
  const { data: claimed, error: claimError } = await admin
    .from('households')
    .update({ user_id: uid, phone_number: phoneNumber, email })
    .eq('flat_id', allowListRow.flat_id)
    .is('user_id', null)
    .select('flat_id')
    .maybeSingle();

  if (claimError || !claimed) {
    await admin.auth.admin.deleteUser(uid);
    return json({ error: 'This flat already has a registered login.' }, 409);
  }

  await admin.auth.admin.updateUserById(uid, { app_metadata: { flat_id: claimed.flat_id } });

  return json({ flatId: claimed.flat_id }, 200);
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
