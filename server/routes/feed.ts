import { Router, Request, Response } from "express";
import { db } from "../firebase-admin";

const router = Router();

/**
 * GET /api/feed/rising
 * Public. Retrieve issues sorted by priority score.
 */
router.get("/rising", async (req: Request, res: Response) => {
  try {
    const limitVal = parseInt(req.query.limit as string) || 20;

    // Fetch from issues collection, order by priorityScore desc
    const snapshot = await db.collection("issues")
      .orderBy("priorityScore", "desc")
      .limit(limitVal)
      .get();

    const issues: any[] = [];
    snapshot.forEach((doc) => {
      issues.push({
        id: doc.id,
        ...doc.data()
      });
    });

    res.json({
      success: true,
      data: { issues }
    });
  } catch (error: any) {
    console.error("Error getting rising feed issues:", error);
    res.status(500).json({
      success: false,
      data: null,
      error: error.message || "Failed to query rising issues from Firestore"
    });
  }
});

export default router;
