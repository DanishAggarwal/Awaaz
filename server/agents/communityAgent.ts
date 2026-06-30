import { Type } from "@google/genai";
import { db } from "../firebase-admin";
import { generateWithFallback } from "../services/geminiService";

export interface CommunityAnalysisResult {
  brief: string;
  reportSummary: string;
  keyInsights: string[];
  possibleFactors: string[];
  recommendedNextStep: string;
  urgencyNote: string;
  communityMood: "neutral" | "concerned" | "frustrated" | "urgent";
  escalate: boolean;
  confidence: number;
  generatedAt: string;
  sourceCommentCount: number;
  sourceEndorsementCount: number;
  sourceDuplicateCount: number;
  sourceReopenCount: number;
}


/**
 * Determines whether the cached analysis is still valid or needs regeneration.
 */
export function isCacheValid(issueData: any, commentCount: number): boolean {
  const analysis = issueData.communityAnalysis;
  if (!analysis) {
    return false;
  }

  // Check if comment count changed
  if (commentCount !== (analysis.sourceCommentCount ?? 0)) {
    return false;
  }

  // Check if endorsement count changed significantly (threshold of 5 or more)
  const currentEndorsements = issueData.endorsementCount || 0;
  const cachedEndorsements = analysis.sourceEndorsementCount ?? currentEndorsements;
  if (Math.abs(currentEndorsements - cachedEndorsements) >= 5) {
    return false;
  }

  // Check if duplicate report count changed
  const currentDuplicates = issueData.duplicateReports ?? issueData.dna?.duplicateReports ?? issueData.duplicateCount ?? 0;
  const cachedDuplicates = analysis.sourceDuplicateCount ?? currentDuplicates;
  if (currentDuplicates !== cachedDuplicates) {
    return false;
  }

  // Check if reopen count changed
  const currentReopens = issueData.reopenCount ?? issueData.dna?.reopenCount ?? 0;
  const cachedReopens = analysis.sourceReopenCount ?? currentReopens;
  if (currentReopens !== cachedReopens) {
    return false;
  }

  return true;
}

/**
 * Analyzes the available community context for an issue and generates or retrieves a cached briefing.
 * 
 * @param issueId The target issue ID.
 * @param forceRegenerate Optional flag to force analysis regeneration.
 */
