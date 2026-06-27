import { Router, Response } from "express";
import { db } from "../firebase-admin";
import { verifyToken, AuthenticatedRequest } from "../middleware/verifyToken";
import { FieldValue } from "firebase-admin/firestore";
import { calculatePriorityScore } from "../utils/priority";
import { COMMUNITY_VERIFICATION_THRESHOLD } from "../config/constants";

const router = Router();

/**
 * POST /api/issues
 * Protected endpoint to report a civic issue.
 */
router.post("/", verifyToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const uid = req.user?.uid;
    const authorName = req.user?.name || "Citizen";
    const authorPicture = req.user?.picture || "";

    if (!uid) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    let { groupId, description, imageUrls, location, visibility } = req.body;

    // 1. Validations
    if (!description || !description.trim()) {
      res.status(400).json({ success: false, error: "Description is required." });
      return;
    }

    if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
      res.status(400).json({ success: false, error: "At least one reported image is required." });
      return;
    }

    if (!location || !location.address || !location.address.trim()) {
      res.status(400).json({ success: false, error: "A valid address or landmark location description is required." });
      return;
    }

    // Infer visibility if not provided, or ensure visibility aligns with groupId
    if (groupId) {
      visibility = "group";
    } else {
      visibility = "public";
      groupId = null;
    }

    let groupName = "Public Initiative";

    // 2. Validate user belongs to selected group if groupId is provided
    if (groupId) {
      const membershipId = `${groupId}_${uid}`;
      const membershipDoc = await db.collection("group_members").doc(membershipId).get();
      if (!membershipDoc.exists) {
        res.status(403).json({ success: false, error: "You must be a member of this community to report an issue." });
        return;
      }

      // 3. Lookup the group to verify existence and fetch groupName for denormalization
      const groupDoc = await db.collection("groups").doc(groupId).get();
      if (!groupDoc.exists) {
        res.status(404).json({ success: false, error: "Selected community group does not exist." });
        return;
      }
      const groupData = groupDoc.data() || {};
      groupName = groupData.name || "Unknown Community";
    }

    // 4. Calculate deterministic priority score
    const priorityScore = calculatePriorityScore({
      description,
      imageUrls,
      location
    });

    const issueRef = db.collection("issues").doc();
    const issueId = issueRef.id;

    const newIssueData = {
      id: issueId,
      groupId,
      groupName,
      description: description.trim(),
      imageUrls,
      location: {
        latitude: typeof location.latitude === "number" ? location.latitude : null,
        longitude: typeof location.longitude === "number" ? location.longitude : null,
        address: location.address || ""
      },
      visibility,
      status: "reported", // Default status
      priorityScore,
      dna: {
        reopenCount: 0,
        duplicateCount: 0,
        verificationCount: 0,
        createdAt: FieldValue.serverTimestamp()
      },
      authorId: uid,
      authorName,
      authorPicture,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    };

    // Store in Firestore and increment issueCount of group if applicable
    const batch = db.batch();
    batch.set(issueRef, newIssueData);
    if (groupId) {
      batch.update(db.collection("groups").doc(groupId), {
        issueCount: FieldValue.increment(1)
      });
    }

    await batch.commit();

    // Map timestamps back to ISO string for the client response
    const clientIssue = {
      ...newIssueData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      dna: {
        ...newIssueData.dna,
        createdAt: new Date().toISOString()
      }
    };

    res.status(201).json({
      success: true,
      data: {
        issue: clientIssue
      }
    });
  } catch (error: any) {
    console.error("Error creating issue:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to submit reported issue."
    });
  }
});

/**
 * GET /api/issues/:id
 * Retrieve a specific civic issue.
 */
