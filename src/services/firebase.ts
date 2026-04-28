import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics, isSupported } from "firebase/analytics";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY?.trim(),
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN?.trim(),
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim(),
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET?.trim(),
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim(),
  appId: import.meta.env.VITE_FIREBASE_APP_ID?.trim(),
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID?.trim()
};

// Only initialize if we have an API Key
let app;
let db: any;
let analytics: any = null;

try {
    if (firebaseConfig.apiKey && firebaseConfig.apiKey !== 'your_api_key') {
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        isSupported().then(yes => yes ? analytics = getAnalytics(app!) : null);
        console.log("🔥 Firebase Initialized Successfully");
    } else {
        console.warn("⚠️ Firebase API Key missing or invalid. Check your .env file.");
    }
} catch (e) {
    console.error("❌ Firebase failed to load:", e);
}

export { db, analytics };
