/**
 * API client for Awaaz.
 * All frontend API calls live here only.
 */
import { collection, query, where, onSnapshot, orderBy, limit } from "firebase/firestore";
import { auth, db } from "./firebase";

const BASE_URL = "/api";

/**
 * Helper to perform fetch requests with automatic JSON parsing and error handling.
 */
async function apiRequest(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  
  // Setup headers
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  // Automatically inject Bearer token if user is signed in
  if (auth && auth.currentUser && !headers["Authorization"]) {
    try {
      const token = await auth.currentUser.getIdToken();
      headers["Authorization"] = `Bearer ${token}`;
    } catch (err) {
      console.error("Error getting auth token for API request:", err);
    }
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });
    
    const responseData = await response.json();
    return responseData;
  } catch (error) {
    console.error(`API Error on ${endpoint}:`, error);
    return {
      success: false,
      data: null,
      error: error.message || "An unexpected error occurred",
    };
  }
}

/**
 * Public: Get rising issues sorted by priority score.
 * Matches GET /api/feed/rising
 */
export async function getRisingIssues(limit = 20, cursor = "") {
  let query = `?limit=${limit}`;
  if (cursor) {
    query += `&cursor=${cursor}`;
  }
  return apiRequest(`/feed/rising${query}`);
}

/**
 * Public: Get groups matching search and/or type filters.
 * Matches GET /api/groups
 */
export async function getGroups(params = {}) {
  const queryParts = [];
  if (params.search) {
    queryParts.push(`search=${encodeURIComponent(params.search)}`);
  }
  if (params.type) {
    queryParts.push(`type=${encodeURIComponent(params.type)}`);
  }
  const queryString = queryParts.length > 0 ? `?${queryParts.join("&")}` : "";
  return apiRequest(`/groups${queryString}`);
}

/**
 * Protected: Create a new community group.
 * Matches POST /api/groups
 */
export async function createGroup(body) {
  return apiRequest("/groups", {
    method: "POST",
    body: JSON.stringify(body)
  });
}

/**
 * Public: Get complete group information by group ID.
 * Matches GET /api/groups/:id
 */
export async function getGroup(id) {
  return apiRequest(`/groups/${id}`);
}

/**
 * Protected: Join a community group.
 * Matches POST /api/groups/:id/join
 */
export async function joinGroup(id) {
  return apiRequest(`/groups/${id}/join`, {
    method: "POST"
  });
}

/**
 * Protected: Get current user's role in a group.
 * Matches GET /api/groups/:id/my-role
 */
export async function getMyRole(groupId) {
  return apiRequest(`/groups/${groupId}/my-role`);
}

/**
 * Public/Protected: Get members of a community group.
 * Matches GET /api/groups/:id/members
 */
export async function getGroupMembers(groupId) {
  return apiRequest(`/groups/${groupId}/members`);
}

/**
 * Protected: Create a new civic issue.
 * Matches POST /api/issues
 */
export async function createIssue(body) {
  return apiRequest("/issues", {
    method: "POST",
    body: JSON.stringify(body)
  });
}

/**
 * Protected: Get a specific issue by ID.
 * Matches GET /api/issues/:id
 */
export async function getIssue(id) {
  return apiRequest(`/issues/${id}`);
}

/**
 * Protected: Get or generate Community Analysis for a specific issue.
 * Matches GET /api/issues/:id/community-analysis
 */
export async function getCommunityAnalysis(id, force = false) {
  return apiRequest(`/issues/${id}/community-analysis${force ? "?force=true" : ""}`);
}

/**
 * Protected: Get or generate Truth Verification for a specific issue.
 * Matches GET /api/issues/:id/truth-analysis
 */
export async function getTruthAnalysis(id, force = false) {
  return apiRequest(`/issues/${id}/truth-analysis${force ? "?force=true" : ""}`);
}

/**
 * Protected: Get list of issues matching scope and/or groupId.
 * Matches GET /api/issues
 */
export async function getIssues(params = {}) {
  const queryParts = [];
  if (params.scope) {
    queryParts.push(`scope=${encodeURIComponent(params.scope)}`);
  }
  if (params.groupId) {
    queryParts.push(`groupId=${encodeURIComponent(params.groupId)}`);
  }
  const queryString = queryParts.length > 0 ? `?${queryParts.join("&")}` : "";
  return apiRequest(`/issues${queryString}`);
}