router.get("/:id", verifyToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const issueId = req.params.id;
    const issueDoc = await db.collection("issues").doc(issueId).get();

    if (!issueDoc.exists) {
      res.status(404).json({
        success: false,
        error: "Issue not found."
      });
      return;
    }

    const issueData = issueDoc.data() || {};
    
    // Map timestamps to ISO strings
    const createdAtStr = issueData.createdAt && typeof issueData.createdAt.toDate === "function"
      ? issueData.createdAt.toDate().toISOString()
      : (issueData.createdAt || new Date().toISOString());

    const updatedAtStr = issueData.updatedAt && typeof issueData.updatedAt.toDate === "function"
      ? issueData.updatedAt.toDate().toISOString()
      : (issueData.updatedAt || new Date().toISOString());

    const dnaCreatedAtStr = issueData.dna && issueData.dna.createdAt && typeof issueData.dna.createdAt.toDate === "function"
      ? issueData.dna.createdAt.toDate().toISOString()
      : (issueData.dna?.createdAt || new Date().toISOString());

    const uid = req.user?.uid;
    let endorsed = false;
    if (uid) {
      const endorsementDoc = await db.collection("issues").doc(issueId).collection("endorsements").doc(uid).get();
      endorsed = endorsementDoc.exists;
    }

    const statusHistorySnapshot = await db.collection("issues").doc(issueId).collection("status_history").orderBy("timestamp", "desc").get();
    const statusHistory: any[] = [];
    statusHistorySnapshot.forEach((doc) => {
      const data = doc.data();
      const timestampStr = data.timestamp && typeof data.timestamp.toDate === "function"
        ? data.timestamp.toDate().toISOString()
        : (data.timestamp || new Date().toISOString());
      statusHistory.push({
        id: doc.id,
        ...data,
        timestamp: timestampStr
      });
    });

    const clientIssue = {
      ...issueData,
      id: issueDoc.id,
      endorsed,
      statusHistory,
      createdAt: createdAtStr,
      updatedAt: updatedAtStr,
      dna: issueData.dna ? {
        ...issueData.dna,
        createdAt: dnaCreatedAtStr
      } : undefined
    };

    res.json({
      success: true,
      data: {
        issue: clientIssue
      }
    });
  } catch (error: any) {
    console.error("Error getting issue details:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to retrieve issue details."
    });
  }
});

/**
 * GET /api/issues
 * Retrieve list of civic issues based on filters.
 * Supports:
 * - ?scope=my-groups (issues belonging to any of user's joined groups)
 * - ?scope=public (issues with public visibility)
 * - ?groupId=xyz (issues for a specific group)
 */
router.get("/", verifyToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const uid = req.user?.uid;
    if (!uid) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    const scope = req.query.scope as string | undefined;
    const groupIdQuery = req.query.groupId as string | undefined;

    let queryRef: any = db.collection("issues");

    // Filter by specific groupId
    if (groupIdQuery) {
      queryRef = queryRef.where("groupId", "==", groupIdQuery);
    } 
    // Filter by scope
    else if (scope === "public") {
      queryRef = queryRef.where("visibility", "==", "public");
    } 
    else if (scope === "my-groups") {
      // Fetch user's joined group IDs
      const userDoc = await db.collection("users").doc(uid).get();
      const userData = userDoc.data() || {};
      const groupIds = userData.groupIds || [];

      if (groupIds.length === 0) {
        // Return empty immediately if user hasn't joined any groups
        res.json({
          success: true,
          data: { issues: [] }
        });
        return;
      }

      // Firestore "in" queries are limited to 10 items.
      // We'll query all or handle elegantly. Since most users join < 10 groups,
      // we can split or slice, or perform in-memory filter if needed.
      // Let's do a robust query: if <= 10 groups, use where("groupId", "in", groupIds).
      // If > 10, chunk it or fetch all matching and filter in-memory.
      if (groupIds.length <= 10) {
        queryRef = queryRef.where("groupId", "in", groupIds);
      } else {
        // Fallback: fetch first 10, or do in-memory filter of recent issues
        // (to keep it secure, we fetch recent and filter in-memory)
        queryRef = queryRef.orderBy("createdAt", "desc").limit(100);
      }
    } else {
      // Default: show public issues or any issues user has access to
      // For general feed: show public issues
      queryRef = queryRef.where("visibility", "==", "public");
    }

    // Sort by newest first.
    // If we filtered using "in" or have multiple fields, we can orderBy "createdAt" desc.
    // However, to prevent index requirement failures on combinations, we can order desc
    // in-memory or query simply and sort in-memory. Sorting in-memory is extremely resilient
    // and guarantees 100% success without triggering Firestore Composite Index requirement errors!
    const snapshot = await queryRef.get();
    let issues: any[] = [];

    snapshot.forEach((doc: any) => {
      const data = doc.data();
      const createdAtClient = data.createdAt && typeof data.createdAt.toDate === "function"
        ? data.createdAt.toDate().toISOString()
        : (data.createdAt || new Date().toISOString());

      const updatedAtClient = data.updatedAt && typeof data.updatedAt.toDate === "function"
        ? data.updatedAt.toDate().toISOString()
        : (data.updatedAt || new Date().toISOString());

      const dnaCreatedAtClient = data.dna && data.dna.createdAt && typeof data.dna.createdAt.toDate === "function"
        ? data.dna.createdAt.toDate().toISOString()
        : (data.dna?.createdAt || new Date().toISOString());

      issues.push({
        id: doc.id,
        ...data,
        createdAt: createdAtClient,
        updatedAt: updatedAtClient,
        dna: data.dna ? {
          ...data.dna,
          createdAt: dnaCreatedAtClient
        } : undefined
      });
    });

    // If we had more than 10 groups, we need to do the in-memory filtering here
    if (scope === "my-groups") {
      const userDoc = await db.collection("users").doc(uid).get();
      const userData = userDoc.data() || {};
      const groupIds = userData.groupIds || [];
      if (groupIds.length > 10) {
        issues = issues.filter((issue) => groupIds.includes(issue.groupId));
      }
    }

    // Always sort by newest first (createdAt descending)
    issues.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json({
      success: true,
      data: { issues }
    });
  } catch (error: any) {
    console.error("Error retrieving issues list:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to retrieve issues list."
    });
  }
});

