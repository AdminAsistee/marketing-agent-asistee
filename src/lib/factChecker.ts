import { ai, AGENT_MODELS } from './gemini';
import { logger } from './logger';
import type { ResearchResult, WriterDraft, FactCheckerOutput, AgentName } from './types';

// Enforce the exact JSON schema requested by the user and defined in types.ts
const factCheckerResponseSchema = {
  type: 'OBJECT',
  properties: {
    passed: { type: 'BOOLEAN' },
    unsupported_claims: {
      type: 'ARRAY',
      items: { type: 'STRING' },
    },
    feedback: { type: 'STRING' },
  },
  required: ['passed', 'unsupported_claims', 'feedback'],
};

/**
 * Runs the Fact Checker Agent on the original PRD, research findings, and current draft.
 * Verifies that all claims are grounded in research and returns a structured feedback report.
 * Logs the execution telemetry to Supabase.
 */
export async function factCheckerAgent(
  prd: string,
  research: ResearchResult,
  draft: WriterDraft,
  runId: string,
  agentName: AgentName,
  retryMetadata?: {
    attempt: number;
    max_attempts: number;
    is_revision: boolean;
  }
): Promise<FactCheckerOutput> {
  const startTime = Date.now();
  const inputPayload = {
    prd,
    researchSummary: research.summary,
    researchSources: research.sources,
    draft,
    retry_metadata: retryMetadata,
  };

  // Validate inputs
  if (!prd) {
    throw new Error('Fact Checker Agent Error: PRD input is empty.');
  }
  if (!research || !research.summary) {
    throw new Error('Fact Checker Agent Error: Research summary input is empty.');
  }
  if (!draft) {
    throw new Error('Fact Checker Agent Error: Writer draft input is empty.');
  }

  try {
    const systemInstruction = `You are an expert Fact Checking Agent. Your task is to evaluate whether the generated article draft is fully supported by the provided research data (web research summary and sources) and original Product Requirement Document (PRD).

Analyze every claim in the article draft and verify if it can be directly supported by or inferred from the PRD and research findings.

You must output a JSON object matching this schema:
{
  "passed": boolean,
  "unsupported_claims": [
    "string"
  ],
  "feedback": "string"
}

Guidelines:
1. "passed" must be true only if there are NO unsupported or false claims in the draft. If there is even one unsupported or invented claim, "passed" must be false.
2. "unsupported_claims" must list all statements, claims, or statistics in the draft that are not backed by the provided PRD or research findings.
3. "feedback" must provide specific, actionable guidance on how the Writer Agent can fix the unsupported claims, remove or modify them, and improve factual accuracy.
4. Do NOT output any free text or markdown outside the JSON block.`;

    const contents = `--- PRODUCT REQUIREMENT DOCUMENT (PRD) ---
${prd}

--- WEB RESEARCH FINDINGS ---
${research.summary}

--- RESEARCH SOURCES ---
${JSON.stringify(research.sources, null, 2)}

--- CURRENT WRITER DRAFT ---
${JSON.stringify(draft, null, 2)}`;

    const response = await ai.models.generateContent({
      model: AGENT_MODELS['fact-checker'],
      contents,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: factCheckerResponseSchema,
      },
    });

    const latency = Date.now() - startTime;
    const responseText = response.text || '';

    if (!responseText) {
      throw new Error('Fact Checker Agent generated an empty response.');
    }

    // Parse the structured output
    let result: FactCheckerOutput;
    try {
      result = JSON.parse(responseText.trim());
    } catch {
      console.error('Failed to parse Fact Checker response as JSON:', responseText);
      throw new Error('Fact Checker Agent response was not valid JSON.');
    }

    // Basic structural validation
    if (result.passed === undefined || !result.unsupported_claims || result.feedback === undefined) {
      throw new Error('Fact Checker Agent response JSON is missing required keys.');
    }

    // Extract total token count from the SDK response
    const tokenCount = response.usageMetadata?.totalTokenCount || undefined;

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

    console.error(`[ERROR] Fact Checker Agent failed: ${errorMessage}`);

    // Log failed transaction
    await logger.logAgentTransaction({
      run_id: runId,
      agent_name: agentName,
      input: inputPayload,
      output: { error: errorMessage },
      latency_ms: latency,
    });

    throw new Error(`Fact Checker Agent failed: ${errorMessage}`);
  }
}