/**
 * Protected: Update status of a civic issue (Admin only).
 * Matches PATCH /api/issues/:id
 */
export async function updateIssueStatus(id, status, resolution) {
  return apiRequest(`/issues/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status, resolution })
  });
}

/**
 * Protected: Endorse or un-endorse a civic issue.
 * Matches POST /api/issues/:id/endorse
 */
export async function endorseIssue(id) {
  return apiRequest(`/issues/${id}/endorse`, {
    method: "POST"
  });
}

/**
 * Protected: Support an existing duplicate issue.
 * Matches POST /api/issues/:id/support-duplicate
 */
export async function supportDuplicateIssue(id) {
  return apiRequest(`/issues/${id}/support-duplicate`, {
    method: "POST"
  });
}

/**
 * Public/Protected: Get comments of a civic issue.
 * Matches GET /api/issues/:id/comments
 */
export async function getComments(issueId) {
  return apiRequest(`/issues/${issueId}/comments`);
}

/**
 * Protected: Create a comment on a civic issue.
 * Matches POST /api/issues/:id/comments
 */
export async function createComment(issueId, body) {
  return apiRequest(`/issues/${issueId}/comments`, {
    method: "POST",
    body: JSON.stringify(body)
  });
}

/**
 * Protected: Edit an existing comment.
 * Matches PATCH /api/issues/:id/comments/:commentId
 */
export async function updateComment(issueId, commentId, body) {
  return apiRequest(`/issues/${issueId}/comments/${commentId}`, {
    method: "PATCH",
    body: JSON.stringify(body)
  });
}

/**
 * Protected: Delete an existing comment.
 * Matches DELETE /api/issues/:id/comments/:commentId
 */
export async function deleteComment(issueId, commentId) {
  return apiRequest(`/issues/${issueId}/comments/${commentId}`, {
    method: "DELETE"
  });
}

/**
 * Protected: Retrieve user operational/management scopes and permissions for dashboards.
 * Matches GET /api/auth/permissions
 */
export async function getPermissions() {
  return apiRequest("/auth/permissions");
}

/**
 * Protected: Export a professional PDF civic report for a specific issue.
 * Matches GET /api/issues/:id/export
 */
export async function exportReportPDF(id) {
  const url = `${BASE_URL}/issues/${id}/export`;
  const headers = {};
  
  if (auth && auth.currentUser) {
    try {
      const token = await auth.currentUser.getIdToken();
      headers["Authorization"] = `Bearer ${token}`;
    } catch (err) {
      console.error("Error getting auth token for PDF export:", err);
    }
  }

  const response = await fetch(url, { headers });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to download PDF report");
  }
  return response.blob();
}

/**
 * Protected: Submit a reopen request for a resolved issue.
 * Matches POST /api/issues/:id/reopen-request
 */
export async function submitReopenRequest(id, reason, photoUrl) {
  return apiRequest(`/issues/${id}/reopen-request`, {
    method: "POST",
    body: JSON.stringify({ reason, photoUrl })
  });
}

/**
 * Protected: Approve a reopen request (Admin only).
 * Matches POST /api/issues/:id/reopen/approve
 */
export async function approveReopenRequest(id) {
  return apiRequest(`/issues/${id}/reopen/approve`, {
    method: "POST"
  });
}

/**
 * Protected: Reject a reopen request (Admin only).
 * Matches POST /api/issues/:id/reopen/reject
 */
export async function rejectReopenRequest(id, rejectReason) {
  return apiRequest(`/issues/${id}/reopen/reject`, {
    method: "POST",
    body: JSON.stringify({ rejectReason })
  });
}

const OperationType = {
  CREATE: "create",
  UPDATE: "update",
  DELETE: "delete",
  LIST: "list",
  GET: "get",
  WRITE: "write"
};

/**
 * Handle Firestore errors according to security rules configuration.
 */
function handleFirestoreError(error, operationType, path) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error("Firestore Error in CommunityPulse: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Safely parse any date value (Firestore Timestamp, string, number, null) into ISO string.
 */
function safeParseDate(val) {
  if (!val) return new Date().toISOString();
  // If it's a Firestore Timestamp or object with toDate()
  if (typeof val.toDate === "function") {
    try {
      return val.toDate().toISOString();
    } catch (e) {
      // fallback
    }
  }
  // Check if it's an object with seconds or _seconds (sometimes returned by Firebase Admin or JSON serialization)
  if (typeof val === "object") {
    const seconds = val.seconds ?? val._seconds;
    if (seconds !== undefined) {
      return new Date(seconds * 1000).toISOString();
    }
  }
  // If it's already a string or number
  if (typeof val === "string" || typeof val === "number") {
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      return d.toISOString();
    }
  }
  // Try direct conversion
  try {
    const fallback = new Date(val);
    if (!isNaN(fallback.getTime())) {
      return fallback.toISOString();
    }
  } catch (e) {
    // ignore
  }
  return new Date().toISOString();
}

/**
 * Subscribe in real-time to the Community Pulse activity stream.
 * Fetches public issues + user-joined community issues.
 * Removed orderBy to prevent index errors. Sorting is done in-memory.
 */
export function subscribeToCommunityPulse(groupIds, callback) {
  console.log("CommunityPulse: Subscribing with group IDs:", groupIds);

  // Query 1: Public issues (visibility == "public")
  // Using limit(100) on a simple where query without orderBy is index-safe
  const publicQuery = query(
    collection(db, "issues"),
    where("visibility", "==", "public"),
    limit(100)
  );

  let groupQuery = null;
  // If user has joined groups, query those issues as well
  const validGroupIds = (groupIds || []).filter(id => id && id !== "awaaz_public");
  if (validGroupIds.length > 0) {
    // Firestore "in" queries are limited to 10 items
    const chunkedIds = validGroupIds.slice(0, 10);
    console.log("CommunityPulse: Querying private groups in chunk:", chunkedIds);
    groupQuery = query(
      collection(db, "issues"),
      where("groupId", "in", chunkedIds),
      limit(100)
    );
  }

  let publicIssues = [];
  let groupIssues = [];

  const emitMerged = () => {
    // Merge both lists, de-duplicating by document id
    const mergedMap = new Map();
    publicIssues.forEach(item => mergedMap.set(item.id, item));
    groupIssues.forEach(item => mergedMap.set(item.id, item));

    const mergedList = Array.from(mergedMap.values());
    
    // Sort in-memory by updatedAt desc (fallback to createdAt desc)
    mergedList.sort((a, b) => {
      const timeA = new Date(a.updatedAt || a.createdAt).getTime();
      const timeB = new Date(b.updatedAt || b.createdAt).getTime();
      return timeB - timeA;
    });

    console.log(`CommunityPulse: Emitting merged ${mergedList.length} unique issues.`);
    callback(mergedList);
  };

  // Setup public issues subscription
  const unsubscribePublic = onSnapshot(
    publicQuery,
    (snapshot) => {
      console.log(`CommunityPulse: Public snapshot fired. Documents found: ${snapshot.size}`);
      publicIssues = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        const createdAt = safeParseDate(data.createdAt);
        const updatedAt = safeParseDate(data.updatedAt || data.createdAt);
        publicIssues.push({
          id: doc.id,
          ...data,
          createdAt,
          updatedAt
        });
      });
      emitMerged();
    },
    (error) => {
      console.error("CommunityPulse: Public query failed with error:", error);
      handleFirestoreError(error, OperationType.GET, "issues");
    }
  );

  // Setup group issues subscription if applicable
  let unsubscribeGroup = () => {};
  if (groupQuery) {
    unsubscribeGroup = onSnapshot(
      groupQuery,
      (snapshot) => {
        console.log(`CommunityPulse: Group snapshot fired. Documents found: ${snapshot.size}`);
        groupIssues = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          const createdAt = safeParseDate(data.createdAt);
          const updatedAt = safeParseDate(data.updatedAt || data.createdAt);
          groupIssues.push({
            id: doc.id,
            ...data,
            createdAt,
            updatedAt
          });
        });
        emitMerged();
      },
      (error) => {
        console.error("CommunityPulse: Group query failed with error:", error);
        handleFirestoreError(error, OperationType.GET, "issues");
      }
    );
  }

  // Return function to cleanly unsubscribe from both listeners
  return () => {
    console.log("CommunityPulse: Cleaning up real-time subscriptions");
    unsubscribePublic();
    unsubscribeGroup();
  };
}



