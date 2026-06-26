/**
 * API client for Awaaz.
 * All frontend API calls live here only.
 */

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
