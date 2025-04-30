
// src/app/api/unsubscribe/route.ts
import { NextResponse } from 'next/server';
import { getFirestore, collection, doc, deleteDoc, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/firebase'; // Assuming your firebase init is here

export async function POST(request: Request) {
  try {
    const { endpoint } = await request.json();

    if (!endpoint) {
      return NextResponse.json({ success: false, error: 'Missing subscription endpoint' }, { status: 400 });
    }

    console.log('[API /unsubscribe] Received request to unsubscribe endpoint:', endpoint);

    // --- Firestore Deletion Logic ---
    const subscriptionsRef = collection(db, 'pushSubscriptions');
    const encodedEndpoint = btoa(endpoint); // Use the same encoding as when saving
    const subscriptionDocRef = doc(subscriptionsRef, encodedEndpoint);

    try {
        await deleteDoc(subscriptionDocRef);
        console.log('[API /unsubscribe] Subscription removed successfully from Firestore for endpoint:', endpoint);
    } catch (deleteError) {
        // It might be okay if the doc doesn't exist (already unsubscribed)
        console.warn(`[API /unsubscribe] Could not delete doc ${encodedEndpoint} (maybe already deleted?):`, deleteError);
        // Optionally, query to double-check before throwing an error, but deletion is often idempotent enough.
    }
    // --- End Firestore Deletion Logic ---

    // // --- In-Memory Removal (Temporary) ---
    // const initialLength = subscriptions.length;
    // subscriptions = subscriptions.filter(sub => sub.endpoint !== endpoint);
    // if (subscriptions.length < initialLength) {
    //     console.log('[API /unsubscribe] Subscription removed from in-memory store.');
    // } else {
    //      console.log('[API /unsubscribe] Subscription endpoint not found in in-memory store.');
    // }
    // console.log('[API /unsubscribe] Current in-memory subscriptions:', subscriptions.length);
    // // --- End In-Memory Removal ---

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API /unsubscribe] Error removing subscription:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