export async function analyzeCommunityContext(
  issueId: string,
  forceRegenerate = false
): Promise<CommunityAnalysisResult> {
  const issueRef = db.collection("issues").doc(issueId);
  const issueDoc = await issueRef.get();

  if (!issueDoc.exists) {
    throw new Error(`Issue with ID ${issueId} not found.`);
  }

  const issueData = issueDoc.data() || {};

  // Fetch comments subcollection
  const commentsSnapshot = await issueRef.collection("comments").orderBy("createdAt", "asc").get();
  const comments: any[] = [];
  commentsSnapshot.forEach((doc) => {
    comments.push(doc.data());
  });

  const commentCount = comments.length;
  const currentEndorsementCount = issueData.endorsementCount || 0;
  const currentDuplicateCount = issueData.duplicateReports ?? issueData.dna?.duplicateReports ?? issueData.duplicateCount ?? 0;
  const currentReopenCount = issueData.reopenCount ?? issueData.dna?.reopenCount ?? 0;

  // Check cache unless forced to regenerate
  if (!forceRegenerate && isCacheValid(issueData, commentCount)) {
    console.log(`[communityAgent] Returning cached Community Analysis for issue ${issueId}`);
    return issueData.communityAnalysis;
  }

  console.log(`[communityAgent] Generating new Community Analysis for issue ${issueId}`);

  // Format comments into a clean reading view for the AI
  const commentsListFormatted = comments.length > 0
    ? comments.map((c, idx) => `[Comment #${idx + 1}] Author: ${c.displayName || "Citizen"} | Text: "${c.text}"`).join("\n")
    : "No comments posted yet on this report.";

  const prompt = `Analyze the following civic issue data and citizen discussion:

[Civic Issue Metadata]
- Title: ${issueData.title || "N/A"}
- Summary: ${issueData.summary || "N/A"}
- Category: ${issueData.category || "N/A"}
- Severity: ${issueData.severity || "N/A"}
- Status: ${issueData.status || "N/A"}
- Priority Score: ${issueData.priorityScore || "N/A"}
- Endorsement Count: ${currentEndorsementCount}
- Duplicate Reports Count: ${currentDuplicateCount}
- Reopen Count: ${currentReopenCount}
- Original Citizen Description: "${issueData.description || "N/A"}"

[Citizen Discussion / Comments]
${commentsListFormatted}

Analyze this context and output the JSON response matching the requested schema.`;

  const systemInstruction = `You are the Awaaz Community Agent, a highly sophisticated civic accountability assistant for India.
Your task is to analyze all available information about a specific civic issue and generate an objective, concise executive briefing and advisory analysis.

You must strictly adhere to the following guidelines:
1. Reason conservatively. Only utilize information supported by the comments, endorsements, issue metadata, and AI intake analysis.
2. Ignore greetings, emojis, spam, duplicate comments, memes, and low-information replies.
3. Weight recent community activity slightly more than older discussion while still considering the complete issue history.
4. Never invent facts. If evidence is insufficient, explicitly state so.
5. Avoid speculation. Do NOT present infrastructure diagnoses as absolute facts; instead, frame them as possible contributing factors. For example, instead of saying "The drainage system is defective," say "Possible contributing factor: poor drainage."
6. All recommendations must be operational and advisory only.

Ensure you generate a valid JSON output adhering strictly to the provided JSON schema.`;

  try {
    const response = await generateWithFallback("community", {
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            brief: {
              type: Type.STRING,
              description: "An executive briefing of approximately 80-120 words summarizing community perspective, observations, and feedback loops."
            },
            reportSummary: {
              type: Type.STRING,
              description: "A concise, objective summary of approximately 60-100 words suitable for inclusion in an official municipal or departmental civic report."
            },
            keyInsights: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Maximum five concise bullet points describing recurring community observations or concerns."
            },
            possibleFactors: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Possible contributing factors inferred from community observations. Do not present speculation as certainty. Frame them as possible contributing factors (e.g., 'Possible contributing factor: poor drainage')."
            },
            recommendedNextStep: {
              type: Type.STRING,
              description: "One short operational recommendation. It must be advisory only (e.g., 'Consider inspecting drainage before resurfacing', 'Verify reported damage on-site')."
            },
            urgencyNote: {
              type: Type.STRING,
              description: "One concise operational observation or urgent alert from comments (e.g., 'Three residents reported vehicle damage within the last week')."
            },
            communityMood: {
              type: Type.STRING,
              enum: ["neutral", "concerned", "frustrated", "urgent"],
              description: "Overall emotional mood of the community."
            },
            escalate: {
              type: Type.BOOLEAN,
              description: "Boolean indicating whether the agent believes the issue deserves additional administrative attention based on severity, mood, and repetitive concerns."
            },
            confidence: {
              type: Type.NUMBER,
              description: "Floating-point confidence score between 0.0 and 1.0 representing the model's confidence in the generated briefing."
            }
          },
          required: [
            "brief",
            "reportSummary",
            "keyInsights",
            "possibleFactors",
            "recommendedNextStep",
            "urgencyNote",
            "communityMood",
            "escalate",
            "confidence"
          ]
        }
      }
    });

    const parsedResponse = JSON.parse(response.text.trim());

    // Construct full CommunityAnalysisResult with caching metadata
    const result: CommunityAnalysisResult = {
      ...parsedResponse,
      generatedAt: new Date().toISOString(),
      sourceCommentCount: commentCount,
      sourceEndorsementCount: currentEndorsementCount,
      sourceDuplicateCount: currentDuplicateCount,
      sourceReopenCount: currentReopenCount
    };

    // Store in Firestore inside the issue document
    await issueRef.update({
      communityAnalysis: result
    });

    return result;
  } catch (error: any) {
    console.error(`[communityAgent] Error generating analysis for issue ${issueId}:`, error);
    throw new Error(`Failed to generate community analysis: ${error.message}`);
  }
}
