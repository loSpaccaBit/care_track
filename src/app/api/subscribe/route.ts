
// src/app/api/subscribe/route.ts
import { NextResponse } from 'next/server';
import { getFirestore, collection, doc, setDoc, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/firebase'; // Assuming your firebase init is here

// In-memory store for demo purposes - REPLACE with Firestore in production
// let subscriptions: PushSubscription[] = []; // THIS IS TEMPORARY

interface SubscriptionData extends PushSubscription {
    // Add any additional fields you want to store, like userId
    // userId?: string;
}

export async function POST(request: Request) {
  try {
    const subscription = await request.json() as PushSubscription;

    // Basic validation
    if (!subscription || !subscription.endpoint) {
      return NextResponse.json({ success: false, error: 'Invalid subscription object' }, { status: 400 });
    }

    console.log('[API /subscribe] Received subscription:', JSON.stringify(subscription));

    // --- Firestore Storage Logic ---
    const subscriptionsRef = collection(db, 'pushSubscriptions');
    // Use the endpoint as the document ID for easy lookup/removal
    const subscriptionDocRef = doc(subscriptionsRef, btoa(subscription.endpoint)); // Base64 encode endpoint for valid ID

    // Check if subscription already exists (optional, setDoc overwrites anyway)
    // const q = query(subscriptionsRef, where('endpoint', '==', subscription.endpoint));
    // const querySnapshot = await getDocs(q);
    // if (!querySnapshot.empty) {
    //   console.log('[API /subscribe] Subscription already exists for endpoint:', subscription.endpoint);
    //   return NextResponse.json({ success: true, message: 'Subscription already exists' });
    // }

    // Store the subscription object along with potentially the user ID
    // You might want to get the user ID from a session or auth token here
    await setDoc(subscriptionDocRef, {
        ...subscription.toJSON(), // Store keys and endpoint
        createdAt: new Date(),
        // userId: 'some_user_id' // TODO: Add user association
    });

    console.log('[API /subscribe] Subscription stored successfully in Firestore.');
    // --- End Firestore Logic ---

    // // --- In-Memory Storage (Temporary) ---
    // const existingSubscription = subscriptions.find(sub => sub.endpoint === subscription.endpoint);
    // if (!existingSubscription) {
    //     subscriptions.push(subscription);
    //     console.log('[API /subscribe] Subscription added to in-memory store.');
    // } else {
    //     console.log('[API /subscribe] Subscription already exists in in-memory store.');
    // }
    // console.log('[API /subscribe] Current in-memory subscriptions:', subscriptions.length);
    // // --- End In-Memory Storage ---

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error('[API /subscribe] Error saving subscription:', error);
    // Determine the error type and return appropriate status
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    const status = errorMessage.includes('Invalid subscription') ? 400 : 500;
    return NextResponse.json({ success: false, error: errorMessage }, { status });
  }
}

// Optional: GET method to retrieve subscriptions (for debugging/admin)
export async function GET() {
    try {
        const subscriptionsRef = collection(db, 'pushSubscriptions');
        const snapshot = await getDocs(subscriptionsRef);
        const subs = snapshot.docs.map(doc => doc.data());
        return NextResponse.json({ success: true, subscriptions: subs });
    } catch (error) {
        console.error('[API /subscribe] Error fetching subscriptions:', error);
        return NextResponse.json({ success: false, error: 'Failed to fetch subscriptions' }, { status: 500 });
    }
}
