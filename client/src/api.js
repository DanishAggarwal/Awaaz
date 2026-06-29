/**
 * API client for Awaaz.
 * All frontend API calls live here only.
 */
import { auth } from "./firebase";

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
export async function updateIssueStatus(id, status) {
  return apiRequest(`/issues/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status })
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


