
// src/lib/firebase/firebase.ts
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
// Import other Firebase services as needed (e.g., getStorage)

import { firebaseConfig } from './config';

// Initialize Firebase only if it hasn't been initialized yet
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

const auth = getAuth(app);
const db = getFirestore(app);
// const storage = getStorage(app); // Example if using storage

export { app, auth, db };
