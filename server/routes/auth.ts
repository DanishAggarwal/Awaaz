import { Router, Response } from "express";
import { db } from "../firebase-admin";
import { verifyToken, AuthenticatedRequest } from "../middleware/verifyToken";
import { FieldValue } from "firebase-admin/firestore";

const router = Router();

/**
 * POST /api/auth/sync
 * Syncs user auth credentials with Firestore. Creates user profile if it doesn't exist.
 */
router.post("/sync", verifyToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({
        success: false,
        error: "Unauthorized"
      });
      return;
    }

    const { uid, name, email, picture } = user;
    const userRef = db.collection("users").doc(uid);
    const doc = await userRef.get();

    const displayName = name || "";
    const photoURL = picture || "";
    const nowStr = new Date().toISOString();

    if (!doc.exists) {
      // 1. Create document in Firestore using server timestamps
      const newUserDb = {
        uid,
        displayName,
        email: email || "",
        photoURL,
        role: "citizen",
        platformAdmin: false,
        points: 0,
        rank: "Citizen",
        groupIds: [],
        stats: {
          issuesReported: 0,
          issuesResolved: 0,
          endorsements: 0
        },
        createdAt: FieldValue.serverTimestamp(),
        lastLoginAt: FieldValue.serverTimestamp()
      };

      await userRef.set(newUserDb);

      // 2. Return serializable object to client
      const newUserClient = {
        ...newUserDb,
        createdAt: nowStr,
        lastLoginAt: nowStr
      };

      res.json({
        success: true,
        data: {
          user: newUserClient
        }
      });
    } else {
      const existingData = doc.data() || {};
      
      // Update fields in Firestore
      const updateDataDb = {
        displayName,
        photoURL,
        email: email || "",
        lastLoginAt: FieldValue.serverTimestamp()
      };

      await userRef.update(updateDataDb);

      // Return serializable merged object
      // Convert existing database timestamps (e.g. createdAt) from Firestore Timestamps to ISO strings
      const createdAtClient = existingData.createdAt && typeof existingData.createdAt.toDate === "function"
        ? existingData.createdAt.toDate().toISOString()
        : (existingData.createdAt || nowStr);

      const userMergedClient = {
        ...existingData,
        displayName,
        photoURL,
        email: email || "",
        createdAt: createdAtClient,
        lastLoginAt: nowStr
      };

      res.json({
        success: true,
        data: {
          user: userMergedClient
        }
      });
    }
  } catch (error: any) {
    console.error("Error in /api/auth/sync:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to sync user profile"
    });
  }
});

export default router;