/**
 * POST /api/issues/:id/endorse
 * Protected route to toggle endorsement of a civic issue.
 * Uses a single Firestore transaction for all reads and writes.
 */
router.post("/:id/endorse", verifyToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const uid = req.user?.uid;
    const displayName = req.user?.name || "Citizen";
    const issueId = req.params.id;

    if (!uid) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    const issueRef = db.collection("issues").doc(issueId);
    const endorsementRef = issueRef.collection("endorsements").doc(uid);

    let endorsed = false;

    await db.runTransaction(async (transaction) => {
      const issueDoc = await transaction.get(issueRef);
      if (!issueDoc.exists) {
        throw new Error("Issue not found.");
      }

      const endorsementDoc = await transaction.get(endorsementRef);
      const isAdd = !endorsementDoc.exists;
      endorsed = isAdd;

      if (isAdd) {
        transaction.set(endorsementRef, {
          uid,
          displayName,
          createdAt: FieldValue.serverTimestamp()
        });
      } else {
        transaction.delete(endorsementRef);
      }

      const currentCount = issueDoc.data()?.endorsementCount || 0;
      const newCount = isAdd ? currentCount + 1 : Math.max(0, currentCount - 1);

      const issueData = issueDoc.data() || {};
      const updatedIssueDataForPriority = {
        description: issueData.description || "",
        imageUrls: issueData.imageUrls || [],
        location: issueData.location || { latitude: 0, longitude: 0, address: "" },
        endorsementCount: newCount
      };
      const newPriorityScore = calculatePriorityScore(updatedIssueDataForPriority);

      let newStatus = issueData.status || "reported";

      if (currentCount < COMMUNITY_VERIFICATION_THRESHOLD && newCount >= COMMUNITY_VERIFICATION_THRESHOLD && newStatus === "reported") {
        newStatus = "verified";

        const historyRef = issueRef.collection("status_history").doc();
        transaction.set(historyRef, {
          fromStatus: "reported",
          toStatus: "verified",
          changedBy: "system",
          note: "Automatically verified after reaching community endorsement threshold.",
          timestamp: FieldValue.serverTimestamp()
        });

        // TODO: Invoke Community Agent here.
      }

      transaction.update(issueRef, {
        endorsementCount: newCount,
        priorityScore: newPriorityScore,
        status: newStatus,
        updatedAt: FieldValue.serverTimestamp()
      });
    });

    res.json({
      success: true,
      endorsed
    });
  } catch (error: any) {
    console.error("Error endorsing issue:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to toggle endorsement."
    });
  }
});

/**
 * GET /api/issues/:id/comments
 * Retrieve all comments for a specific issue.
 */
router.get("/:id/comments", verifyToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const issueId = req.params.id;
    const issueDoc = await db.collection("issues").doc(issueId).get();

    if (!issueDoc.exists) {
      res.status(404).json({
        success: false,
        error: "Issue not found."
      });
      return;
    }

    const commentsSnapshot = await db
      .collection("issues")
      .doc(issueId)
      .collection("comments")
      .orderBy("createdAt", "desc")
      .get();

    const comments: any[] = [];
    commentsSnapshot.forEach((doc) => {
      const data = doc.data();
      const createdAtStr = data.createdAt && typeof data.createdAt.toDate === "function"
        ? data.createdAt.toDate().toISOString()
        : (data.createdAt || new Date().toISOString());

      const updatedAtStr = data.updatedAt && typeof data.updatedAt.toDate === "function"
        ? data.updatedAt.toDate().toISOString()
        : (data.updatedAt || null);

      comments.push({
        id: doc.id,
        ...data,
        createdAt: createdAtStr,
        updatedAt: updatedAtStr
      });
    });

    res.json({
      success: true,
      data: { comments }
    });
  } catch (error: any) {
    console.error("Error getting comments:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to retrieve comments."
    });
  }
});

/**
 * POST /api/issues/:id/comments
 * Create a new comment on a specific issue.
 * Uses a single Firestore transaction to create comment and increment commentCount.
 */
