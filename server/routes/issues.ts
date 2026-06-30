import { Router, Response } from "express";
import { db } from "../firebase-admin";
import { verifyToken, AuthenticatedRequest } from "../middleware/verifyToken";
import { FieldValue } from "firebase-admin/firestore";
import { calculatePriorityScore } from "../utils/priority";
import { COMMUNITY_VERIFICATION_THRESHOLD } from "../config/constants";
import { analyzeCivicIssue } from "../agents/ingestionAgent";
import { analyzeCommunityContext } from "../agents/communityAgent";
import { analyzeTruthVerification, isTruthCacheValid } from "../agents/truthEngine";
import { findDuplicateIssue } from "../services/duplicateService";
import { canModerateIssue, isGroupMember } from "../services/authService";
import { generateCivicReportPDF } from "../services/pdfService";

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

    let { groupId, description, imageUrls, location, visibility, allowDuplicate } = req.body;

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
    if (groupId && groupId !== "awaaz_public") {
      visibility = "group";
    } else {
      visibility = "public";
      groupId = "awaaz_public";
    }

    let groupName = "Public Initiative";

    // 2. Validate user belongs to selected group if groupId is provided (and is not the reserved public group)
    if (groupId && groupId !== "awaaz_public") {
      const isMember = await isGroupMember(uid, groupId);
      if (!isMember) {
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

    // 4. Run Ingestion Agent validation
    let aiResult;
    try {
      const firstImageUrl = imageUrls && imageUrls.length > 0 ? imageUrls[0] : undefined;
      aiResult = await analyzeCivicIssue({
        imageUrl: firstImageUrl,
        description: description.trim()
      });
    } catch (err: any) {
      console.error("AI Intake Ingestion Agent failed:", err);
      res.status(503).json({
        success: false,
        error: "The AI Civic Intake service is temporarily unavailable. Please try again shortly."
      });
      return;
    }

    // Handle invalid civic submission
    if (!aiResult.validIssue) {
      res.status(400).json({
        success: false,
        error: "This submission does not appear to describe a valid civic issue.",
        reason: aiResult.rejectionReason || "The uploaded image does not depict a public civic issue."
      });
      return;
    }

    // 4.5. Run Duplicate Detection (Phase 3)
    let duplicateCandidate = null;
    if (!allowDuplicate) {
      const lat = typeof location.latitude === "number" ? location.latitude : parseFloat(location.latitude);
      const lng = typeof location.longitude === "number" ? location.longitude : parseFloat(location.longitude);

      if (typeof lat === "number" && !isNaN(lat) && typeof lng === "number" && !isNaN(lng)) {
        try {
          duplicateCandidate = await findDuplicateIssue({
            db,
            latitude: lat,
            longitude: lng,
            category: aiResult.category!,
            groupId
          });
        } catch (err: any) {
          console.error("Duplicate detection failed:", err);
          res.status(500).json({
            success: false,
            error: "An internal server error occurred during duplicate check."
          });
          return;
        }
      }

      if (duplicateCandidate) {
        // TODO: When a duplicate is eventually confirmed by the user (future phase), the existing issue will increase dna.duplicateReports.
        res.status(409).json({
          success: false,
          duplicate: true,
          message: "A similar issue has already been reported nearby.",
          existingIssue: {
            id: duplicateCandidate.id,
            title: duplicateCandidate.title,
            distance: duplicateCandidate.distance,
            endorsementCount: duplicateCandidate.endorsementCount,
            status: duplicateCandidate.status,
            summary: duplicateCandidate.summary,
            category: duplicateCandidate.category,
            priorityScore: duplicateCandidate.priorityScore
          }
        });
        return;
      }
    }

    // 5. Calculate priority score including AI severity
    const priorityScore = calculatePriorityScore({
      description,
      imageUrls,
      location,
      endorsementCount: 0,
      severity: aiResult.severity
    });

    const issueRef = db.collection("issues").doc();
    const issueId = issueRef.id;

    const newIssueData = {
      id: issueId,
      groupId,
      groupName,
      title: aiResult.title,
      summary: aiResult.summary,
      category: aiResult.category,
      severity: aiResult.severity,
      recommendedDepartment: aiResult.recommendedDepartment,
      confidence: aiResult.confidence,
      visualEvidence: aiResult.visualEvidence,
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
        duplicateReports: 0,
        verificationCount: 0,
        endorsementVelocity: 0,
        lastPriorityUpdate: FieldValue.serverTimestamp(),
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
      const groupDocRef = db.collection("groups").doc(groupId);
      if (groupId === "awaaz_public") {
        batch.set(groupDocRef, {
          id: "awaaz_public",
          name: "awaaz_public",
          type: "system",
          description: "Public Civic Network",
          issueCount: FieldValue.increment(1)
        }, { merge: true });
      } else {
        batch.update(groupDocRef, {
          issueCount: FieldValue.increment(1)
        });
      }
    }

    await batch.commit();

    // Map timestamps back to ISO string for the client response
    const clientIssue = {
      ...newIssueData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      dna: {
        ...newIssueData.dna,
        lastPriorityUpdate: new Date().toISOString(),
        createdAt: new Date().toISOString()
      }
    };

    res.status(201).json({
      success: true,
      data: {
        issue: clientIssue,
        ai: {
          title: aiResult.title,
          summary: aiResult.summary,
          category: aiResult.category,
          severity: aiResult.severity
        }
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
      : (issueData.dna?.createdAt || createdAtStr);

    const createdAtMillis = new Date(createdAtStr).getTime();
    const hoursElapsed = Math.max(0.1, (Date.now() - createdAtMillis) / (1000 * 60 * 60));
    const dynamicEndorsementVelocity = (issueData.endorsementCount || 0) / hoursElapsed;

    const fallbackDna = {
      reopenCount: issueData.dna?.reopenCount || issueData.reopenCount || 0,
      duplicateCount: issueData.dna?.duplicateCount || issueData.dna?.duplicateReports || issueData.duplicateReports || issueData.duplicateCount || 0,
      duplicateReports: issueData.dna?.duplicateReports || issueData.dna?.duplicateCount || issueData.duplicateReports || issueData.duplicateCount || 0,
      verificationCount: issueData.dna?.verificationCount || issueData.endorsementCount || 0,
      endorsementVelocity: issueData.dna?.endorsementVelocity ?? dynamicEndorsementVelocity,
      createdAt: dnaCreatedAtStr,
      lastPriorityUpdate: issueData.dna?.lastPriorityUpdate && typeof issueData.dna.lastPriorityUpdate.toDate === "function"
        ? issueData.dna.lastPriorityUpdate.toDate().toISOString()
        : (issueData.dna?.lastPriorityUpdate || updatedAtStr)
    };

    const uid = req.user?.uid;
    let endorsed = false;
    let canModerate = false;
    if (uid) {
      const endorsementDoc = await db.collection("issues").doc(issueId).collection("endorsements").doc(uid).get();
      endorsed = endorsementDoc.exists;
      canModerate = await canModerateIssue(uid, issueId);
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

    // Check truth analysis cache validity without automatically regenerating
    const truthAnalysis = issueData.truthAnalysis || null;
    let isOutdated = false;
    if (truthAnalysis && (issueData.status === "resolved" || issueData.status === "reopened")) {
      try {
        const commentsSnapshot = await db.collection("issues").doc(issueId).collection("comments").get();
        const commentCount = commentsSnapshot.size;
        isOutdated = !isTruthCacheValid(issueData, commentCount);
      } catch (e) {
        console.error("Error checking truth analysis cache validity in GET /:id:", e);
      }
    }

    const clientIssue = {
      ...issueData,
      id: issueDoc.id,
      endorsed,
      canModerate,
      statusHistory,
      createdAt: createdAtStr,
      updatedAt: updatedAtStr,
      truthAnalysis: truthAnalysis ? {
        ...truthAnalysis,
        isOutdated
      } : null,
      truthAnalysisStatus: issueData.truthAnalysisStatus || null,
      dna: fallbackDna
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
      if (groupIdQuery === "awaaz_public") {
        // Backwards compatibility: legacy public issues have groupId = null but visibility = "public".
        // Newly created public issues have groupId = "awaaz_public" and visibility = "public".
        // Filtering by visibility = "public" correctly fetches both.
        queryRef = queryRef.where("visibility", "==", "public");
      } else {
        queryRef = queryRef.where("groupId", "==", groupIdQuery);
      }
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
        : (data.dna?.createdAt || createdAtClient);

      const createdAtMillis = new Date(createdAtClient).getTime();
      const hoursElapsed = Math.max(0.1, (Date.now() - createdAtMillis) / (1000 * 60 * 60));
      const dynamicEndorsementVelocity = (data.endorsementCount || 0) / hoursElapsed;

      const fallbackDna = {
        reopenCount: data.dna?.reopenCount || data.reopenCount || 0,
        duplicateCount: data.dna?.duplicateCount || data.dna?.duplicateReports || data.duplicateReports || data.duplicateCount || 0,
        duplicateReports: data.dna?.duplicateReports || data.dna?.duplicateCount || data.duplicateReports || data.duplicateCount || 0,
        verificationCount: data.dna?.verificationCount || data.endorsementCount || 0,
        endorsementVelocity: data.dna?.endorsementVelocity ?? dynamicEndorsementVelocity,
        createdAt: dnaCreatedAtClient,
        lastPriorityUpdate: data.dna?.lastPriorityUpdate && typeof data.dna.lastPriorityUpdate.toDate === "function"
          ? data.dna.lastPriorityUpdate.toDate().toISOString()
          : (data.dna?.lastPriorityUpdate || updatedAtClient)
      };

      issues.push({
        id: doc.id,
        ...data,
        createdAt: createdAtClient,
        updatedAt: updatedAtClient,
        dna: fallbackDna
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
        ...issueData,
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

      const dna = issueData.dna || {};
      const createdAtTimestamp = issueData.createdAt;
      let createdAtMillis = Date.now();
      if (createdAtTimestamp) {
        if (typeof createdAtTimestamp.toDate === "function") {
          createdAtMillis = createdAtTimestamp.toDate().getTime();
        } else if (typeof createdAtTimestamp === "string") {
          createdAtMillis = new Date(createdAtTimestamp).getTime();
        } else if (typeof createdAtTimestamp.seconds === "number") {
          createdAtMillis = createdAtTimestamp.seconds * 1000;
        }
      }
      const hoursElapsed = Math.max(0.1, (Date.now() - createdAtMillis) / (1000 * 60 * 60));
      const endorsementVelocity = newCount / hoursElapsed;

      const updatedDna = {
        ...dna,
        verificationCount: newCount,
        endorsementVelocity,
        lastPriorityUpdate: FieldValue.serverTimestamp()
      };

      transaction.update(issueRef, {
        endorsementCount: newCount,
        priorityScore: newPriorityScore,
        status: newStatus,
        dna: updatedDna,
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
 * POST /api/issues/:id/support-duplicate
 * Protected endpoint to support an existing issue and mark it as duplicate reports.
 * Uses a single Firestore transaction to perform atomic updates.
 */
router.post("/:id/support-duplicate", verifyToken, async (req: AuthenticatedRequest, res: Response) => {
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

    await db.runTransaction(async (transaction) => {
      const issueDoc = await transaction.get(issueRef);
      if (!issueDoc.exists) {
        throw new Error("Issue not found.");
      }

      const issueData = issueDoc.data() || {};
      const issueStatus = issueData.status || "reported";
      
      const activeStatuses = ["reported", "verified", "in_progress"];
      if (!activeStatuses.includes(issueStatus)) {
        throw new Error("This issue is no longer active and cannot receive duplicate support.");
      }

      const endorsementDoc = await transaction.get(endorsementRef);
      const isNewEndorsement = !endorsementDoc.exists;

      const currentCount = issueData.endorsementCount || 0;
      const newEndorsementCount = isNewEndorsement ? currentCount + 1 : currentCount;

      if (isNewEndorsement) {
        transaction.set(endorsementRef, {
          uid,
          displayName,
          createdAt: FieldValue.serverTimestamp()
        });
      }

      const dna = issueData.dna || {};
      const prevDuplicateReports = dna.duplicateReports || 0;
      const newDuplicateReports = prevDuplicateReports + 1;

      const updatedDna = {
        ...dna,
        duplicateReports: newDuplicateReports,
        duplicateCount: newDuplicateReports, // Sync both fields
        lastPriorityUpdate: FieldValue.serverTimestamp()
      };

      const updatedIssueDataForPriority = {
        ...issueData,
        endorsementCount: newEndorsementCount,
        dna: {
          ...dna,
          duplicateReports: newDuplicateReports,
          duplicateCount: newDuplicateReports
        }
      };

      const newPriorityScore = calculatePriorityScore(updatedIssueDataForPriority);

      let newStatus = issueStatus;
      if (currentCount < COMMUNITY_VERIFICATION_THRESHOLD && newEndorsementCount >= COMMUNITY_VERIFICATION_THRESHOLD && newStatus === "reported") {
        newStatus = "verified";

        const historyRef = issueRef.collection("status_history").doc();
        transaction.set(historyRef, {
          fromStatus: "reported",
          toStatus: "verified",
          changedBy: "system",
          note: "Automatically verified after reaching community endorsement threshold via duplicate support.",
          timestamp: FieldValue.serverTimestamp()
        });
      }

      transaction.update(issueRef, {
        endorsementCount: newEndorsementCount,
        priorityScore: newPriorityScore,
        status: newStatus,
        dna: updatedDna,
        updatedAt: FieldValue.serverTimestamp()
      });
    });

    res.json({
      success: true,
      message: "Successfully supported the existing report and updated impact metadata."
    });
  } catch (error: any) {
    console.error("Error supporting duplicate issue:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to process duplicate support request."
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

/**
 * PATCH /api/issues/:id
 * Protected endpoint for administrators to update issue details (e.g., status).
 */
router.patch("/:id", verifyToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const uid = req.user?.uid;
    const issueId = req.params.id;
    const { status, resolution } = req.body;

    if (!uid) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    // 1. Check permissions
    const authorized = await canModerateIssue(uid, issueId);
    if (!authorized) {
      res.status(403).json({ success: false, error: "Forbidden: You do not have permission to moderate this issue." });
      return;
    }

    // 2. Validate status
    const allowedStatuses = ["reported", "verified", "in_progress", "resolved"];
    if (status && !allowedStatuses.includes(status)) {
      res.status(400).json({ success: false, error: "Invalid status value." });
      return;
    }

    const issueRef = db.collection("issues").doc(issueId);
    const issueDoc = await issueRef.get();
    if (!issueDoc.exists) {
      res.status(404).json({ success: false, error: "Issue not found." });
      return;
    }

    const issueData = issueDoc.data() || {};
    const oldStatus = issueData.status || "reported";

    const updateData: any = {
      updatedAt: FieldValue.serverTimestamp()
    };

    if (status) {
      updateData.status = status;
    }

    // Store resolution evidence if transitioning to resolved and evidence is provided
    if (status === "resolved") {
      updateData.truthAnalysisStatus = "generating";
      if (resolution) {
        if (!resolution.afterImageUrl || !resolution.resolutionNote) {
          res.status(400).json({ success: false, error: "Resolution after-photo and resolution note are required." });
          return;
        }
        updateData.resolution = {
          resolvedBy: req.user?.name || req.user?.email || "Administrator",
          resolvedAt: new Date().toISOString(),
          afterImageUrl: resolution.afterImageUrl,
          resolutionNote: resolution.resolutionNote,
          internalNote: resolution.internalNote || ""
        };
      }
    }

    // Perform the update
    await db.runTransaction(async (transaction) => {
      transaction.update(issueRef, updateData);

      // If status changed, write to status_history
      if (status && status !== oldStatus) {
        const historyRef = issueRef.collection("status_history").doc();
        transaction.set(historyRef, {
          fromStatus: oldStatus,
          toStatus: status,
          changedBy: req.user?.name || "Administrator",
          note: `Status manually updated by administrator.`,
          timestamp: FieldValue.serverTimestamp()
        });
      }
    });

    // Asynchronously trigger Truth Engine background generation
    if (status === "resolved") {
      (async () => {
        try {
          console.log(`[truthEngine] Triggering automatic background truth verification for issue ${issueId}`);
          await analyzeTruthVerification(issueId, true);
          console.log(`[truthEngine] Automatic background truth verification completed successfully for issue ${issueId}`);
        } catch (e) {
          console.error(`[truthEngine] Automatic background truth verification failed for issue ${issueId}:`, e);
          try {
            await issueRef.update({ truthAnalysisStatus: "failed" });
          } catch (fireErr) {
            console.error("Failed to update status to failed in Firestore:", fireErr);
          }
        }
      })();
    }

    res.json({
      success: true,
      data: {
        status: status || oldStatus
      }
    });
  } catch (error: any) {
    console.error("Error updating issue:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to update issue status."
    });
  }
});

/**
 * GET /api/issues/:id/community-analysis
 * Protected route to get or generate Community Analysis (Admin only).
 */
router.get("/:id/community-analysis", verifyToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const uid = req.user?.uid;
    const issueId = req.params.id;
    const force = req.query.force === "true";

    if (!uid) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    // 1. Check permissions
    const authorized = await canModerateIssue(uid, issueId);
    if (!authorized) {
      res.status(403).json({ success: false, error: "Forbidden: You do not have permission to access community analysis." });
      return;
    }

    // 2. Perform or fetch community analysis
    const analysis = await analyzeCommunityContext(issueId, force);

    res.json({
      success: true,
      data: {
        communityAnalysis: analysis
      }
    });
  } catch (error: any) {
    console.error("Error retrieving community analysis:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to retrieve community analysis."
    });
  }
});

/**
 * GET /api/issues/:id/export
 * Protected route to export an official civic report as a PDF.
 */
router.get("/:id/export", verifyToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const uid = req.user?.uid;
    const issueId = req.params.id;

    if (!uid) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    // 1. Check permissions (Admin/Moderator only)
    const authorized = await canModerateIssue(uid, issueId);
    if (!authorized) {
      res.status(403).json({ success: false, error: "Forbidden: You do not have permission to export reports." });
      return;
    }

    // 2. Fetch the issue document
    const issueDoc = await db.collection("issues").doc(issueId).get();
    if (!issueDoc.exists) {
      res.status(404).json({ success: false, error: "Issue not found." });
      return;
    }

    const issueData = issueDoc.data();

    // 3. Fetch comments
    const commentsSnapshot = await db.collection("issues").doc(issueId).collection("comments").get();
    const comments: any[] = [];
    commentsSnapshot.forEach((doc) => {
      comments.push(doc.data());
    });

    // 4. Download original evidence image to Buffer if present
    let imageBuffer: Buffer | null = null;
    if (issueData?.imageUrls && issueData.imageUrls.length > 0) {
      try {
        const imageUrl = issueData.imageUrls[0];
        const response = await fetch(imageUrl);
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          imageBuffer = Buffer.from(arrayBuffer);
        }
      } catch (err) {
        console.warn(`Failed to fetch image ${issueData.imageUrls[0]} for PDF report:`, err);
      }
    }

    // 5. Generate PDF Buffer
    const pdfBuffer = await generateCivicReportPDF(issueData, comments, imageBuffer);

    // 6. Send the PDF file
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="Awaaz_Civic_Report_${issueId}.pdf"`);
    res.send(pdfBuffer);
  } catch (error: any) {
    console.error("Error exporting PDF civic report:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to export PDF report."
    });
  }
});

/**
 * POST /api/issues/:id/reopen-request
 * Citizen submits a reopen request for a resolved issue.
 */
router.post("/:id/reopen-request", verifyToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const uid = req.user?.uid;
    const issueId = req.params.id;
    const { reason, photoUrl } = req.body;

    if (!uid) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    if (!reason || !reason.trim()) {
      res.status(400).json({ success: false, error: "Reason for reopening is required." });
      return;
    }

    const issueRef = db.collection("issues").doc(issueId);
    const issueDoc = await issueRef.get();
    if (!issueDoc.exists) {
      res.status(404).json({ success: false, error: "Issue not found." });
      return;
    }

    const issueData = issueDoc.data() || {};

    // Check if user belongs to the group of this issue if it's not awaaz_public
    if (issueData.groupId && issueData.groupId !== "awaaz_public") {
      const isMember = await isGroupMember(uid, issueData.groupId);
      if (!isMember) {
        res.status(403).json({ success: false, error: "Forbidden: You are not a member of this community group." });
        return;
      }
    }

    if (issueData.status !== "resolved") {
      res.status(400).json({ success: false, error: "Only resolved issues can be reopened." });
      return;
    }

    if (issueData.reopenRequest && issueData.reopenRequest.status === "pending") {
      res.status(400).json({ success: false, error: "A reopen request is already pending review for this issue." });
      return;
    }

    const reopenRequest = {
      requestedBy: req.user?.name || req.user?.email || "Citizen",
      requestedById: uid,
      requestedAt: new Date().toISOString(),
      reason: reason.trim(),
      photoUrl: photoUrl || null,
      status: "pending"
    };

    await issueRef.update({
      reopenRequest,
      updatedAt: FieldValue.serverTimestamp()
    });

    res.json({
      success: true,
      data: {
        reopenRequest
      }
    });
  } catch (error: any) {
    console.error("Error submitting reopen request:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to submit reopen request."
    });
  }
});

/**
 * POST /api/issues/:id/reopen/approve
 * Administrator approves a pending reopen request.
 */
router.post("/:id/reopen/approve", verifyToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const uid = req.user?.uid;
    const issueId = req.params.id;

    if (!uid) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    const authorized = await canModerateIssue(uid, issueId);
    if (!authorized) {
      res.status(403).json({ success: false, error: "Forbidden: You do not have permission to moderate this issue." });
      return;
    }

    const issueRef = db.collection("issues").doc(issueId);
    const issueDoc = await issueRef.get();
    if (!issueDoc.exists) {
      res.status(404).json({ success: false, error: "Issue not found." });
      return;
    }

    const issueData = issueDoc.data() || {};
    if (!issueData.reopenRequest || issueData.reopenRequest.status !== "pending") {
      res.status(400).json({ success: false, error: "No pending reopen request exists for this issue." });
      return;
    }

    const oldStatus = issueData.status || "resolved";
    const currentReopenCount = ((issueData.dna?.reopenCount ?? issueData.reopenCount ?? 0) as number) + 1;

    // Preserve resolution history
    const resolutions = issueData.resolutions || [];
    if (issueData.resolution) {
      resolutions.push({
        ...issueData.resolution,
        reopenedAt: new Date().toISOString(),
        reopenedBy: req.user?.name || "Administrator"
      });
    }

    // Recalculate priority score with new reopen count and status
    const dummyUpdatedIssue = {
      ...issueData,
      status: "reopened",
      reopenCount: currentReopenCount,
      dna: {
        ...(issueData.dna || {}),
        reopenCount: currentReopenCount
      }
    };
    const updatedPriorityScore = calculatePriorityScore(dummyUpdatedIssue);

    const updateData: any = {
      status: "reopened",
      reopenCount: currentReopenCount,
      "dna.reopenCount": currentReopenCount,
      "dna.lastPriorityUpdate": FieldValue.serverTimestamp(),
      priorityScore: updatedPriorityScore,
      "reopenRequest.status": "approved",
      resolution: null, // clear active resolution evidence visibility
      resolutions, // store historical resolutions
      communityAnalysis: null, // Invalidate Community Agent cache
      updatedAt: FieldValue.serverTimestamp()
    };

    await db.runTransaction(async (transaction) => {
      transaction.update(issueRef, updateData);

      // Record status history
      const historyRef = issueRef.collection("status_history").doc();
      transaction.set(historyRef, {
        fromStatus: oldStatus,
        toStatus: "reopened",
        changedBy: req.user?.name || "Administrator",
        note: `Reopen request approved. Reason: ${issueData.reopenRequest.reason}`,
        timestamp: FieldValue.serverTimestamp()
      });
    });

    // Generate a fresh Community Summary synchronously or asynchronously.
    try {
      await analyzeCommunityContext(issueId, true);
    } catch (caErr) {
      console.error("Failed to regenerate community analysis after reopen approval:", caErr);
    }

    res.json({
      success: true,
      data: {
        status: "reopened",
        reopenCount: currentReopenCount,
        priorityScore: updatedPriorityScore
      }
    });
  } catch (error: any) {
    console.error("Error approving reopen request:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to approve reopen request."
    });
  }
});

/**
 * POST /api/issues/:id/reopen/reject
 * Administrator rejects a pending reopen request.
 */
router.post("/:id/reopen/reject", verifyToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const uid = req.user?.uid;
    const issueId = req.params.id;

    if (!uid) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    const authorized = await canModerateIssue(uid, issueId);
    if (!authorized) {
      res.status(403).json({ success: false, error: "Forbidden: You do not have permission to moderate this issue." });
      return;
    }

    const issueRef = db.collection("issues").doc(issueId);
    const issueDoc = await issueRef.get();
    if (!issueDoc.exists) {
      res.status(404).json({ success: false, error: "Issue not found." });
      return;
    }

    const issueData = issueDoc.data() || {};
    if (!issueData.reopenRequest || issueData.reopenRequest.status !== "pending") {
      res.status(400).json({ success: false, error: "No pending reopen request exists for this issue." });
      return;
    }

    await issueRef.update({
      "reopenRequest.status": "rejected",
      updatedAt: FieldValue.serverTimestamp()
    });

    res.json({
      success: true,
      data: {
        status: issueData.status || "resolved",
        reopenRequestStatus: "rejected"
      }
    });
  } catch (error: any) {
    console.error("Error rejecting reopen request:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to reject reopen request."
    });
  }
});

/**
 * GET /api/issues/:id/truth-analysis
 * Protected route to get or generate Truth Verification (Admin or Citizen).
 */
router.get("/:id/truth-analysis", verifyToken, async (req: AuthenticatedRequest, res: Response) => {
  const uid = req.user?.uid;
  const issueId = req.params.id;
  const force = req.query.force === "true";

  if (!uid) {
    res.status(401).json({ success: false, error: "Unauthorized" });
    return;
  }

  const issueRef = db.collection("issues").doc(issueId);

  try {
    await issueRef.update({ truthAnalysisStatus: "generating" });

    const analysis = await analyzeTruthVerification(issueId, force);
    
    const commentsSnapshot = await issueRef.collection("comments").get();
    const commentCount = commentsSnapshot.size;
    
    const issueDoc = await issueRef.get();
    const issueData = issueDoc.data() || {};
    const isOutdated = analysis ? !isTruthCacheValid(issueData, commentCount) : false;

    res.json({
      success: true,
      data: {
        truthAnalysis: analysis ? {
          ...analysis,
          isOutdated
        } : null,
        truthAnalysisStatus: "completed"
      }
    });
  } catch (error: any) {
    console.error("Error retrieving truth analysis:", error);
    try {
      await issueRef.update({ truthAnalysisStatus: "failed" });
    } catch (dbErr) {
      console.error("Failed to update truthAnalysisStatus to failed:", dbErr);
    }
    res.status(500).json({
      success: false,
      error: error.message || "Failed to retrieve truth verification."
    });
  }
});

export default router;
