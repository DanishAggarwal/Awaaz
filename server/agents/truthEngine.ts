import { Type } from "@google/genai";
import { db } from "../firebase-admin";
import { generateWithFallback } from "../services/geminiService";
import crypto from "crypto";

export interface TruthAnalysisResult {
  verificationSummary: string;
  confidence: number;
  verificationStatus: "Verified" | "Likely Verified" | "Needs Review" | "Insufficient Evidence";
  visualAssessment: string;
  remainingConcerns: string[];
  recommendation: string;
  generatedAt: string;
  sourceCommentCount: number;
  sourceResolutionNoteHash: string;
  sourceResolutionImageHash: string;
  sourceReopenCount: number;
}

/**
 * Downloads a public image URL and converts it to a base64 encoded string.
 */
async function downloadImageAsBase64(url: string): Promise<{ mimeType: string; data: string }> {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch image from URL: ${res.statusText}`);
    }
    const contentType = res.headers.get("content-type") || "image/jpeg";
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString("base64");
    return {
      mimeType: contentType,
      data: base64,
    };
  } catch (error: any) {
    console.error("Error downloading image for Truth Engine:", error.message);
    throw new Error(`Failed to process image: ${error.message}`);
  }
}

function getMD5(str: string): string {
  return crypto.createHash("md5").update(str).digest("hex");
}

/**
 * Validates whether the cached truth verification report is still valid.
 */
export function isTruthCacheValid(issueData: any, commentCount: number): boolean {
  const analysis = issueData.truthAnalysis;
  if (!analysis) {
    return false;
  }

  // Check if reopen count changed
  const currentReopenCount = issueData.reopenCount ?? issueData.dna?.reopenCount ?? 0;
  const cachedReopenCount = analysis.sourceReopenCount ?? 0;
  if (currentReopenCount !== cachedReopenCount) {
    return false;
  }

  // Check if comment count changed
  const cachedCommentCount = analysis.sourceCommentCount ?? 0;
  if (commentCount !== cachedCommentCount) {
    return false;
  }

  // Check if resolution details changed
  const currentResolutionNote = issueData.resolution?.resolutionNote || "";
  const currentResolutionImage = issueData.resolution?.afterImageUrl || "";

  const currentNoteHash = getMD5(currentResolutionNote);
  const currentImageHash = getMD5(currentResolutionImage);

  if (currentNoteHash !== (analysis.sourceResolutionNoteHash ?? "")) {
    return false;
  }

  if (currentImageHash !== (analysis.sourceResolutionImageHash ?? "")) {
    return false;
  }

  return true;
}

/**
 * Audits a resolved/reopened civic issue and generates a cached verification report.
 * 
 * @param issueId The target issue ID.
 * @param forceRegenerate Force regeneration regardless of cache state.
 */
export async function analyzeTruthVerification(
  issueId: string,
  forceRegenerate = false
): Promise<TruthAnalysisResult | null> {
  const issueRef = db.collection("issues").doc(issueId);
  const issueDoc = await issueRef.get();

  if (!issueDoc.exists) {
    throw new Error(`Issue with ID ${issueId} not found.`);
  }

  const issueData = issueDoc.data() || {};

  // If issue is not in a state with a resolution, we can return null (or if they want cached from before)
  if (issueData.status !== "resolved" && issueData.status !== "reopened") {
    // If we have an existing truthAnalysis but it's not resolved/reopened, return it but don't regenerate
    if (issueData.truthAnalysis) {
      return issueData.truthAnalysis;
    }
    return null;
  }

  // Fetch comments subcollection
  const commentsSnapshot = await issueRef.collection("comments").orderBy("createdAt", "asc").get();
  const comments: any[] = [];
  commentsSnapshot.forEach((doc) => {
    comments.push(doc.data());
  });

  const commentCount = comments.length;

  // Check cache validity unless forced
  if (!forceRegenerate && isTruthCacheValid(issueData, commentCount)) {
    console.log(`[truthEngine] Returning cached Truth Analysis for issue ${issueId}`);
    return issueData.truthAnalysis;
  }

  console.log(`[truthEngine] Generating fresh Truth Analysis for issue ${issueId}`);

  // Gather comments, history, images
  const commentsFormatted = comments.length > 0
    ? comments.map((c, idx) => `[Comment #${idx + 1}] User: ${c.displayName || "Citizen"} | Text: "${c.text}"`).join("\n")
    : "No citizen comments posted yet.";

  // Fetch status history
  const historySnapshot = await issueRef.collection("status_history").orderBy("timestamp", "asc").get();
  const history: any[] = [];
  historySnapshot.forEach((doc) => {
    const data = doc.data();
    history.push({
      fromStatus: data.fromStatus,
      toStatus: data.toStatus,
      changedBy: data.changedBy,
      note: data.note,
      timestamp: data.timestamp && typeof data.timestamp.toDate === "function" ? data.timestamp.toDate().toISOString() : data.timestamp
    });
  });

  const historyFormatted = history.length > 0
    ? history.map((h, idx) => `[History #${idx + 1}] From: ${h.fromStatus} | To: ${h.toStatus} | Changed By: ${h.changedBy} | Note: "${h.note}"`).join("\n")
    : "No status history recorded.";

  const parts: any[] = [];

  // Download and attach original image
  const originalImageUrl = issueData.imageUrls && issueData.imageUrls.length > 0 ? issueData.imageUrls[0] : null;
  if (originalImageUrl) {
    try {
      const img = await downloadImageAsBase64(originalImageUrl);
      parts.push({
        inlineData: {
          mimeType: img.mimeType,
          data: img.data,
        },
      });
      parts.push({ text: "IMAGE 1: The original civic issue image reported by the citizen (Before repair)." });
    } catch (e: any) {
      console.warn(`[truthEngine] Failed to download original image for issue ${issueId}:`, e.message);
    }
  }

  // Download and attach resolution image
  const resolutionImageUrl = issueData.resolution?.afterImageUrl;
  if (resolutionImageUrl) {
    try {
      const img = await downloadImageAsBase64(resolutionImageUrl);
      parts.push({
        inlineData: {
          mimeType: img.mimeType,
          data: img.data,
        },
      });
      parts.push({ text: "IMAGE 2: The resolution/repair evidence image submitted by the administrator (After repair)." });
    } catch (e: any) {
      console.warn(`[truthEngine] Failed to download resolution image for issue ${issueId}:`, e.message);
    }
  }

  const promptText = `Evaluate the submitted resolution evidence for the following civic issue:

[ORIGINAL ISSUE DATA]
- Title: ${issueData.title || "N/A"}
- Category: ${issueData.category || "N/A"}
- Severity: ${issueData.severity || "N/A"}
- Priority Score: ${issueData.priorityScore || "N/A"}
- Description: "${issueData.description || "N/A"}"
- Visual Evidence (Initial Intake): ${JSON.stringify(issueData.visualEvidence || [])}

[COMMUNITY INPUTS]
- Community Analysis Brief: "${issueData.communityAnalysis?.brief || "N/A"}"
- Citizen Comments:
${commentsFormatted}

[RESOLUTION DETAILS]
- Resolution Note: "${issueData.resolution?.resolutionNote || "N/A"}"
- Internal Note: "${issueData.resolution?.internalNote || "N/A"}"
- Resolved By: ${issueData.resolution?.resolvedBy || "N/A"}
- Resolved At: ${issueData.resolution?.resolvedAt || "N/A"}

[ISSUE HISTORY & REOPENS]
- Reopen Count: ${issueData.reopenCount ?? issueData.dna?.reopenCount ?? 0}
- Status History:
${historyFormatted}

Evaluate the evidence objectively. Refer to the image(s) provided above:
1. The first image (if uploaded) shows the original reported problem (Before).
2. The second image (if uploaded) shows the claimed resolution/repair (After).

Assess whether the resolution evidence appears consistent and sufficient. Provide an honest, evidence-based, conservative verification report in strict JSON format. Do not speculate or make up findings.`;

  parts.push({ text: promptText });

  const systemInstruction = `You are the Awaaz Truth Engine, an independent, read-only AI auditor for civic issues in India.
Your sole purpose is to evaluate whether the submitted resolution evidence (such as after-photos and notes) appears consistent and sufficient to support the claimed repair.

You must strictly adhere to the following rules:
1. NEVER change issue status, reject/approve resolutions, or make administrative actions. You are a read-only assessor.
2. Compare the before-image and after-image. Identify obvious consistency or inconsistencies.
3. Read and evaluate the administrator's resolution note, comparing it to the citizen's original report and description.
4. Consider citizen feedback or comments. If citizens report that the problem remains unresolved or has reoccurred, take that into heavy consideration.
5. Identify remaining concerns, visual discrepancies, lighting issues, standing water, or any factor that reduces confidence.
6. Reason conservatively and objectively. If evidence is insufficient, say so. If images cannot be compared, say so. Do NOT speculate or hallucinate.
7. Only return the requested JSON format. The "verificationStatus" field must be exactly one of: "Verified", "Likely Verified", "Needs Review", "Insufficient Evidence". No custom statuses.`;

  try {
    const response = await generateWithFallback("truth", {
      contents: { parts },
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            verificationSummary: {
              type: Type.STRING,
              description: "Factual executive summary of approximately 80-120 words detailing whether the evidence supports the repair. Avoid jargon, match professional tone."
            },
            confidence: {
              type: Type.NUMBER,
              description: "Confidence score between 0.0 and 1.0 representing confidence in this verification report."
            },
            verificationStatus: {
              type: Type.STRING,
              enum: ["Verified", "Likely Verified", "Needs Review", "Insufficient Evidence"],
              description: "Strict allowed values only."
            },
            visualAssessment: {
              type: Type.STRING,
              description: "Describe visible observations from before/after images. Never assume hidden conditions. Max 50 words."
            },
            remainingConcerns: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Factual observations or concerns. Empty array if none."
            },
            recommendation: {
              type: Type.STRING,
              description: "Operational recommendation (e.g., 'No further action recommended.', 'Schedule follow-up inspection.', 'Monitor citizen feedback.', 'Field inspection recommended.')."
            },
            generatedAt: {
              type: Type.STRING,
              description: "ISO date-time string of generation."
            }
          },
          required: [
            "verificationSummary",
            "confidence",
            "verificationStatus",
            "visualAssessment",
            "remainingConcerns",
            "recommendation",
            "generatedAt"
          ]
        }
      }
    });

    const parsedResponse = JSON.parse(response.text.trim());

    const result: TruthAnalysisResult = {
      ...parsedResponse,
      generatedAt: new Date().toISOString(),
      sourceCommentCount: commentCount,
      sourceResolutionNoteHash: getMD5(issueData.resolution?.resolutionNote || ""),
      sourceResolutionImageHash: getMD5(issueData.resolution?.afterImageUrl || ""),
      sourceReopenCount: issueData.reopenCount ?? issueData.dna?.reopenCount ?? 0
    };

    // Store in Firestore inside the issue document
    await issueRef.update({
      truthAnalysis: result,
      truthAnalysisStatus: "completed"
    });

    return result;
  } catch (error: any) {
    console.error(`[truthEngine] Error generating truth verification for issue ${issueId}:`, error);
    throw new Error(`Failed to generate truth verification: ${error.message}`);
  }
}
