import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);

// Thin wrapper around supabase.functions.invoke — every write in this app
// goes through one of these Edge Functions (see supabase/functions), never
// a direct table write from the client (RLS denies that; see migration 0001).
async function callFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(name, { body });
  if (error) {
    // supabase-js surfaces the Edge Function's JSON error body separately;
    // try to unwrap it for a readable message.
    const message = (error as { context?: { error?: string } })?.context?.error ?? error.message;
    throw new Error(message);
  }
  return data as T;
}

export const registerHouseholdFn = (phoneNumber: string) =>
  callFunction<{ flatId: string }>('register-household', { phoneNumber });

export const addBillFn = (input: Record<string, unknown>) => callFunction<{ billId: string }>('add-bill', input);

export const markPaidFn = (input: { billId: string; proofUrl: string }) => callFunction<{ ok: true }>('mark-paid', input);

export const confirmReceivedFn = (input: { billId: string; flatId: string }) =>
  callFunction<{ ok: true }>('confirm-received', input);

export const closeBillFn = (input: { billId: string }) => callFunction<{ ok: true }>('close-bill', input);

export const updatePushSubscriptionFn = (subscription: PushSubscriptionJSON) =>
  callFunction<{ ok: true }>('update-push-subscription', { subscription });