router.post("/:id/comments", verifyToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const uid = req.user?.uid;
    const displayName = req.user?.name || "Citizen";
    const photoURL = req.user?.picture || "";
    const issueId = req.params.id;

    if (!uid) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    const { text } = req.body;
    if (!text || !text.trim()) {
      res.status(400).json({ success: false, error: "Comment text is required." });
      return;
    }

    const trimmedText = text.trim();

    const issueRef = db.collection("issues").doc(issueId);
    const commentRef = issueRef.collection("comments").doc();

    const newCommentData = {
      id: commentRef.id,
      uid,
      displayName,
      photoURL,
      text: trimmedText,
      createdAt: new Date().toISOString(),
      updatedAt: null,
      isEdited: false
    };

    await db.runTransaction(async (transaction) => {
      const issueDoc = await transaction.get(issueRef);
      if (!issueDoc.exists) {
        const err = new Error("Issue not found.");
        (err as any).statusCode = 404;
        throw err;
      }

      const issueData = issueDoc.data() || {};
      const currentCount = issueData.commentCount || 0;

      transaction.set(commentRef, {
        uid,
        displayName,
        photoURL,
        text: trimmedText,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: null,
        isEdited: false
      });

      transaction.update(issueRef, {
        commentCount: currentCount + 1,
        updatedAt: FieldValue.serverTimestamp()
      });
    });

    res.status(201).json({
      success: true,
      data: {
        comment: newCommentData
      }
    });
  } catch (error: any) {
    console.error("Error creating comment:", error);
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      error: error.message || "Failed to create comment."
    });
  }
});

/**
 * PATCH /api/issues/:id/comments/:commentId
 * Update an existing comment. Only the original author may edit.
 */
router.patch("/:id/comments/:commentId", verifyToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const uid = req.user?.uid;
    const issueId = req.params.id;
    const commentId = req.params.commentId;

    if (!uid) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    const { text } = req.body;
    if (!text || !text.trim()) {
      res.status(400).json({ success: false, error: "Comment text is required." });
      return;
    }

    const trimmedText = text.trim();

    const issueRef = db.collection("issues").doc(issueId);
    const commentRef = issueRef.collection("comments").doc(commentId);

    const issueDoc = await issueRef.get();
    if (!issueDoc.exists) {
      res.status(404).json({ success: false, error: "Issue not found." });
      return;
    }

    const commentDoc = await commentRef.get();
    if (!commentDoc.exists) {
      res.status(404).json({ success: false, error: "Comment not found." });
      return;
    }

    const commentData = commentDoc.data() || {};
    if (commentData.uid !== uid) {
      res.status(403).json({ success: false, error: "You are not authorized to edit this comment." });
      return;
    }

    await commentRef.update({
      text: trimmedText,
      updatedAt: FieldValue.serverTimestamp(),
      isEdited: true
    });

    res.json({
      success: true,
      data: {
        comment: {
          id: commentId,
          ...commentData,
          text: trimmedText,
          isEdited: true,
          updatedAt: new Date().toISOString()
        }
      }
    });
  } catch (error: any) {
    console.error("Error updating comment:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to update comment."
    });
  }
});

/**
 * DELETE /api/issues/:id/comments/:commentId
 * Delete an existing comment. Only the original author may delete.
 * Uses a single Firestore transaction to delete comment and decrement commentCount.
 */
router.delete("/:id/comments/:commentId", verifyToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const uid = req.user?.uid;
    const issueId = req.params.id;
    const commentId = req.params.commentId;

    if (!uid) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    const issueRef = db.collection("issues").doc(issueId);
    const commentRef = issueRef.collection("comments").doc(commentId);

    await db.runTransaction(async (transaction) => {
      const issueDoc = await transaction.get(issueRef);
      if (!issueDoc.exists) {
        const err = new Error("Issue not found.");
        (err as any).statusCode = 404;
        throw err;
      }

      const commentDoc = await transaction.get(commentRef);
      if (!commentDoc.exists) {
        const err = new Error("Comment not found.");
        (err as any).statusCode = 404;
        throw err;
      }

      const commentData = commentDoc.data() || {};
      if (commentData.uid !== uid) {
        const err = new Error("You are not authorized to delete this comment.");
        (err as any).statusCode = 403;
        throw err;
      }

      const issueData = issueDoc.data() || {};
      const currentCount = issueData.commentCount || 0;

      transaction.delete(commentRef);
      transaction.update(issueRef, {
        commentCount: Math.max(0, currentCount - 1),
        updatedAt: FieldValue.serverTimestamp()
      });
    });

    res.json({
      success: true,
      data: {
        message: "Comment deleted successfully."
      }
    });
  } catch (error: any) {
    console.error("Error deleting comment:", error);
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      error: error.message || "Failed to delete comment."
    });
  }
});

export default router;
