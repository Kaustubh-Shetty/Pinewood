# Setting up Pinewood

Everything below uses Supabase's free tier, which never asks for a card —
not at sign-up, not at any point in this walkthrough. You'll need: a
computer, an email address, and about 30–45 minutes the first time.

---

## 1. Create the Supabase project

1. Go to https://supabase.com and sign up (email or GitHub — no card).
2. Click **New project**. Name it "Pinewood", set a database password (save it somewhere — you likely won't need it again, but keep it), and pick a region close to India (e.g. Singapore).
3. Wait a minute or two for it to finish provisioning.

## 2. Get your project's API keys

1. Left sidebar → gear icon → **API**.
2. You'll see a **Project URL** and two keys: **anon public** and **service_role**.
   - The **anon public** key goes in the app's `.env` file (step 5) — safe to be visible in the browser.
   - The **service_role** key is powerful (bypasses all access rules) — it's used once, locally, to run the seed script in step 8. Never put it in `.env` or any file that goes to the browser.

## 3. Turn on email sign-in

1. Left sidebar → **Authentication** → **Providers**.
2. **Email** should already be enabled by default. Leave "Confirm email" as-is — Supabase's OTP flow handles the code automatically.
3. Optional but recommended: **Authentication** → **Rate Limits**, confirm the default OTP rate limit is on (it is by default) — this is what stops someone from spamming the "send code" button.

## 4. Install the tools (one-time, on your computer)

1. Install Node.js from https://nodejs.org (choose the "LTS" version).
2. Open a terminal in the project folder and run:
   ```
   npm install
   npm install -g supabase
   supabase login
   ```
   The last command opens a browser to connect the CLI to your account.
3. Link this folder to your project:
   ```
   supabase link --project-ref YOUR_PROJECT_REF
   ```
   Find `YOUR_PROJECT_REF` in the Project URL from step 2 — it's the random string before `.supabase.co`.

## 5. Fill in the app's configuration

1. Copy `.env.example` to a new file named exactly `.env`.
2. Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from step 2.
3. Generate a Web Push key pair (used for notifications — no Google/Firebase involved):
   ```
   npx web-push generate-vapid-keys
   ```
   Paste the **Public Key** into `VITE_VAPID_PUBLIC_KEY` in `.env`. Keep the **Private Key** — it's needed in step 7, but never goes in `.env`.

## 6. Push the database schema

```
supabase db push
```
This creates all the tables, security rules, and storage buckets from `supabase/migrations/`.

## 7. Deploy the backend functions and set their secrets

```
supabase functions deploy
```

Then set the secrets the functions need (replace the placeholders):
```
supabase secrets set VAPID_PUBLIC_KEY=your_public_key_from_step_5
supabase secrets set VAPID_PRIVATE_KEY=your_private_key_from_step_5
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are automatically available to
every Edge Function already — no need to set those yourself.

## 8. Connect the new-bill notification trigger

The database needs to know the URL of the `on-bill-created` function it
should call whenever a bill is added.

1. After step 7, the CLI prints a URL for each function — copy the one for `on-bill-created` (looks like `https://xxxx.supabase.co/functions/v1/on-bill-created`).
2. Left sidebar → **Database** → **Webhooks** → **Create a new hook**.
3. Name it `on_bill_created`, table `bills`, event `Insert`, and set the URL to the one you copied. Under **HTTP Headers**, add `Authorization: Bearer YOUR_SERVICE_ROLE_KEY` (from step 2).
4. Save.

*(This replaces the SQL trigger placeholder in the migration — Supabase's dashboard-based Database Webhooks are simpler to set up correctly than the raw `pg_net` call, so use this UI instead of relying on the settings referenced in the migration file.)*

## 9. Add the 9 (or more, for testing) flats

This is the step that actually decides who can log in.

1. Copy `scripts/households.example.json` to `scripts/households.json`.
2. Edit it: one entry per flat, with the real phone number (`+91XXXXXXXXXX`) and the email address that flat will actually check for the OTP code. Add or remove entries here to change how many logins can exist — 12–13 while testing, 9 for the real building.
3. Set the two environment variables the seed script needs (this terminal session only):
   ```
   export SUPABASE_URL=https://xxxx.supabase.co
   export SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_from_step_2
   ```
   (On Windows Command Prompt, use `set` instead of `export`.)
4. Run:
   ```
   npm run seed
   ```
   You should see a confirmation listing the flats it seeded.

## 10. Deploy the app itself

Supabase doesn't host the frontend — use any free static host. **Cloudflare Pages** is a good default (no card required):

1. Push this project to a GitHub repo (or use Cloudflare's direct upload).
2. https://pages.cloudflare.com → **Create a project** → connect the repo.
3. Build command: `npm run build`. Build output directory: `dist`.
4. Under **Environment variables**, add the same values from your `.env` file.
5. Deploy. You'll get a URL like `https://pinewood.pages.dev` — that's the link to share with all the flats.

Opening it on a phone browser and choosing "Add to Home Screen" installs it
like a regular app, with no app store needed.

## 11. Each flat's first login

Whoever's phone number and email were entered in `households.json` opens
the link, enters both, and enters the code emailed to them. The app
recognizes them as their flat automatically from that point on.

---

## Making changes later

- **Add/remove a flat**: edit `scripts/households.json`, run `npm run seed` again.
- **Change app code**: edit the files, then redeploy on Cloudflare Pages (automatic if connected to GitHub, or re-upload otherwise).
- **Change backend logic**: edit files under `supabase/functions`, then `supabase functions deploy` again.
- **Change the database schema**: add a new file under `supabase/migrations`, then `supabase db push`.

## Why this stays free, with no card

Supabase's free tier (500MB database, 1GB storage, 50,000 monthly active
users, unlimited Edge Function invocations within a generous request quota)
doesn't require a card at sign-up or at any point above — unlike Firebase's
Blaze plan, which the earlier version of this app needed just to create a
Storage bucket. At 9–13 flats and a handful of bills a month, usage sits far
below every ceiling on that free tier. Web Push (step 5) is a browser
standard, not a paid service, so notifications add no cost either.
