
// src/app/api/send-notification/route.ts
import { NextResponse } from 'next/server';
import webpush from 'web-push';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/firebase';

// Configure web-push with VAPID details
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const mailto = 'mailto:your-email@example.com'; // Replace with your email

if (!vapidPublicKey || !vapidPrivateKey) {
  console.error('VAPID keys are not defined in environment variables!');
  // Optionally throw an error during build/startup if keys are missing
  // throw new Error("VAPID keys are not configured.");
} else {
    try {
        webpush.setVapidDetails(mailto, vapidPublicKey, vapidPrivateKey);
        console.log("VAPID details set successfully.");
    } catch (error) {
         console.error('Error setting VAPID details:', error);
    }
}

interface PushSubscriptionData extends PushSubscription {
    // Add any other fields stored in Firestore, like userId or createdAt
}

export async function POST(request: Request) {
    if (!vapidPublicKey || !vapidPrivateKey) {
        return NextResponse.json({ success: false, error: 'VAPID keys not configured on server.' }, { status: 500 });
    }

  try {
    // 1. Get Notification Payload from Request Body (optional)
    let payload = {
        title: 'Notifica di Prova',
        body: 'Questo è un messaggio di test da CareTrack!',
        tag: `test-${Date.now()}`,
        url: '/' // Optional: URL to open on click
    };
    try {
        const requestData = await request.json();
        payload = { ...payload, ...requestData }; // Merge with default if body is provided
    } catch (e) {
        console.log("No payload provided in request body, using default.");
    }
    const notificationPayload = JSON.stringify(payload);

    // 2. Fetch Subscriptions from Firestore
    const subscriptionsRef = collection(db, 'pushSubscriptions');
    const snapshot = await getDocs(subscriptionsRef);

    if (snapshot.empty) {
      console.log('[API /send-notification] No subscriptions found.');
      return NextResponse.json({ success: true, message: 'No active subscriptions found.' });
    }

    const subscriptions = snapshot.docs.map(doc => doc.data() as PushSubscriptionData);
    console.log(`[API /send-notification] Found ${subscriptions.length} subscriptions.`);

    // 3. Send Notifications
    const sendPromises = subscriptions.map(subscription => {
        // Ensure subscription is in the correct format for web-push
        const pushSubscription = {
            endpoint: subscription.endpoint,
            keys: subscription.keys
        };

        console.log(`[API /send-notification] Sending notification to: ${subscription.endpoint.substring(0, 30)}...`);

        return webpush.sendNotification(pushSubscription, notificationPayload)
            .then(response => {
                console.log(`[API /send-notification] Sent notification successfully to ${subscription.endpoint.substring(0, 30)}. Status: ${response.statusCode}`);
                return { endpoint: subscription.endpoint, success: true };
            })
            .catch(error => {
                console.error(`[API /send-notification] Error sending notification to ${subscription.endpoint.substring(0, 30)}:`, error);
                // Handle specific errors (e.g., 410 Gone means subscription is invalid)
                if (error.statusCode === 404 || error.statusCode === 410) {
                    console.log(`[API /send-notification] Subscription gone or expired for ${subscription.endpoint.substring(0, 30)}. Removing.`);
                    // Remove the invalid subscription from Firestore
                    const docId = btoa(subscription.endpoint); // Use the same encoding
                    deleteDoc(doc(subscriptionsRef, docId)).catch(delErr => console.error("Error deleting stale subscription:", delErr));
                }
                return { endpoint: subscription.endpoint, success: false, error: error.message };
            });
    });

    // Wait for all notifications to be sent (or fail)
    const results = await Promise.allSettled(sendPromises);
    console.log('[API /send-notification] Send results:', results);

    const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failureCount = results.length - successCount;

    return NextResponse.json({
        success: true,
        message: `Sent ${successCount} notifications successfully. Failed for ${failureCount}.`,
        results // Optionally return detailed results
    });

  } catch (error) {
    console.error('[API /send-notification] General error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}

// Basic GET handler (optional, for testing if the route is reachable)
export async function GET() {
    return NextResponse.json({ message: "Send notification endpoint is active. Use POST to send." });
}
