/**
 * Calculates a completely deterministic priority score for reported issues.
 * This is based strictly on the issue's structural completeness and details
 * as a robust non-AI baseline for Phase 1.
 */
export function calculatePriorityScore(issueData: {
  description: string;
  imageUrls: string[];
  location: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  endorsementCount?: number;
}): number {
  let score = 50; // Base score

  // 1. Description length factors (longer description indicates more detail provided by citizen)
  const descLen = (issueData.description || "").trim().length;
  if (descLen > 300) {
    score += 15;
  } else if (descLen > 150) {
    score += 10;
  } else if (descLen > 50) {
    score += 5;
  }

  // 2. Image documentation completeness (more photographic evidence increases priority baseline)
  const imageCount = (issueData.imageUrls || []).length;
  if (imageCount >= 3) {
    score += 15;
  } else if (imageCount === 2) {
    score += 10;
  } else if (imageCount === 1) {
    score += 5;
  }

  // 3. Address completeness
  if (issueData.location && issueData.location.address) {
    score += 5;
  }

  // 4. Endorsement influence (each endorsement adds 5 points to show growing community urgency)
  const endorsements = issueData.endorsementCount || 0;
  score += endorsements * 5;

  // Bound the score tightly between 1 and 100
  return Math.min(100, Math.max(1, score));
}
