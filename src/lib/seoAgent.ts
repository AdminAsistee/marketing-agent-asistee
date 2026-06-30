import { ai, AGENT_MODELS } from './gemini';
import { logger } from './logger';
import type { TrendData, SeoRecommendations, AgentName } from './types';

const seoRecommendationsSchema = {
  type: 'OBJECT',
  properties: {
    primaryKeyword: {
      type: 'STRING',
      description: 'The single most high-value primary keyword optimized for the topic and business context.'
    },
    secondaryKeywords: {
      type: 'ARRAY',
      items: { type: 'STRING' },
      description: 'A list of 3-5 secondary keywords/variations to support the primary keyword.'
    },
    contentIdeas: {
      type: 'ARRAY',
      items: { type: 'STRING' },
      description: 'A list of content angles or content ideas based on the trends.'
    },
    recommendedTitles: {
      type: 'ARRAY',
      items: { type: 'STRING' },
      description: 'A list of 2-3 catchy, search-optimized blog article titles.'
    },
    seoStrategy: {
      type: 'STRING',
      description: 'A summary strategy explaining why these keywords and ideas were selected and how to structure content to rank.'
    }
  },
  required: ['primaryKeyword', 'secondaryKeywords', 'contentIdeas', 'recommendedTitles', 'seoStrategy']
};

/**
 * SEO Analysis Agent using Gemini.
 * Analyzes trend data and website/business context to provide high-value SEO recommendations.
 * Telemetry is logged to Supabase.
 */
export async function seoAgent(
  keyword: string,
  websiteContext: string,
  trendData: TrendData,
  runId: string
): Promise<SeoRecommendations> {
  const agentName: AgentName = 'seo_agent';
  const startTime = Date.now();
  const inputPayload = {
    keyword,
    websiteContext,
    trendData
  };

  if (!keyword || !keyword.trim()) {
    throw new Error('SEO Agent Error: Keyword input is empty.');
  }

  try {
    const systemInstruction = `You are an expert SEO Intelligence Agent. Your goal is to analyze search trend data, related queries, rising topics, and the user's business context to generate high-value search engine optimization recommendations.
    
You must output a JSON object matching this schema:
{
  "primaryKeyword": "string",
  "secondaryKeywords": ["string"],
  "contentIdeas": ["string"],
  "recommendedTitles": ["string"],
  "seoStrategy": "string"
}

Guidelines:
1. Identify a highly relevant primary keyword.
2. Provide secondary keywords that have high semantic relevance and search intent.
3. Generate blog post ideas and titles that align with both the search trend interest and the website context.
4. Provide a clear SEO strategy summarizing how the content should be structured to rank well.
5. Do NOT output any text, markdown wraps, or markdown blocks outside the JSON object.`;

    const contents = `User Keyword/Topic: ${keyword}
Business/Website Context: ${websiteContext || 'None provided'}

--- GOOGLE SEARCH TRENDS DATA ---
Search Interest Summary: ${trendData.trendSummary}
Related Search Terms: ${JSON.stringify(trendData.relatedQueries)}
Rising Topics/Search Terms: ${JSON.stringify(trendData.risingQueries)}`;

    const response = await ai.models.generateContent({
      model: AGENT_MODELS['seo-agent'],
      contents,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: seoRecommendationsSchema,
      }
    });

    const latency = Date.now() - startTime;
    const responseText = response.text || '';
    if (!responseText) {
      throw new Error('SEO Agent generated an empty response.');
    }

    const recommendations: SeoRecommendations = JSON.parse(responseText.trim());
    const tokenCount = response.usageMetadata?.totalTokenCount || undefined;

    // Log telemetry to Supabase
    await logger.logAgentTransaction({
      run_id: runId,
      agent_name: agentName,
      input: inputPayload,
      output: recommendations,
      latency_ms: latency,
      token_count: tokenCount,
    });

    return recommendations;
  } catch (error) {
    const latency = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[ERROR] SEO Agent failed: ${errorMessage}`);

    // Log failure telemetry to Supabase
    await logger.logAgentTransaction({
      run_id: runId,
      agent_name: agentName,
      input: inputPayload,
      output: { error: errorMessage },
      latency_ms: latency,
    });

    throw new Error(`SEO Agent failed: ${errorMessage}`);
  }
}
