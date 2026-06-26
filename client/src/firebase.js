import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Config loaded directly from firebase-applet-config.json with support for custom environment overrides
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDrJntFoqPBn3hLTCPnawgbVik4omgxskE",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "swift-tea-h1b2m.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "swift-tea-h1b2m",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "swift-tea-h1b2m.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "887788131548",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:887788131548:web:ef3cc206925e298e8e5019"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

const signInWithGoogle = () => signInWithPopup(auth, googleProvider);
const signOutUser = () => signOut(auth);

export { app, auth, db, googleProvider, signInWithGoogle, signOutUser };
