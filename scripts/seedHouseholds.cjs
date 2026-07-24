// One-time (or occasional) admin script. Run locally, never deployed.
// Writes the phone_to_flat allow-list AND pre-creates each households row
// (unclaimed, user_id = null) — together these are the actual mechanism
// that caps how many logins can ever exist (see supabase/migrations/0001_init.sql).
//
// Usage:
//   1. npm install  (if not already done)
//   2. Copy households.example.json to households.json and fill in real phone numbers + emails
//   3. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY as environment variables
//      (Supabase Dashboard -> Project Settings -> API -> service_role key. Keep this secret.)
//   4. node scripts/seedHouseholds.cjs

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const householdsPath = path.join(__dirname, 'households.json');

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY as environment variables first. See SETUP.md.');
  process.exit(1);
}
if (!fs.existsSync(householdsPath)) {
  console.error('Missing scripts/households.json. Copy households.example.json and fill in real details.');
  process.exit(1);
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const households = JSON.parse(fs.readFileSync(householdsPath, 'utf8'));

  if (households.length === 0) {
    console.error('households.json is empty — nothing to seed.');
    process.exit(1);
  }

  const flatIds = new Set();
  for (const h of households) {
    if (!h.flatId || !h.phoneNumber || !h.email || !h.displayName) {
      throw new Error(`Every entry needs flatId, phoneNumber, email, and displayName. Bad entry: ${JSON.stringify(h)}`);
    }
    if (!/^\+91\d{10}$/.test(h.phoneNumber)) {
      throw new Error(`Phone number must look like +91XXXXXXXXXX. Bad entry: ${h.phoneNumber}`);
    }
    if (flatIds.has(h.flatId)) {
      throw new Error(`Duplicate flatId in households.json: ${h.flatId}`);
    }
    flatIds.add(h.flatId);
  }

  const { error: allowListError } = await supabase.from('phone_to_flat').upsert(
    households.map((h) => ({
      phone_number: h.phoneNumber,
      email: h.email.toLowerCase(),
      flat_id: h.flatId,
      display_name: h.displayName
    })),
    { onConflict: 'phone_number' }
  );
  if (allowListError) throw new Error(`Failed writing phone_to_flat: ${allowListError.message}`);

  // Pre-create the households row for each flat if it doesn't exist yet —
  // upsert with a WHERE-style guard isn't native here, so only insert flats
  // that aren't already present (an existing claimed flat must not be touched).
  const { data: existing } = await supabase.from('households').select('flat_id');
  const existingIds = new Set((existing ?? []).map((r) => r.flat_id));
  const toInsert = households.filter((h) => !existingIds.has(h.flatId)).map((h) => ({ flat_id: h.flatId, display_name: h.displayName }));

  if (toInsert.length > 0) {
    const { error: insertError } = await supabase.from('households').insert(toInsert);
    if (insertError) throw new Error(`Failed pre-creating households: ${insertError.message}`);
  }

  console.log(`Seeded ${households.length} flat(s): ${households.map((h) => h.flatId).join(', ')}`);
  console.log(`${toInsert.length} new household row(s) created; ${households.length - toInsert.length} already existed and were left untouched.`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
