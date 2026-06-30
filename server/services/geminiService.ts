import { GoogleGenAI } from "@google/genai";

// Standard Custom Error for Gemini Service Outage
export class AIServiceUnavailableError extends Error {
  constructor(message: string, public readonly originalErrors: any[]) {
    super(message);
    this.name = "AIServiceUnavailableError";
  }
}

export interface GeminiServiceResponse {
  text: string;
  metadata: {
    model: string;
    fallbackLevel: number;
    retries: number;
  };
}

// Lazy initialization of the GoogleGenAI client to prevent crash on startup if key is missing.
let aiClient: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required to initialize the Gemini Service.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// --------------------------------------------------
// CENTRALIZED MODEL CHAINS CONFIGURATION
// --------------------------------------------------
const INGESTION_CHAIN = [
  process.env.INGESTION_MODEL_PRIMARY || "gemini-3.5-flash",
  process.env.INGESTION_MODEL_SECONDARY || "gemini-2.5-flash",
  process.env.INGESTION_MODEL_TERTIARY || "gemini-3.1-flash-lite"
];

const COMMUNITY_CHAIN = [
  process.env.COMMUNITY_MODEL_PRIMARY || "gemini-2.5-flash",
  process.env.COMMUNITY_MODEL_SECONDARY || "gemini-3.1-flash-lite"
];

const TRUTH_CHAIN = [
  process.env.TRUTH_MODEL_PRIMARY || "gemini-3.5-flash",
  process.env.TRUTH_MODEL_SECONDARY || "gemini-2.5-flash",
  process.env.TRUTH_MODEL_TERTIARY || "gemini-3.1-flash-lite"
];

const sanitizeChain = (chain: string[]) => {
  return Array.from(new Set(chain.filter((m) => typeof m === "string" && m.trim() !== "")));
};

export const MODEL_CHAINS = {
  ingestion: sanitizeChain(INGESTION_CHAIN),
  community: sanitizeChain(COMMUNITY_CHAIN),
  truth: sanitizeChain(TRUTH_CHAIN)
};

// --------------------------------------------------
// INFRASTRUCTURE & FAILURE CLASSIFIER UTILITIES
// --------------------------------------------------

/**
 * Checks if an error is a rate-limit/quota-exceeded (HTTP 429) failure.
 */
function isQuotaFailure(error: any): boolean {
  if (!error) return false;
  const msg = String(error.message || "").toUpperCase();
  const status = error.status || error.statusCode || error.code;

  if (status === 429 || status === "429") return true;
  if (
    msg.includes("429") ||
    msg.includes("RESOURCE_EXHAUSTED") ||
    msg.includes("RATE_LIMIT") ||
    msg.includes("QUOTA") ||
    msg.includes("LIMIT_EXCEEDED") ||
    msg.includes("LIMIT EXCEEDED")
  ) {
    return true;
  }
  return false;
}

/**
 * Checks if an error is a transient/temporary network or service infrastructure failure.
 */
function isInfrastructureFailure(error: any): boolean {
  if (!error) return false;
  const msg = String(error.message || "").toUpperCase();
  const status = error.status || error.statusCode || error.code;

  // If it is explicitly a quota failure, it's an infrastructure failure
  if (isQuotaFailure(error)) return true;

  // HTTP 5xx status codes
  if (typeof status === "number" && status >= 500 && status < 600) return true;
  if (typeof status === "string" && status.startsWith("5")) return true;

  // Keywords indicating Google API outage, service unavailability or temporary socket errors
  if (
    msg.includes("UNAVAILABLE") ||
    msg.includes("TIMEOUT") ||
    msg.includes("TEMP") ||
    msg.includes("OVERLOADED") ||
    msg.includes("INTERNAL ERROR") ||
    msg.includes("500") ||
    msg.includes("502") ||
    msg.includes("503") ||
    msg.includes("504") ||
    msg.includes("SOCKET") ||
    msg.includes("ECONNRESET") ||
    msg.includes("FETCH") ||
    msg.includes("NETWORK")
  ) {
    return true;
  }
  return false;
}

// --------------------------------------------------
// REUSABLE FALLBACK ENTRYPOINT
// --------------------------------------------------

/**
 * Executes a Gemini content generation request with configured model fallback and retries.
 * 
 * @param chainName Name of the configured model chain to use ('ingestion' | 'community' | 'truth')
 * @param request Configuration containing contents and generation config, excluding the model itself.
 */
export async function generateWithFallback(
  chainName: keyof typeof MODEL_CHAINS,
  request: { contents: any; config?: any }
): Promise<GeminiServiceResponse> {
  const chain = MODEL_CHAINS[chainName];
  if (!chain || chain.length === 0) {
    throw new Error(`Model chain for '${chainName}' is not defined or is empty.`);
  }

  const ai = getGeminiClient();
  const errorsList: any[] = [];

  console.log(`\n[Gemini]`);
  console.log(`Agent Chain: ${chainName.toUpperCase()}`);

  for (let i = 0; i < chain.length; i++) {
    const model = chain[i];
    let retries = 0;

    console.log(`Trying: ${model}`);

    while (true) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: request.contents,
          config: request.config
        });

        const text = response.text;
        if (text === undefined || text === null) {
          throw new Error("Gemini API returned an empty or invalid response.");
        }

        console.log(`Result: Success`);
        return {
          text,
          metadata: {
            model,
            fallbackLevel: i + 1,
            retries
          }
        };
      } catch (error: any) {
        // Classify the failure
        if (!isInfrastructureFailure(error)) {
          // Non-infrastructure failure (e.g. blocklist, syntax error, safety block)
          // Do not retry or fallback. Throw immediately to prevent masking logical errors.
          console.error(`Result: Immediate failure (Non-infrastructure error)`);
          throw error;
        }

        const quotaExceeded = isQuotaFailure(error);

        if (quotaExceeded) {
          console.log(`Result: Quota exceeded (429 / RESOURCE_EXHAUSTED)`);
          errorsList.push({ model, error, type: "quota" });
          // Break the inner loop to fallback to the next model immediately (do not retry quota errors)
          break;
        } else {
          // Transient failure
          if (retries === 0) {
            retries++;
            console.log(`Result: Transient infrastructure error. Retrying once...`);
            continue; // Retry once on same model
          } else {
            console.log(`Result: Transient failure persists on second attempt.`);
            errorsList.push({ model, error, type: "transient" });
            break; // Break the inner loop to fallback to the next model
          }
        }
      }
    }
  }

  // If we reach this point, all models in the chain have exhausted their attempts
  console.error(`[Gemini] All models in chain '${chainName}' failed.`);
  throw new AIServiceUnavailableError(
    `AI service is currently unavailable. All models in the '${chainName}' chain failed to resolve the request.`,
    errorsList
  );
}
