/**
 * Awaaz - Production Priority Engine
 * Calculates a completely deterministic priority score for reported issues.
 * Derives the score purely from the current issue state, ensuring no randomness
 * or incremental recalculation drift.
 */

/**
 * Calculates the score contributed by the intrinsic civic severity of the issue.
 * Critical is 85, High is 65, Medium is 40, Low is 20.
 * If severity is missing or invalid, throws an explicit error.
 */
export function severityScore(severity: string | null | undefined): number {
  if (!severity) {
    throw new Error("Severity is missing or invalid. Severity is required for priority calculation.");
  }

  const lowercaseSeverity = severity.toLowerCase();
  switch (lowercaseSeverity) {
    case "critical":
      return 85;
    case "high":
      return 65;
    case "medium":
      return 40;
    case "low":
      return 20;
    default:
      throw new Error(`Unknown severity value received: ${severity}`);
  }
}

/**
 * Calculates the community endorsement score using a logarithmic decay function.
 * This rewards early community confirmation without letting popularity overwhelm civic severity.
 * Formula: Math.min(Math.log2(count + 1) * 10, 20)
 */
export function endorsementScore(count: number | null | undefined): number {
  const c = count || 0;
  if (c < 0) {
    return 0;
  }
  return Math.min(Math.log2(c + 1) * 10, 20);
}

/**
 * Calculates a reopen bonus for recurring/persistent civic failures.
 * Formula: Math.min(reopenCount * 5, 10)
 */
export function reopenBonus(reopenCount: number | null | undefined): number {
  const r = reopenCount || 0;
  if (r < 0) {
    return 0;
  }
  return Math.min(r * 5, 10);
}

/**
 * Calculates freshness decay (deduction of up to 3 points for old unresolved issues).
 * 0 - 30 days: 0 deduction
 * 31 - 90 days: 1 point deduction
 * 91 - 180 days: 2 points deduction
 * 181+ days: 3 points deduction
 */
export function freshnessDecay(createdAt: any): number {
  if (!createdAt) {
    return 0;
  }

  let date: Date;

  if (typeof createdAt.toDate === "function") {
    date = createdAt.toDate();
  } else if (typeof createdAt === "string") {
    date = new Date(createdAt);
  } else if (createdAt instanceof Date) {
    date = createdAt;
  } else if (typeof createdAt.seconds === "number") {
    date = new Date(createdAt.seconds * 1000);
  } else if (typeof createdAt._seconds === "number") {
    date = new Date(createdAt._seconds * 1000);
  } else {
    // If we receive a placeholder or special FieldValue, default to no decay
    return 0;
  }

  // Ensure valid date parsed
  if (isNaN(date.getTime())) {
    return 0;
  }

  const now = new Date();
  const diffTime = Math.max(0, now.getTime() - date.getTime());
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays <= 30) {
    return 0;
  } else if (diffDays <= 90) {
    return 1;
  } else if (diffDays <= 180) {
    return 2;
  } else {
    return 3;
  }
}

/**
 * Generates a complete priority breakdown object showing contribution of each helper.
 * Useful for debugging, system logging, and future analytics.
 */
export function calculatePriorityBreakdown(issue: {
  severity?: string | null;
  endorsementCount?: number;
  reopenCount?: number;
  createdAt?: any;
  dna?: {
    reopenCount?: number;
    createdAt?: any;
    [key: string]: any;
  };
  [key: string]: any;
}): {
  severity: number;
  endorsements: number;
  reopen: number;
  freshness: number;
  final: number;
} {
  const sev = issue.severity;
  const count = issue.endorsementCount || 0;
  
  // Support reopens at either root or nested dna object
  const reopens = issue.dna?.reopenCount ?? issue.reopenCount ?? 0;
  
  // Support createdAt at either root or nested dna object
  const created = issue.createdAt ?? issue.dna?.createdAt;

  const sevScore = severityScore(sev);
  const endScore = endorsementScore(count);
  const rBonus = reopenBonus(reopens);
  const fDecay = freshnessDecay(created);

  const calculated = sevScore + endScore + rBonus - fDecay;
  const finalScore = Math.min(100, Math.max(0, Math.round(calculated)));

  return {
    severity: sevScore,
    endorsements: Math.round(endScore * 10) / 10,
    reopen: rBonus,
    freshness: -fDecay, // represented as a negative deduction
    final: finalScore,
  };
}

/**
 * Calculates a priority score between 0 and 100 from current issue state.
 * Reserved parameter `extras` supports future agents (Community, Ingestion, Truth Engine).
 */
export function calculatePriorityScore(
  issue: {
    severity?: string | null;
    endorsementCount?: number;
    reopenCount?: number;
    createdAt?: any;
    dna?: {
      reopenCount?: number;
      createdAt?: any;
      [key: string]: any;
    };
    [key: string]: any;
  },
  extras?: {
    aiConfidence?: number;
    communityUrgency?: number;
    truthEngineFlag?: boolean;
    escalationBoost?: number;
  }
): number {
  const breakdown = calculatePriorityBreakdown(issue);
  return breakdown.final;
}
