import { initializeApp, getApps, getApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import fs from "fs";
import path from "path";

const projectId = process.env.FIREBASE_PROJECT_ID || "swift-tea-h1b2m";

let app;

if (getApps().length === 0) {
  // Check if a service account JSON file exists locally
  const localKeyPath = path.join(process.cwd(), "service-account.json");
  
  if (fs.existsSync(localKeyPath)) {
    try {
      const serviceAccount = JSON.parse(fs.readFileSync(localKeyPath, "utf8"));
      app = initializeApp({
        credential: cert(serviceAccount),
        projectId: serviceAccount.project_id || projectId
      });
      console.log(`🔥 Firebase Admin initialized locally using service-account.json (Project: ${serviceAccount.project_id || projectId})`);
    } catch (err) {
      console.error("⚠️ Failed to load local service-account.json, falling back to default:", err);
      app = initializeApp({ projectId });
    }
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      app = initializeApp({
        credential: cert(serviceAccount),
        projectId: serviceAccount.project_id || projectId
      });
      console.log(`🔥 Firebase Admin initialized via env FIREBASE_SERVICE_ACCOUNT_JSON (Project: ${serviceAccount.project_id || projectId})`);
    } catch (err) {
      console.error("⚠️ Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON, falling back to default:", err);
      app = initializeApp({ projectId });
    }
  } else {
    // Fallback to Application Default Credentials (ADC) in Google Cloud Run/AI Studio
    app = initializeApp({ projectId });
    console.log(`🔥 Firebase Admin initialized for project: ${projectId} (using default environment credentials)`);
  }
} else {
  app = getApp();
}

const db = getFirestore(app);
const auth = getAuth(app);

export { app, db, auth };
