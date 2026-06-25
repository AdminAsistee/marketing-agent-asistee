import { ai, AGENT_MODELS } from './gemini';
import { logger } from './logger';
import type { WriterDraft, ResearchResult, AgentName } from './types';

// Enforce the exact JSON schema requested by the user and defined in types.ts
const writerResponseSchema = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING' },
    introduction: { type: 'STRING' },
    sections: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          heading: { type: 'STRING' },
          content: { type: 'STRING' },
        },
        required: ['heading', 'content'],
      },
    },
    conclusion: { type: 'STRING' },
  },
  required: ['title', 'introduction', 'sections', 'conclusion'],
};

/**
 * Runs the Writer Agent on a PRD and its corresponding research findings.
 * Generates a structured first-draft blog article or document.
 * Logs the execution telemetry to Supabase.
 */
export async function writerAgent(
  prd: string,
  research: ResearchResult,
  runId: string
): Promise<WriterDraft> {
  const agentName: AgentName = 'writer';
  const startTime = Date.now();
  const inputPayload = {
    prd,
    researchSummary: research.summary,
    researchSources: research.sources,
  };

  // Validate inputs
  if (!prd) {
    throw new Error('Writer Agent Error: PRD input is empty.');
  }
  if (!research || !research.summary) {
    throw new Error('Writer Agent Error: Research summary input is empty.');
  }

  try {
    const systemInstruction = `You are an expert marketing writer and content strategist. Your task is to write a comprehensive, professional first-draft blog post or article based on the provided Product Requirement Document (PRD) and web research findings.

Follow these strict guidelines:
1. Ground all your content in the provided PRD and research findings.
2. Avoid unsupported claims. Cite the facts and trends identified during research.
3. Structure the draft with a compelling title, an engaging introduction, several detailed body sections, and a clear conclusion.
4. Keep the style professional, clean, and optimized for marketing and technical reading.
5. You must output a JSON object matching the requested schema exactly. Do not include any text outside the JSON block.`;

    const contents = `PRD details:\n${prd}\n\nWeb Research findings:\n${research.summary}\n\nSources cited:\n${JSON.stringify(
      research.sources,
      null,
      2
    )}`;

    const response = await ai.models.generateContent({
      model: AGENT_MODELS.writer,
      contents,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: writerResponseSchema,
      },
    });

    const latency = Date.now() - startTime;
    const responseText = response.text || '';

    if (!responseText) {
      throw new Error('Writer Agent generated an empty response.');
    }

    // Parse the structured output
    let draft: WriterDraft;
    try {
      draft = JSON.parse(responseText.trim());
    } catch {
      console.error('Failed to parse Writer response as JSON:', responseText);
      throw new Error('Writer Agent response was not valid JSON.');
    }

    // Basic structural validation
    if (!draft.title || !draft.introduction || !draft.sections || !draft.conclusion) {
      throw new Error('Writer Agent response JSON is missing required keys.');
    }

    const respObj = response as { usageMetadata?: { candidatesTokenCount?: number } };
    const tokenCount = respObj.usageMetadata?.candidatesTokenCount || undefined;

    // Log successful transaction
    await logger.logAgentTransaction({
      run_id: runId,
      agent_name: agentName,
      input: inputPayload,
      output: draft,
      latency_ms: latency,
      token_count: tokenCount,
    });

    return draft;
  } catch (error) {
    const latency = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error(`[ERROR] Writer Agent failed: ${errorMessage}`);

    // Log failed transaction
    await logger.logAgentTransaction({
      run_id: runId,
      agent_name: agentName,
      input: inputPayload,
      output: { error: errorMessage },
      latency_ms: latency,
    });

    throw new Error(`Writer Agent failed: ${errorMessage}`);
  }
}
