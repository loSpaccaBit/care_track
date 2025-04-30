
// src/lib/firebase/config.ts

// Note: Prefix environment variables with NEXT_PUBLIC_ to expose them to the browser.
// Do NOT expose sensitive keys directly in the browser. Use server-side functions or environment variables
// configured during the build process if needed for server-only secrets.

export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  // measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID // Optional
};

// Basic validation to ensure config values are present (during development/build)
if (
  !firebaseConfig.apiKey ||
  !firebaseConfig.authDomain ||
  !firebaseConfig.projectId ||
  !firebaseConfig.storageBucket ||
  !firebaseConfig.messagingSenderId ||
  !firebaseConfig.appId
) {
  console.warn(`
    Firebase configuration is incomplete. Please check your environment variables:
    NEXT_PUBLIC_FIREBASE_API_KEY
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
    NEXT_PUBLIC_FIREBASE_PROJECT_ID
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
    NEXT_PUBLIC_FIREBASE_APP_ID
  `);
  // Optionally throw an error in production builds if config is missing
  // if (process.env.NODE_ENV === 'production') {
  //   throw new Error("Firebase configuration is incomplete. Deployment cannot proceed.");
  // }
}
