
'use client'; // Mark this for client-side execution if used in components/hooks

import { useToast } from '@/hooks/use-toast';

// Helper function to convert VAPID public key string to Uint8Array
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Function to subscribe the user to push notifications
export async function subscribeUserToPush(): Promise<PushSubscription | null> {
  console.log('[WebPush Utils] Attempting to subscribe user...');
  // Check if service workers and push messaging are supported
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.error('[WebPush Utils] Push Messaging is not supported');
    // Use toast here for user feedback
    const { toast } = useToast();
    toast({ variant: "destructive", title: "Errore", description: "Le notifiche Push non sono supportate su questo browser."});
    return null;
  }

  try {
    // Register the service worker (or ensure it's registered)
    const swRegistration = await navigator.serviceWorker.ready;
    console.log('[WebPush Utils] Service Worker ready for push subscription.');

    // Get current subscription status
    let subscription = await swRegistration.pushManager.getSubscription();
    if (subscription) {
      console.log('[WebPush Utils] User IS already subscribed.', subscription);
      // No need to re-subscribe, just ensure backend has it (optional re-send?)
      // await sendSubscriptionToBackend(subscription); // Consider if re-sending is necessary
      return subscription;
    }
    console.log('[WebPush Utils] User is not subscribed yet.');

    // --- Permission is assumed to be 'granted' here, as the hook should handle prompting ---
    // We proceed directly to subscribe if no existing subscription found

    // Subscribe the user
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) {
        console.error('[WebPush Utils] VAPID public key is not defined in environment variables.');
        const { toast } = useToast();
        toast({ variant: "destructive", title: "Errore Configurazione", description: "Chiave VAPID mancante." });
        return null;
    }
    console.log('[WebPush Utils] VAPID key found. Proceeding with subscription...');

    const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
    subscription = await swRegistration.pushManager.subscribe({
      userVisibleOnly: true, // Required for web push
      applicationServerKey: applicationServerKey,
    });

    console.log('[WebPush Utils] User subscribed successfully via pushManager:', subscription);

    // Send the subscription object to your backend API
    await sendSubscriptionToBackend(subscription);

    return subscription;

  } catch (error) {
    console.error('[WebPush Utils] Failed to subscribe the user: ', error);
    const { toast } = useToast();
    toast({ variant: "destructive", title: "Errore Iscrizione", description: `Iscrizione alle notifiche fallita: ${error instanceof Error ? error.message : 'Errore sconosciuto'}` });
    return null;
  }
}

// Function to send the subscription object to the backend
async function sendSubscriptionToBackend(subscription: PushSubscription) {
   console.log('[WebPush Utils] Sending subscription to backend:', JSON.stringify(subscription));
   try {
    const response = await fetch('/api/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(subscription),
    });

    if (!response.ok) {
      const errorText = await response.text(); // Get error details from backend if possible
      throw new Error(`Backend subscription failed: ${response.status} ${response.statusText} - ${errorText}`);
    }
    console.log('[WebPush Utils] Subscription successfully sent to backend.');
    // Optional: Show a success message to the user via toast (handled by hook now)
    // toast({ title: "Notifiche Abilitate", description: "Riceverai notifiche push." });

   } catch (error) {
       console.error('[WebPush Utils] Error sending subscription to backend:', error);
       const { toast } = useToast();
       toast({ variant: "destructive", title: "Errore Notifiche", description: "Impossibile salvare l'iscrizione nel backend." });
       // Consider unsubscribing if backend save fails to keep state consistent
       console.log('[WebPush Utils] Attempting to unsubscribe locally due to backend failure...');
       await unsubscribeUserFromPush(subscription); // Pass the failed subscription
   }
}

// Function to unsubscribe the user
// Takes optional subscription to prevent race conditions if called right after failed backend send
export async function unsubscribeUserFromPush(subToUnsubscribe?: PushSubscription | null) {
    console.log('[WebPush Utils] Attempting to unsubscribe user...');
    try {
        const swRegistration = await navigator.serviceWorker.ready;
        // Use the passed subscription if available, otherwise get the current one
        const subscription = subToUnsubscribe ?? await swRegistration.pushManager.getSubscription();

        if (subscription) {
            console.log('[WebPush Utils] Found subscription to unsubscribe:', subscription.endpoint);
            const successful = await subscription.unsubscribe();
            if (successful) {
                 console.log('[WebPush Utils] User unsubscribed successfully via pushManager.');
                 // Optional: Send unsubscription info to backend to remove the endpoint
                 await sendUnsubscriptionToBackend(subscription);
                 // toast({ title: "Notifiche Disabilitate" }); // Handled by hook
            } else {
                console.error('[WebPush Utils] Failed to unsubscribe via pushManager.');
                const { toast } = useToast();
                toast({ variant: "destructive", title: "Errore", description: "Disiscrizione dalle notifiche fallita." });
            }
        } else {
            console.log('[WebPush Utils] User was not subscribed (or already unsubscribed).');
        }
    } catch (error) {
        console.error('[WebPush Utils] Error during unsubscription:', error);
        const { toast } = useToast();
        toast({ variant: "destructive", title: "Errore", description: "Errore durante la disiscrizione dalle notifiche." });
    }
}

// Function to send unsubscription info to the backend
async function sendUnsubscriptionToBackend(subscription: PushSubscription) {
   console.log('[WebPush Utils] Sending unsubscription info to backend for endpoint:', subscription.endpoint);
   try {
    const response = await fetch('/api/unsubscribe', { // Assuming an unsubscribe endpoint exists
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ endpoint: subscription.endpoint }), // Send endpoint to identify subscription
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Backend unsubscription failed: ${response.status} ${response.statusText} - ${errorText}`);
    }
    console.log('[WebPush Utils] Unsubscription successfully processed by backend.');

   } catch (error) {
       console.error('[WebPush Utils] Error sending unsubscription to backend:', error);
       const { toast } = useToast();
       toast({ variant: "destructive", title: "Errore Backend", description: "Impossibile rimuovere l'iscrizione dal server." });
       // Decide how to handle backend unsubscription errors - maybe retry later?
   }
}
