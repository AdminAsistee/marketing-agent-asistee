import { ai, AGENT_MODELS } from './gemini';
import { logger } from './logger';
import type { WriterDraft, AgentName } from './types';

// Enforce the same structured JSON schema as the writer to preserve the output structure
const stylePolisherResponseSchema = {
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
 * Runs the Style Polisher Agent on a verified draft.
 * Optimizes grammar, style, tone, and readability without introducing or changing any facts.
 * Logs the execution telemetry to Supabase.
 */
export async function stylePolisherAgent(
  draft: WriterDraft,
  runId: string,
  agentName: AgentName = 'style-polisher'
): Promise<WriterDraft> {
  const startTime = Date.now();
  const inputPayload = {
    draft,
  };

  // Validate input
  if (!draft) {
    throw new Error('Style Polisher Agent Error: Draft input is empty.');
  }

  try {
    const systemInstruction = `You are an expert copyeditor and style polisher. Your task is to improve the style, grammar, readability, formatting, and brand tone of the provided verified article draft.
    
Follow these strict writing and style constraints:
1. Do NOT add any new facts, claims, or information that are not present in the original draft.
2. Do NOT remove, contradict, or modify verified factual information or data from the draft.
3. Focus purely on polishing grammar, flow, word choice, clarity, and visual formatting of headings/sections.
4. Eliminate generic AI writing patterns and robotic signals:
   - Do NOT use excessive em-dashes (—). Replace them with natural punctuation (commas, periods, parentheses).
   - Ensure the introduction is direct, engaging, and does not start with generic AI phrases like "In today's world...", "In the fast-paced...", "With the rise of...".
   - Clean up repetitive conclusion paragraphs that merely restate identical thoughts.
   - Replace overly formal, academic, or robotic words with natural, human-written variations.
   - Limit the use of bullet points; favor well-structured, easy-to-read paragraphs.
   - Remove clunky artificial transitions (e.g. "Furthermore,", "Moreover,", "In addition,").
5. Prefer shorter, punchier sentences and natural sentence flow variation.
6. You must output a JSON object matching the requested schema exactly. Do not include any text outside the JSON block.`;

    const contents = `--- CURRENT VERIFIED DRAFT ---
${JSON.stringify(draft, null, 2)}`;

    const response = await ai.models.generateContent({
      model: AGENT_MODELS['style-polisher'],
      contents,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: stylePolisherResponseSchema,
      },
    });

    const latency = Date.now() - startTime;
    const responseText = response.text || '';

    if (!responseText) {
      throw new Error('Style Polisher Agent generated an empty response.');
    }

    // Parse the structured output
    let polishedDraft: WriterDraft;
    try {
      polishedDraft = JSON.parse(responseText.trim());
    } catch {
      console.error('Failed to parse Style Polisher response as JSON:', responseText);
      throw new Error('Style Polisher Agent response was not valid JSON.');
    }

    // Basic structural validation
    if (!polishedDraft.title || !polishedDraft.introduction || !polishedDraft.sections || !polishedDraft.conclusion) {
      throw new Error('Style Polisher Agent response JSON is missing required keys.');
    }

    // Extract total token count from the SDK response
    const tokenCount = response.usageMetadata?.totalTokenCount || undefined;

    // Log successful transaction
    await logger.logAgentTransaction({
      run_id: runId,
      agent_name: agentName,
      input: inputPayload,
      output: polishedDraft,
      latency_ms: latency,
      token_count: tokenCount,
    });

    return polishedDraft;
  } catch (error) {
    const latency = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error(`[ERROR] Style Polisher Agent failed: ${errorMessage}`);

    // Log failed transaction
    await logger.logAgentTransaction({
      run_id: runId,
      agent_name: agentName,
      input: inputPayload,
      output: { error: errorMessage },
      latency_ms: latency,
    });

    throw new Error(`Style Polisher Agent failed: ${errorMessage}`);
  }
}
