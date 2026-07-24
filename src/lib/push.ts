import { updatePushSubscriptionFn } from './supabase';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

// Registers the service worker, asks permission, subscribes to Web Push,
// and saves the subscription server-side — all native browser APIs, no
// Firebase or any other push vendor involved.
export async function setupPushNotifications() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

  const registration = await navigator.serviceWorker.register('/sw.js');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return;

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(import.meta.env.VITE_VAPID_PUBLIC_KEY) as BufferSource
    });
  }

  await updatePushSubscriptionFn(subscription.toJSON() as PushSubscriptionJSON);
}
