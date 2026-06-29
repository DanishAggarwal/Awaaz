import { Router, Request, Response } from "express";
import { db } from "../firebase-admin";
import { verifyToken, AuthenticatedRequest } from "../middleware/verifyToken";
import { FieldValue } from "firebase-admin/firestore";

const router = Router();

/**
 * GET /api/groups
 * Public endpoint to search and filter groups.
 * Supports query params: ?search= &type=
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const type = req.query.type as string | undefined;
    const search = req.query.search as string | undefined;

    // Fetch all groups to ensure highly consistent and resilient category and search matching
    const snapshot = await db.collection("groups").get();
    let groups: any[] = [];

    snapshot.forEach((doc: any) => {
      if (doc.id === "awaaz_public") {
        return; // Skip reserved system group
      }
      
      const data = doc.data();
      const createdAtClient = data.createdAt && typeof data.createdAt.toDate === "function"
        ? data.createdAt.toDate().toISOString()
        : (data.createdAt || new Date().toISOString());

      groups.push({
        id: doc.id,
        ...data,
        createdAt: createdAtClient
      });
    });

    // Apply in-memory type filter if provided (case-insensitive and trimmed)
    if (type) {
      const typeStr = type.toLowerCase().trim();
      groups = groups.filter((g) => 
        g.type && g.type.toLowerCase().trim() === typeStr
      );
    }

    // Apply in-memory search filter if provided
    if (search) {
      const searchStr = search.toLowerCase().trim();
      groups = groups.filter((g) => 
        (g.name && g.name.toLowerCase().includes(searchStr)) || 
        (g.description && g.description.toLowerCase().includes(searchStr))
      );
    }

    // Sort in-memory by memberCount desc for high resiliency (avoiding Firestore composite index errors)
    groups.sort((a, b) => (b.memberCount || 0) - (a.memberCount || 0));

    res.json({
      success: true,
      data: { groups }
    });
  } catch (error: any) {
    console.error("Error retrieving groups:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to retrieve groups"
    });
  }
});

/**
 * POST /api/groups
 * Protected endpoint to create a new community group.
 * Creator automatically becomes group admin.
 */
router.post("/", verifyToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const uid = req.user?.uid;
    if (!uid) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    const { name, description, type } = req.body;

    if (!name || typeof name !== "string" || !name.trim()) {
      res.status(400).json({ success: false, error: "Group name is required" });
      return;
    }

    if (!description || typeof description !== "string" || !description.trim()) {
      res.status(400).json({ success: false, error: "Group description is required" });
      return;
    }

    if (!type || typeof type !== "string" || !type.trim()) {
      res.status(400).json({ success: false, error: "Group type is required" });
      return;
    }

    const groupRef = db.collection("groups").doc();
    const groupId = groupRef.id;
    const membershipRef = db.collection("group_members").doc(`${groupId}_${uid}`);
    const userRef = db.collection("users").doc(uid);

    const nowStr = new Date().toISOString();

    const groupData = {
      id: groupId,
      name: name.trim(),
      description: description.trim(),
      type: type.trim(),
      creatorId: uid,
      memberCount: 1,
      issueCount: 0,
      createdAt: FieldValue.serverTimestamp()
    };

    // Use a transaction to ensure atomic group creation, membership setting, and user document updates
    await db.runTransaction(async (transaction) => {
      // Create the group
      transaction.set(groupRef, groupData);

      // Create group_members entry setting creator as admin
      transaction.set(membershipRef, {
        groupId,
        uid,
        role: "admin",
        joinedAt: FieldValue.serverTimestamp()
      });

      // Update user's groupIds array
      transaction.update(userRef, {
        groupIds: FieldValue.arrayUnion(groupId)
      });
    });

    res.json({
      success: true,
      data: {
        group: {
          ...groupData,
          createdAt: nowStr
        }
      }
    });
  } catch (error: any) {
    console.error("Error creating group:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to create group"
    });
  }
});

/**
 * GET /api/groups/:id
 * Public endpoint to retrieve complete group information.
 */
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const groupId = req.params.id;
    if (groupId === "awaaz_public") {
      res.status(403).json({ success: false, error: "Access denied to system-managed group." });
      return;
    }

    const groupDoc = await db.collection("groups").doc(groupId).get();

    if (!groupDoc.exists) {
      res.status(404).json({
        success: false,
        error: "Group not found"
      });
      return;
    }

    const groupData = groupDoc.data() || {};
    const createdAtClient = groupData.createdAt && typeof groupData.createdAt.toDate === "function"
      ? groupData.createdAt.toDate().toISOString()
      : (groupData.createdAt || new Date().toISOString());

    res.json({
      success: true,
      data: {
        group: {
          ...groupData,
          id: groupDoc.id,
          createdAt: createdAtClient
        }
      }
    });
  } catch (error: any) {
    console.error("Error getting group details:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to retrieve group details"
    });
  }
});

