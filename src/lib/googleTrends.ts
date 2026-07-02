import { ai, AGENT_MODELS } from './gemini';
import type { TrendData } from './types';

const trendDataResponseSchema = {
  type: 'OBJECT',
  properties: {
    relatedQueries: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          ranking: { type: 'INTEGER', description: 'Ranking position, starting at 1' },
          query: { type: 'STRING', description: 'Search term or query string' },
          searchGrowth: { type: 'STRING', description: 'Search volume growth rate percentage e.g. +120%' },
          estimatedInterest: { type: 'STRING', enum: ['High', 'Medium', 'Low'], description: 'Estimated volume classification' }
        },
        required: ['ranking', 'query', 'searchGrowth', 'estimatedInterest']
      },
      description: 'Ranked list of relevant related search terms/queries for the keyword'
    },
    risingQueries: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          ranking: { type: 'INTEGER', description: 'Ranking position, starting at 1' },
          query: { type: 'STRING', description: 'Search term or query string' },
          trendIncrease: { type: 'STRING', description: 'Growth percentage or Breakout tag' },
          estimatedInterest: { type: 'STRING', description: 'Optional estimated interest volume description' },
          opportunityScore: { type: 'INTEGER', description: 'A calculated opportunity priority score from 1 to 100' }
        },
        required: ['ranking', 'query', 'trendIncrease', 'opportunityScore']
      },
      description: 'List of rising queries or rising search terms showing recent traffic spikes'
    },
    trendSummary: {
      type: 'STRING',
      description: 'Search interest summary, describing overall trend direction, popularity and search context'
    }
  },
  required: ['relatedQueries', 'risingQueries', 'trendSummary']
};

// In-memory cache for search trends to optimize runtime and token usage
const trendsCache = new Map<string, { data: TrendData; timestamp: number }>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes time-to-live

/**
 * Retrieves search trends, related queries, rising topics, and popularity summary
 * using Gemini with Google Search Grounding to fetch live trend information.
 */
export async function fetchTrends(keyword: string): Promise<TrendData> {
  if (!keyword || !keyword.trim()) {
    throw new Error('Trends Retrieval Error: Keyword parameter is empty.');
  }

  const cacheKey = keyword.trim().toLowerCase();
  const cached = trendsCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`[CACHE HIT] Reusing cached Google Trends for: "${keyword}"`);
    return cached.data;
  }

  try {
    const prompt = `Research current Google search trends, search interest, related search terms, and rising search queries for the keyword: "${keyword}".
Focus on gathering live, real-time web search trend context and search interest variations. Return relatedQueries and risingQueries ranked and sorted from best to worst.`;

    const response = await ai.models.generateContent({
      model: AGENT_MODELS.research, // Uses gemini-3.5-flash with search tool
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        systemInstruction: 'You are a search trend research assistant. Retrieve real-time search trends and return the results as a JSON object matching the requested schema. Do not include any text outside the JSON block.',
        responseMimeType: 'application/json',
        responseSchema: trendDataResponseSchema,
      }
    });

    const responseText = response.text || '';
    if (!responseText) {
      throw new Error('Google Trends service returned an empty response.');
    }

    const data = JSON.parse(responseText.trim());
    const result: TrendData = {
      keyword: keyword.trim(),
      relatedQueries: data.relatedQueries || [],
      risingQueries: data.risingQueries || [],
      trendSummary: data.trendSummary || '',
    };

    // Save search trend result in cache
    trendsCache.set(cacheKey, { data: result, timestamp: Date.now() });

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[ERROR] Google Trends retrieval failed: ${errorMessage}`);
    throw new Error(`Google Trends retrieval failed: ${errorMessage}`);
  }
}
