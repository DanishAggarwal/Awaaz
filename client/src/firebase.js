import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Config loaded directly from firebase-applet-config.json with support for custom environment overrides
const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "swift-tea-h1b2m.firebaseapp.com";
const inferredProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || authDomain.split(".")[0];

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDrJntFoqPBn3hLTCPnawgbVik4omgxskE",
  authDomain: authDomain,
  projectId: inferredProjectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || `${inferredProjectId}.firebasestorage.app`,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "887788131548",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:887788131548:web:ef3cc206925e298e8e5019"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// In AI Studio workspace environment, if project is swift-tea-h1b2m, use the custom database.
// If it's a dedicated project like awaaz-local-dev, use "(default)".
let firestoreDatabaseId = "(default)";
if (inferredProjectId === "swift-tea-h1b2m") {
  firestoreDatabaseId = import.meta.env.VITE_FIREBASE_DATABASE_ID || "ai-studio-8051d580-46fa-4604-809c-35b3b4010c07";
} else {
  firestoreDatabaseId = import.meta.env.VITE_FIREBASE_DATABASE_ID || "(default)";
}

const db = getFirestore(app, firestoreDatabaseId);
const googleProvider = new GoogleAuthProvider();

const signInWithGoogle = () => signInWithPopup(auth, googleProvider);
const signOutUser = () => signOut(auth);

export { app, auth, db, googleProvider, signInWithGoogle, signOutUser };