/**
 * POST /api/groups/:id/join
 * Protected endpoint to join a community group.
 */
router.post("/:id/join", verifyToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const groupId = req.params.id;
    if (groupId === "awaaz_public") {
      res.status(403).json({ success: false, error: "Cannot explicitly join the reserved Public Civic Network." });
      return;
    }

    const uid = req.user?.uid;
    if (!uid) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    const groupRef = db.collection("groups").doc(groupId);
    const groupDoc = await groupRef.get();
    if (!groupDoc.exists) {
      res.status(404).json({ success: false, error: "Group not found" });
      return;
    }

    const membershipId = `${groupId}_${uid}`;
    const membershipRef = db.collection("group_members").doc(membershipId);
    const userRef = db.collection("users").doc(uid);

    // Use a transaction to ensure full atomicity and avoid duplicate member counts
    const joinResult = await db.runTransaction(async (transaction) => {
      const membershipDoc = await transaction.get(membershipRef);
      if (membershipDoc.exists) {
        return { alreadyMember: true };
      }

      // Create membership document
      transaction.set(membershipRef, {
        groupId,
        uid,
        role: "member",
        joinedAt: FieldValue.serverTimestamp()
      });

      // Increment memberCount on the group
      transaction.update(groupRef, {
        memberCount: FieldValue.increment(1)
      });

      // Update user's groupIds array
      transaction.update(userRef, {
        groupIds: FieldValue.arrayUnion(groupId)
      });

      return { alreadyMember: false };
    });

    res.json({
      success: true,
      data: {
        message: joinResult.alreadyMember ? "Already a member" : "Joined group successfully"
      }
    });
  } catch (error: any) {
    console.error("Error joining group:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to join group"
    });
  }
});

/**
 * GET /api/groups/:id/my-role
 * Protected endpoint to get user's role in a group.
 */
router.get("/:id/my-role", verifyToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const groupId = req.params.id;
    if (groupId === "awaaz_public") {
      res.status(403).json({ success: false, error: "Access denied to system-managed group." });
      return;
    }

    const uid = req.user?.uid;
    if (!uid) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    const membershipId = `${groupId}_${uid}`;
    const membershipDoc = await db.collection("group_members").doc(membershipId).get();

    if (membershipDoc.exists) {
      res.json({
        success: true,
        data: {
          role: membershipDoc.data()?.role || "member"
        }
      });
    } else {
      res.json({
        success: true,
        data: {
          role: null
        }
      });
    }
  } catch (error: any) {
    console.error("Error getting group member role:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to retrieve group role"
    });
  }
});

/**
 * GET /api/groups/:id/members
 * Public/Protected endpoint to retrieve group members with user details.
 */
router.get("/:id/members", async (req: Request, res: Response) => {
  try {
    const groupId = req.params.id;
    if (groupId === "awaaz_public") {
      res.status(403).json({ success: false, error: "Access denied to system-managed group." });
      return;
    }

    // Fetch all members of this group
    const membersSnapshot = await db.collection("group_members")
      .where("groupId", "==", groupId)
      .get();

    const membersList: any[] = [];
    const userIds: string[] = [];

    membersSnapshot.forEach((doc) => {
      const data = doc.data();
      membersList.push({
        uid: data.uid,
        role: data.role || "member",
        joinedAt: data.joinedAt
      });
      if (data.uid) {
        userIds.push(data.uid);
      }
    });

    if (userIds.length === 0) {
      res.json({ success: true, data: { members: [] } });
      return;
    }

    // Since we want to join with user info, we can fetch users by ID.
    const userDocsPromises: Promise<any>[] = [];
    const uniqueUserIds = Array.from(new Set(userIds));

    // Chunk size 30 for Firestore 'in' query
    const chunkSize = 30;
    for (let i = 0; i < uniqueUserIds.length; i += chunkSize) {
      const chunk = uniqueUserIds.slice(i, i + chunkSize);
      userDocsPromises.push(
        db.collection("users").where("__name__", "in", chunk).get()
      );
    }

    const userSnapshots = await Promise.all(userDocsPromises);
    const userMap: Record<string, any> = {};

    userSnapshots.forEach((snapshot) => {
      snapshot.forEach((doc: any) => {
        userMap[doc.id] = doc.data();
      });
    });

    const membersWithUserInfo = membersList.map((m) => {
      const uData = userMap[m.uid] || {};
      return {
        uid: m.uid,
        role: m.role, // "admin" or "member"
        displayName: uData.displayName || "Anonymous Citizen",
        photoURL: uData.photoURL || null,
        email: uData.email || ""
      };
    });

    res.json({
      success: true,
      data: {
        members: membersWithUserInfo
      }
    });
  } catch (error: any) {
    console.error("Error retrieving group members:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to retrieve group members"
    });
  }
});

export default router;
