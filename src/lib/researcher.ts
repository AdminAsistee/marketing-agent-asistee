import { ai, AGENT_MODELS } from './gemini';
import { logger } from './logger';
import type { ResearchResult, ResearchSource, AgentName } from './types';

/**
 * Extracts the generated summary text from the Gemini response.
 */
export function extractSummary(response: unknown): string {
  const resp = response as { text?: string };
  return resp?.text?.trim() || '';
}

/**
 * Extracts raw sources cited by Gemini's Search Grounding from the response metadata.
 */
export function extractSources(response: unknown): ResearchSource[] {
  const resp = response as {
    candidates?: {
      groundingMetadata?: {
        groundingChunks?: {
          web?: {
            title?: string;
            uri?: string;
          };
        }[];
      };
    }[];
  };
  const chunks = resp?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  
  return chunks
    .map((chunk) => {
      const title = chunk.web?.title || '';
      const url = chunk.web?.uri || '';
      return { title, url };
    })
    .filter((source: ResearchSource) => source.url !== '');
}

/**
 * Normalizes and deduplicates source list by URL.
 */
export function normalizeSources(sources: ResearchSource[]): ResearchSource[] {
  const seenUrls = new Set<string>();
  const normalized: ResearchSource[] = [];

  for (const source of sources) {
    const cleanUrl = source.url.trim();
    if (!cleanUrl) continue;

    if (!seenUrls.has(cleanUrl)) {
      seenUrls.add(cleanUrl);
      normalized.push({
        title: source.title.trim() || cleanUrl,
        url: cleanUrl,
      });
    }
  }

  return normalized;
}

/**
 * Runs the Research Agent on a PRD, enabling Google Search grounding.
 * Logs the execution telemetry to Supabase.
 */
export async function researchAgent(prd: string, runId: string): Promise<ResearchResult> {
  const agentName: AgentName = 'research';
  const startTime = Date.now();
  const inputPayload = { prd };

  if (!prd) {
    throw new Error('Research Agent Error: PRD input is empty.');
  }

  try {
    const prompt = `You are a Research Agent. Conduct research and gather live web context related to the following Product Requirement Document (PRD). Focus on analyzing competitors, latest technologies, standard integrations, and technical feasibility. Provide a detailed, comprehensive synthesis of your findings.\n\nPRD:\n${prd}`;

    const response = await ai.models.generateContent({
      model: AGENT_MODELS.research,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const latency = Date.now() - startTime;
    const rawSummary = extractSummary(response);
    const rawSources = extractSources(response);
    const normalizedSources = normalizeSources(rawSources);

    const result: ResearchResult = {
      summary: rawSummary,
      sources: normalizedSources,
    };

    const respObj = response as { usageMetadata?: { candidatesTokenCount?: number } };
    const tokenCount = respObj.usageMetadata?.candidatesTokenCount || undefined;

    // Log successful transaction
    await logger.logAgentTransaction({
      run_id: runId,
      agent_name: agentName,
      input: inputPayload,
      output: result,
      latency_ms: latency,
      token_count: tokenCount,
    });

    return result;
  } catch (error) {
    const latency = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error(`[ERROR] Research Agent failed: ${errorMessage}`);

    // Log failed transaction
    await logger.logAgentTransaction({
      run_id: runId,
      agent_name: agentName,
      input: inputPayload,
      output: { error: errorMessage },
      latency_ms: latency,
    });

    throw new Error(`Research Agent failed: ${errorMessage}`);
  }
}
