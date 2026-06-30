import { ai, AGENT_MODELS } from './gemini';
import { logger } from './logger';
import type { TrendData, SeoOptimizationReport, AgentName } from './types';

const seoOptimizerResponseSchema = {
  type: 'OBJECT',
  properties: {
    title_analysis: {
      type: 'STRING',
      description: 'Analysis of the current title and how it relates to target keywords/interest.'
    },
    seo_score: {
      type: 'STRING',
      description: 'A score out of 100 representing the current SEO optimization level, e.g. "65/100".'
    },
    search_intent_match: {
      type: 'STRING',
      description: 'Analysis of how well the article satisfies user search intent for the target keyword.'
    },
    missing_keywords: {
      type: 'ARRAY',
      items: { type: 'STRING' },
      description: 'High-value search queries/keywords from trend data that are missing or underutilized.'
    },
    content_gaps: {
      type: 'ARRAY',
      items: { type: 'STRING' },
      description: 'Topics, questions, or details missing from the article that are highly relevant to search trends.'
    },
    recommended_headings: {
      type: 'ARRAY',
      items: { type: 'STRING' },
      description: 'Optimized headings/subheadings (H2/H3) to structure the content and improve SEO.'
    },
    readability_feedback: {
      type: 'STRING',
      description: 'Feedback on the structure, style, readability, and sentence flow of the draft.'
    },
    improvement_suggestions: {
      type: 'ARRAY',
      items: { type: 'STRING' },
      description: 'Specific, actionable tasks or recommendations the user can take to improve this article.'
    },
    optimized_title_options: {
      type: 'ARRAY',
      items: { type: 'STRING' },
      description: 'A list of 2-3 alternative optimized titles for the article.'
    }
  },
  required: [
    'title_analysis',
    'seo_score',
    'search_intent_match',
    'missing_keywords',
    'content_gaps',
    'recommended_headings',
    'readability_feedback',
    'improvement_suggestions',
    'optimized_title_options'
  ]
};

/**
 * SEO Optimizer Agent using Gemini.
 * Compares an existing article's text against keyword trend findings and website context
 * to generate a structured SEO improvement report.
 */
export async function seoOptimizerAgent(
  article: string,
  websiteContext: string,
  targetKeyword: string,
  trendData: TrendData,
  runId: string
): Promise<SeoOptimizationReport> {
  const agentName: AgentName = 'seo_optimizer_agent';
  const startTime = Date.now();
  const inputPayload = {
    article,
    websiteContext,
    targetKeyword,
    trendData
  };

  if (!article || !article.trim()) {
    throw new Error('SEO Optimizer Agent Error: Article input is empty.');
  }
  if (!targetKeyword || !targetKeyword.trim()) {
    throw new Error('SEO Optimizer Agent Error: Target keyword input is empty.');
  }

  try {
    const systemInstruction = `You are an expert SEO Optimization Agent. Your job is to analyze an existing article draft against search trends data, related queries, rising topics, and the user's business/website context.
    
Provide a detailed optimization report returned as a structured JSON object matching this schema:
{
  "title_analysis": "string",
  "seo_score": "string",
  "search_intent_match": "string",
  "missing_keywords": ["string"],
  "content_gaps": ["string"],
  "recommended_headings": ["string"],
  "readability_feedback": "string",
  "improvement_suggestions": ["string"],
  "optimized_title_options": ["string"]
}

Guidelines:
1. Compare the article's existing keywords and structure against the trend data (related search terms and rising queries).
2. Rate the article's current SEO strength with a score out of 100 (e.g. "65/100").
3. Identify missing keywords that should be integrated.
4. Detect content gaps (unaddressed topics/questions) in the current article compared to trending search intent.
5. Provide actionable, specific improvements and list optimized alternative titles.
6. Do NOT output any text, markdown wraps, or markdown blocks outside the JSON object.`;

    const contents = `Existing Article Content:
${article}

Website/Business Context: ${websiteContext || 'None provided'}
Target Keyword: ${targetKeyword}

--- GOOGLE SEARCH TRENDS DATA ---
Search Interest Summary: ${trendData.trendSummary}
Related Search Terms: ${JSON.stringify(trendData.relatedQueries)}
Rising Topics/Search Terms: ${JSON.stringify(trendData.risingQueries)}`;

    const response = await ai.models.generateContent({
      model: AGENT_MODELS['seo-optimizer-agent'],
      contents,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: seoOptimizerResponseSchema,
      }
    });

    const latency = Date.now() - startTime;
    const responseText = response.text || '';
    if (!responseText) {
      throw new Error('SEO Optimizer Agent generated an empty response.');
    }

    const report: SeoOptimizationReport = JSON.parse(responseText.trim());
    const tokenCount = response.usageMetadata?.totalTokenCount || undefined;

    // Log telemetry to Supabase
    await logger.logAgentTransaction({
      run_id: runId,
      agent_name: agentName,
      input: inputPayload,
      output: report,
      latency_ms: latency,
      token_count: tokenCount,
    });

    return report;
  } catch (error) {
    const latency = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[ERROR] SEO Optimizer Agent failed: ${errorMessage}`);

    // Log failure telemetry to Supabase
    await logger.logAgentTransaction({
      run_id: runId,
      agent_name: agentName,
      input: inputPayload,
      output: { error: errorMessage },
      latency_ms: latency,
    });

    throw new Error(`SEO Optimizer Agent failed: ${errorMessage}`);
  }
}
