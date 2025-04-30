
'use client';

import { useState, useEffect, useCallback } from 'react';
import { subscribeUserToPush, unsubscribeUserFromPush } from '@/lib/webpush-utils';
import { useToast } from '@/hooks/use-toast';

interface UsePushNotificationsResult {
  isPushEnabled: boolean;
  isPushLoading: boolean;
  isPushSupported: boolean;
  permissionState: NotificationPermission | 'loading' | 'n/a'; // loading, granted, denied, default, n/a
  togglePushNotifications: () => Promise<void>;
  requestPermission: () => Promise<NotificationPermission>; // Function to explicitly request permission
}

export function usePushNotifications(): UsePushNotificationsResult {
  const { toast } = useToast();
  const [isPushSupported, setIsPushSupported] = useState(false);
  const [isPushEnabled, setIsPushEnabled] = useState(false);
  const [isPushLoading, setIsPushLoading] = useState(true);
  const [permissionState, setPermissionState] = useState<NotificationPermission | 'loading' | 'n/a'>('loading');
  const [isMounted, setIsMounted] = useState(false); // Track mount state

  // Define stable toast function
  const showToast = useCallback(toast, []);

  // Check support and initial permission state on mount
  useEffect(() => {
    setIsMounted(true);
    console.log('[Push Hook] Component mounted.');
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window) {
      console.log('[Push Hook] Push API supported.');
      setIsPushSupported(true);
      // Set initial permission state without prompting
      if (navigator.permissions) {
          navigator.permissions.query({ name: 'notifications' }).then(status => {
             console.log('[Push Hook] Initial permission state (navigator.permissions):', status.state);
             setPermissionState(status.state);
             // Update state if permission changes externally
             status.onchange = () => {
                 console.log('[Push Hook] Permission state changed externally:', status.state);
                 setPermissionState(status.state);
             };
             // Stop initial loading ONLY after permission is fetched
             setIsPushLoading(false);
          }).catch((err) => {
              console.error('[Push Hook] Error querying notification permissions:', err);
              // Fallback if permissions query fails
              setPermissionState(Notification.permission);
              setIsPushLoading(false); // Stop loading on fallback
          });
      } else {
          console.log('[Push Hook] Using Notification.permission fallback.');
          // Fallback for older browsers
          setPermissionState(Notification.permission);
          setIsPushLoading(false); // Stop loading on fallback
      }

    } else {
      console.log('[Push Hook] Push API not supported.');
      setIsPushSupported(false);
      setPermissionState('n/a');
      setIsPushLoading(false);
    }

    // Clean up listener on unmount
    return () => {
        console.log('[Push Hook] Component unmounting.');
        if (navigator.permissions) {
            navigator.permissions.query({ name: 'notifications' }).then(status => {
                status.onchange = null;
            }).catch(() => {}); // Ignore errors on cleanup
        }
    };
  }, []); // Run only once

  // Check subscription status only when component is mounted, push is supported, and permission is granted
  useEffect(() => {
    if (!isMounted || !isPushSupported || permissionState !== 'granted') {
        // If permission is not granted or support isn't there, we know push isn't enabled.
        // Make sure loading is false in these cases unless it's the initial permission load.
        if (permissionState !== 'loading') {
            console.log(`[Push Hook] Subscription check skipped (mounted:${isMounted}, supported:${isPushSupported}, permission:${permissionState}). Setting enabled=false, loading=false.`);
            setIsPushEnabled(false);
            setIsPushLoading(false); // Ensure loading is false if permission isn't granted and not loading
        }
        return;
    }

    // If permission is granted, check the actual subscription status.
    console.log('[Push Hook] Checking subscription status (permission granted).');
    // Don't set loading=true here, the initial load handles it. Subsequent checks shouldn't show loading UI.
    let isActive = true; // Flag to prevent state updates if component unmounts

    const checkSubscription = async () => {
      try {
        const swRegistration = await navigator.serviceWorker.ready;
        const subscription = await swRegistration.pushManager.getSubscription();
        if (isActive) {
             console.log('[Push Hook] Subscription status result:', !!subscription);
             setIsPushEnabled(!!subscription);
        }
      } catch (error) {
        console.error("[Push Hook] Error checking push subscription:", error);
        if (isActive) {
            setIsPushEnabled(false);
        }
      } finally {
        if (isActive) {
            console.log('[Push Hook] Subscription check complete.');
            // Loading state was already set by the first effect, don't reset it here unless needed.
        }
      }
    };

    checkSubscription();

    return () => { isActive = false; }; // Cleanup flag on unmount

  // Re-run ONLY when these critical conditions change.
  }, [isMounted, isPushSupported, permissionState]);


  // Function to explicitly request notification permission
  const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
        if (!isMounted || !isPushSupported || permissionState !== 'default') {
            console.warn(`[Push Hook] Request permission skipped (mounted:${isMounted}, supported:${isPushSupported}, permission:${permissionState})`);
            return permissionState === 'loading' ? 'default' : permissionState; // Return current state if not applicable
        }
        console.log('[Push Hook] Explicitly requesting notification permission...');
        try {
            const result = await Notification.requestPermission();
            console.log('[Push Hook] Permission request result:', result);
            setPermissionState(result); // Update state with the result
            return result;
        } catch (error) {
             console.error("[Push Hook] Error requesting notification permission:", error);
             showToast({ variant: "destructive", title: "Errore Permesso", description: "Impossibile richiedere il permesso per le notifiche." });
             return 'default'; // Return default on error
        }

  }, [isMounted, isPushSupported, permissionState, showToast]); // Dependencies for requesting permission


  // Function to toggle subscription (subscribe/unsubscribe)
  const togglePushNotifications = useCallback(async () => {
    // Guard clause: Do not proceed if not mounted, not supported, loading, or permission denied
    if (!isMounted || !isPushSupported || isPushLoading || permissionState === 'denied' || permissionState === 'loading') {
        console.log(`[Push Hook] Toggle skipped (mounted:${isMounted}, supported:${isPushSupported}, loading:${isPushLoading}, permission:${permissionState})`);
        if (permissionState === 'denied') {
             showToast({ variant: "destructive", title: "Permesso Negato", description: "Le notifiche sono bloccate. Modifica i permessi nelle impostazioni." });
        }
        return;
    }

     // Guard clause: If permission is default, user MUST call requestPermission first.
     if (permissionState === 'default') {
         console.warn("[Push Hook] Toggle skipped: Permission is 'default'. Call requestPermission() first.");
         showToast({ title: "Azione Richiesta", description: "Per favore, abilita prima le notifiche cliccando il pulsante." });
         return;
     }

    console.log(`[Push Hook] Toggling push. Current state: enabled=${isPushEnabled}, permission=${permissionState}`);
    setIsPushLoading(true); // Indicate loading during toggle
    try {
        if (isPushEnabled) {
            // --- Unsubscribe ---
            console.log('[Push Hook] Unsubscribing...');
            await unsubscribeUserFromPush();
            setIsPushEnabled(false);
            showToast({ title: "Notifiche Disabilitate" });
            console.log('[Push Hook] Unsubscribed successfully.');
        } else if (permissionState === 'granted') {
            // --- Subscribe (only if permission is granted) ---
            console.log('[Push Hook] Permission granted. Subscribing user...');
            const subscription = await subscribeUserToPush();
            if (subscription) {
                setIsPushEnabled(true);
                showToast({ title: "Notifiche Abilitate" });
                console.log('[Push Hook] Subscribed successfully.');
                // Optional: Trigger notification scheduling for today
                // scheduleNotificationsForToday(); // You'd need to implement this
            } else {
                setIsPushEnabled(false); // Stay disabled if subscription failed
                console.error('[Push Hook] Subscription failed (check subscribeUserToPush logs).');
                // Error toast handled within subscribeUserToPush
            }
        } else {
            // This case should technically be handled by the initial guard clauses, but added for safety.
             console.warn(`[Push Hook] Toggle called with unexpected permission state: ${permissionState}`);
             setIsPushEnabled(false);
        }
    } catch (error) {
         console.error("[Push Hook] Error toggling push notifications:", error);
         showToast({ variant: "destructive", title: "Errore", description: "Impossibile aggiornare le impostazioni delle notifiche." });
         // Attempt to re-check state on error to maintain consistency
         try {
            const swReg = await navigator.serviceWorker.ready;
            const sub = await swReg.pushManager.getSubscription();
            setIsPushEnabled(!!sub);
         } catch (recheckError) {
             console.error("[Push Hook] Error re-checking subscription state after toggle error:", recheckError);
         }

    } finally {
        console.log('[Push Hook] Toggle action finished.');
        setIsPushLoading(false); // Stop loading after toggle completes
    }
  // Depend on the current state and support status.
  }, [isMounted, isPushSupported, isPushLoading, isPushEnabled, toast, permissionState, requestPermission, showToast]);


  return {
    isPushEnabled,
    isPushLoading,
    isPushSupported,
    permissionState,
    togglePushNotifications,
    requestPermission, // Expose the request function
  };
}
