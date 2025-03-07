import { initializeApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Enable offline persistence for authentication
setPersistence(auth, browserLocalPersistence).catch(error => {
  console.error('Error setting auth persistence:', error);
});

// Enable offline persistence for Firestore with better error handling
try {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('Persistence failed to enable: Multiple tabs open');
    } else if (err.code === 'unimplemented') {
      console.warn('Persistence not supported by browser');
    } else {
      console.error('Error enabling persistence:', err);
    }
  });
} catch (error) {
  console.error('Error setting up Firestore persistence:', error);
}