import { db } from "../firebase-admin";

/**
 * Checks if a user is an active member of a community group.
 * Follows the implicit public membership design:
 * - Every authenticated citizen is considered an implicit member of "awaaz_public"
 * - For other groups, explicit records in the "group_members" collection are used.
 * 
 * @param uid The unique user ID
 * @param groupId The group/community ID
 */
export async function isGroupMember(uid: string, groupId: string): Promise<boolean> {
  if (!uid || !groupId) return false;

  // 1. Unify implicit membership for the reserved Public Civic Network
  if (groupId === "awaaz_public") {
    return true;
  }

  try {
    const membershipId = `${groupId}_${uid}`;
    const doc = await db.collection("group_members").doc(membershipId).get();
    return doc.exists;
  } catch (err) {
    console.error(`[authService] Error in isGroupMember for user ${uid}, group ${groupId}:`, err);
    return false;
  }
}

/**
 * Checks if a user is an administrator of a specific group (community or system-managed public network).
 * - For community groups, verifies that a "group_members" record has role === "admin"
 * - For the reserved system group "awaaz_public", checks if there is an admin record.
 * 
 * @param uid The unique user ID
 * @param groupId The group/community ID
 */
export async function isGroupAdmin(uid: string, groupId: string): Promise<boolean> {
  if (!uid || !groupId) return false;

  try {
    const membershipId = `${groupId}_${uid}`;
    const doc = await db.collection("group_members").doc(membershipId).get();
    if (!doc.exists) return false;
    return doc.data()?.role === "admin";
  } catch (err) {
    console.error(`[authService] Error in isGroupAdmin for user ${uid}, group ${groupId}:`, err);
    return false;
  }
}

/**
 * Convenience helper to check if a user is an administrator of the Public Civic Network.
 * Verified via membership role in the reserved system-managed group "awaaz_public".
 * 
 * @param uid The unique user ID
 */
export async function isPublicAdmin(uid: string): Promise<boolean> {
  return isGroupAdmin(uid, "awaaz_public");
}

/**
 * Retrieves the list of group IDs that the user administers.
 * 
 * @param uid The unique user ID
 */
export async function getAdministeredGroups(uid: string): Promise<string[]> {
  if (!uid) return [];

  try {
    const snapshot = await db.collection("group_members")
      .where("uid", "==", uid)
      .where("role", "==", "admin")
      .get();

    const groupIds: string[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      if (data.groupId) {
        groupIds.push(data.groupId);
      }
    });
    return groupIds;
  } catch (err) {
    console.error(`[authService] Error in getAdministeredGroups for user ${uid}:`, err);
    return [];
  }
}

/**
 * Determines whether a user can moderate a specific issue.
 * - If the issue has no community scope (public issue), only Public/Municipal Admins can moderate it.
 * - If the issue belongs to a community group, the admins of that community group can moderate it.
 * 
 * @param uid The unique user ID
 * @param issueId The unique issue ID
 */
export async function canModerateIssue(uid: string, issueId: string): Promise<boolean> {
  if (!uid || !issueId) return false;

  try {
    const issueDoc = await db.collection("issues").doc(issueId).get();
    if (!issueDoc.exists) return false;

    const data = issueDoc.data() || {};
    const groupId = data.groupId;

    const groupIdStr = groupId ? String(groupId).trim() : "";

    if (groupIdStr === "" || groupIdStr === "null" || groupIdStr === "undefined" || groupIdStr === "awaaz_public") {
      // Public issue requires public/municipal admin authority
      return isPublicAdmin(uid);
    } else {
      // Community-scoped issue requires community admin authority
      return isGroupAdmin(uid, groupIdStr);
    }
  } catch (err) {
    console.error(`[authService] Error in canModerateIssue for user ${uid}, issue ${issueId}:`, err);
    return false;
  }
}

/**
 * Prepare operational scopes for dashboard and tool access queries.
 * Provides answers for future dashboards like:
 * - Can this user access operational tools?
 * - Which scopes does this user administer?
 * - Retrieves details for each administered group to show in the UI selector.
 * 
 * @param uid The unique user ID
 */
export async function getUserManagedScopes(uid: string): Promise<{
  scopes: string[];
  canAccessOperationalTools: boolean;
  managedScopesDetails: Array<{ id: string; name: string; type: string; role: string }>;
}> {
  if (!uid) {
    return { scopes: [], canAccessOperationalTools: false, managedScopesDetails: [] };
  }

  try {
    const administeredGroupIds = await getAdministeredGroups(uid);
    const managedScopesDetails: Array<{ id: string; name: string; type: string; role: string }> = [];

    // If the user administers the public network, add the reserved Public Scope
    const isPubAdmin = await isPublicAdmin(uid);
    if (isPubAdmin) {
      if (!administeredGroupIds.includes("awaaz_public")) {
        administeredGroupIds.push("awaaz_public");
      }
    }

    // Lookup real community details for the administered group IDs
    if (administeredGroupIds.length > 0) {
      // Fetch details of those groups
      const chunks: string[][] = [];
      const chunkSize = 30;
      for (let i = 0; i < administeredGroupIds.length; i += chunkSize) {
        chunks.push(administeredGroupIds.slice(i, i + chunkSize));
      }

      const snapshots = await Promise.all(
        chunks.map(chunk => db.collection("groups").where("__name__", "in", chunk).get())
      );

      snapshots.forEach((snap) => {
        snap.forEach((doc) => {
          const data = doc.data();
          managedScopesDetails.push({
            id: doc.id,
            name: data.name || doc.id,
            type: data.type || "neighborhood",
            role: "admin"
          });
        });
      });

      // Robust fallback: if "awaaz_public" is administered but its Firestore document is not yet initialized,
      // ensure we still provide it in the list.
      if (administeredGroupIds.includes("awaaz_public") && !managedScopesDetails.some(s => s.id === "awaaz_public")) {
        managedScopesDetails.push({
          id: "awaaz_public",
          name: "awaaz_public",
          type: "system",
          role: "admin"
        });
      }
    }

    return {
      scopes: administeredGroupIds,
      canAccessOperationalTools: administeredGroupIds.length > 0,
      managedScopesDetails
    };
  } catch (err) {
    console.error(`[authService] Error in getUserManagedScopes for user ${uid}:`, err);
    return { scopes: [], canAccessOperationalTools: false, managedScopesDetails: [] };
  }
}
