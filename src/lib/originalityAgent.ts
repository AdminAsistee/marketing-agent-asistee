import { ai } from './gemini';
import { logger } from './logger';
import type { OriginalityReport, AgentName } from './types';

const originalityResponseSchema = {
  type: 'OBJECT',
  properties: {
    missing_angles: {
      type: 'ARRAY',
      items: { type: 'STRING' },
      description: 'Topics or angles about this subject that are poorly covered or missing on the web.'
    },
    unique_perspectives: {
      type: 'ARRAY',
      items: { type: 'STRING' },
      description: 'Angles or perspectives the user can take to make their content stand out from the competition.'
    },
    local_context_opportunities: {
      type: 'ARRAY',
      items: { type: 'STRING' },
      description: 'Ways to tie the topic to local events, communities, or geographical context.'
    },
    potential_interviews: {
      type: 'ARRAY',
      items: { type: 'STRING' },
      description: 'Suggestions for people, roles, or organizations to interview to add exclusive value (e.g. local collectors, store owners).'
    },
    follow_up_topics: {
      type: 'ARRAY',
      items: { type: 'STRING' },
      description: 'Ideas for subsequent articles or content pieces to build a content cluster.'
    },
    exclusive_content_opportunities: {
      type: 'ARRAY',
      items: { type: 'STRING' },
      description: 'Exclusive data, templates, checklists, or resources the user can build to attract backlinks and shares.'
    }
  },
  required: [
    'missing_angles',
    'unique_perspectives',
    'local_context_opportunities',
    'potential_interviews',
    'follow_up_topics',
    'exclusive_content_opportunities'
  ]
};

/**
 * Originality Agent using Gemini with Google Search grounding.
 * Evaluates the uniqueness and content opportunities of a topic or existing article draft.
 */
export async function originalityAgent(
  input: string,
  websiteContext: string,
  runId: string
): Promise<OriginalityReport> {
  const agentName: AgentName = 'research';
  const startTime = Date.now();
  const inputPayload = { input, websiteContext };

  if (!input || !input.trim()) {
    throw new Error('Originality Agent Error: Input is empty.');
  }

  try {
    const prompt = `Perform an Originality and Content Opportunity Analysis for the following topic or existing article content.
    
Input Topic/Article Content:
"""
${input.trim()}
"""

Website/Business Context:
"""
${websiteContext || 'None provided'}
"""

Research what other articles on the web say about this topic. Identify content gaps, angles they miss, unique viewpoints, potential interviewees, and ways to make this piece uniquely valuable and distinct from standard content on the web.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        systemInstruction: `You are an expert Content Originality and Search Opportunity Analyst. Your job is to analyze search results and find content opportunities that set the user's article apart from existing web articles.
Return a JSON object conforming strictly to the requested schema. Do not include any text outside the JSON block.`,
        responseMimeType: 'application/json',
        responseSchema: originalityResponseSchema,
      }
    });

    const latency = Date.now() - startTime;
    const responseText = response.text || '';
    if (!responseText) {
      throw new Error('Originality Agent returned an empty response.');
    }

    const report: OriginalityReport = JSON.parse(responseText.trim());
    const tokenCount = response.usageMetadata?.totalTokenCount || undefined;

    // Log telemetry
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
    console.error(`[ERROR] Originality Agent failed: ${errorMessage}`);

    await logger.logAgentTransaction({
      run_id: runId,
      agent_name: agentName,
      input: inputPayload,
      output: { error: errorMessage },
      latency_ms: latency,
    });

    throw new Error(`Originality Agent failed: ${errorMessage}`);
  }
}
