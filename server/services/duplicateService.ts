import { distanceBetweenPoints } from "../utils/haversine";
import { DUPLICATE_RADIUS_METERS } from "../config/constants";

interface IssueLocation {
  latitude: number | null;
  longitude: number | null;
  address?: string;
}

interface DuplicateCandidateInput {
  db: any;
  latitude: number;
  longitude: number;
  category: string;
  groupId: string | null | undefined;
}

interface DuplicateResult {
  id: string;
  title: string;
  distance: number;
  endorsementCount: number;
  status: string;
  summary?: string;
  category?: string;
  priorityScore?: number;
}

/**
 * findDuplicateIssue
 * Searches Firestore for an active issue of the same category, in the same visibility scope,
 * within the DUPLICATE_RADIUS_METERS (300m) radius.
 * Returns the closest duplicate candidate if found, or null otherwise.
 */
export async function findDuplicateIssue(
  input: DuplicateCandidateInput
): Promise<DuplicateResult | null> {
  const { db, latitude, longitude, category, groupId } = input;

  if (!category || typeof latitude !== "number" || typeof longitude !== "number") {
    return null;
  }

  const normGroupId = (groupId && groupId.trim() !== "") ? groupId.trim() : null;

  try {
    // 1. Query Firestore issues filtering by category (Single-field index is always active)
    let query = db.collection("issues").where("category", "==", category);

    // If groupId is provided, we can further filter at DB layer to minimize reads
    if (normGroupId) {
      query = query.where("groupId", "==", normGroupId);
    }

    const snapshot = await query.get();
    if (snapshot.empty) {
      return null;
    }

    const activeStatuses = ["reported", "verified", "in_progress"];
    let closestCandidate: DuplicateResult | null = null;
    let minDistance = Infinity;

    // 2. Perform in-memory filtering for visibility scope, active status, and Haversine distance
    snapshot.forEach((doc: any) => {
      const data = doc.data();
      const issueStatus = data.status || "";
      
      // Ensure the issue status is active
      if (!activeStatuses.includes(issueStatus)) {
        return;
      }

      // Same visibility scope check:
      // If we queried with groupId, it is already filtered. If not, make sure candidate has no groupId
      if (!normGroupId) {
        if (data.groupId && data.groupId.trim() !== "") {
          return; // Skip since candidate belongs to a community but submission is public
        }
      }

      const loc: IssueLocation = data.location || {};
      if (typeof loc.latitude !== "number" || typeof loc.longitude !== "number") {
        return;
      }

      // Calculate distance using the Haversine formula
      const dist = distanceBetweenPoints(latitude, longitude, loc.latitude, loc.longitude);

      // Check if within 300 meters
      if (dist <= DUPLICATE_RADIUS_METERS) {
        if (dist < minDistance) {
          minDistance = dist;
          closestCandidate = {
            id: data.id || doc.id,
            title: data.title || data.description || "Untitled Issue",
            distance: Math.round(dist),
            endorsementCount: data.endorsementCount || 0,
            status: issueStatus,
            summary: data.summary || "",
            category: data.category || "",
            priorityScore: data.priorityScore || 0
          };
        }
      }
    });

    return closestCandidate;
  } catch (error) {
    console.error("Failed to perform duplicate detection:", error);
    throw error;
  }
}
