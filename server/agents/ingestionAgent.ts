import { Type } from "@google/genai";
import { CIVIC_INTAKE_PROMPT } from "../prompts/civicIntakePrompt";
import { generateWithFallback } from "../services/geminiService";

export interface CivicIntakeInput {
  imageUrl?: string;
  description: string;
}

export interface CivicIntakeResult {
  validIssue: boolean;
  confidence: number;
  category: "pothole" | "garbage" | "waterlogging" | "drainage" | "sewage" | "streetlight" | "electricity" | "roads" | "traffic" | "public_property" | "trees" | "encroachment" | "other" | null;
  severity: "low" | "medium" | "high" | "critical" | null;
  title: string | null;
  summary: string | null;
  visualEvidence: string[];
  recommendedDepartment: string | null;
  rejectionReason: string | null;
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
    console.error("Error downloading image for Gemini intake:", error.message);
    throw new Error(`Failed to process issue image: ${error.message}`);
  }
}

/**
 * Analyzes a civic issue submission using Gemini 2.5/3.5 vision capabilities.
 * Determines if it is a valid public civic issue, classifies it, maps severity,
 * generates a concise title and summary, and highlights visual evidence.
 * 
 * @param input The image URL and description of the reported issue.
 * @returns A structured analysis adhering to the CivicIntakeResult schema.
 */
export async function analyzeCivicIssue(input: CivicIntakeInput): Promise<CivicIntakeResult> {
  const { imageUrl, description } = input;
  
  if (!description || !description.trim()) {
    throw new Error("A description is required for civic issue ingestion analysis.");
  }

  const parts: any[] = [];

  // Download and attach image if present
  if (imageUrl && imageUrl.trim()) {
    const image = await downloadImageAsBase64(imageUrl);
    parts.push({
      inlineData: {
        mimeType: image.mimeType,
        data: image.data,
      },
    });
  }

  // Attach the textual input context
  parts.push({
    text: `User Description: "${description}"`,
  });

  try {
    const response = await generateWithFallback("ingestion", {
      contents: { parts },
      config: {
        systemInstruction: CIVIC_INTAKE_PROMPT,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            validIssue: {
              type: Type.BOOLEAN,
              description: "Whether this submission represents a legitimate, public civic issue.",
            },
            confidence: {
              type: Type.NUMBER,
              description: "Confidence score between 0.0 and 1.0 reflecting the civic nature of the issue.",
            },
            category: {
              type: Type.STRING,
              description: "Allowed categories: pothole, garbage, waterlogging, drainage, sewage, streetlight, electricity, roads, traffic, public_property, trees, encroachment, other. MUST be null if validIssue is false.",
            },
            severity: {
              type: Type.STRING,
              description: "Allowed severities: low, medium, high, critical. MUST be null if validIssue is false.",
            },
            title: {
              type: Type.STRING,
              description: "Objective descriptive title, under 10 words. MUST be null if validIssue is false.",
            },
            summary: {
              type: Type.STRING,
              description: "Factual concise public summary, maximum 50 words. MUST be null if validIssue is false.",
            },
            visualEvidence: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "List of concrete visual observations from the image.",
            },
            recommendedDepartment: {
              type: Type.STRING,
              description: "Deterministic mapped department based on category. MUST be null if validIssue is false.",
            },
            rejectionReason: {
              type: Type.STRING,
              description: "Explanation of why the issue is rejected as invalid. MUST be null if validIssue is true.",
            },
          },
          required: [
            "validIssue",
            "confidence",
            "category",
            "severity",
            "title",
            "summary",
            "visualEvidence",
            "recommendedDepartment",
            "rejectionReason",
          ],
        },
      },
    });

    const textResult = response.text;
    if (!textResult) {
      throw new Error("Gemini returned an empty response.");
    }

    const parsedResult = JSON.parse(textResult.trim()) as CivicIntakeResult;

    // --- PROGRAMMATIC CONTRACT ENFORCEMENT & NORMALIZATION LAYER ---
    if (parsedResult.validIssue === false) {
      parsedResult.category = null;
      parsedResult.severity = null;
      parsedResult.title = null;
      parsedResult.summary = null;
      parsedResult.recommendedDepartment = null;
    } else {
      parsedResult.rejectionReason = null;
    }

    return parsedResult;
  } catch (error: any) {
    console.error("Gemini Civic Intake Ingestion Agent failed:", error);
    throw new Error(`Civic Analysis Core failed: ${error.message}`);
  }
}
