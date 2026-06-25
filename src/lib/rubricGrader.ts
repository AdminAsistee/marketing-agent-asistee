import { ai, AGENT_MODELS } from './gemini';
import { logger } from './logger';
import type { WriterDraft, FactCheckerOutput, RubricGraderOutput, AgentName } from './types';

// Structured JSON Schema for Rubric Grader Output
const rubricGraderResponseSchema = {
  type: 'OBJECT',
  properties: {
    clarity: {
      type: 'INTEGER',
      description: 'Clarity score: 1 (Poor) to 5 (Excellent). Evaluates logical structure, readability, and understandable explanations.',
    },
    accuracy: {
      type: 'INTEGER',
      description: 'Accuracy score: 1 (Poor) to 5 (Excellent). Evaluates consistency with research and fact-check results.',
    },
    completeness: {
      type: 'INTEGER',
      description: 'Completeness score: 1 (Poor) to 5 (Excellent). Evaluates how well the article satisfies every PRD requirement.',
    },
    overall_score: {
      type: 'INTEGER',
      description: 'Overall final quality score on a 1-5 scale.',
    },
    feedback: {
      type: 'STRING',
      description: 'Detailed qualitative feedback explaining the grades and listing any strengths or potential improvements.',
    },
  },
  required: ['clarity', 'accuracy', 'completeness', 'overall_score', 'feedback'],
};

/**
 * Runs the Rubric Grader Agent on the original PRD, the final polished article,
 * and the final fact-check results to compute final quality scores and feedback.
 * Logs the execution telemetry to Supabase.
 */
export async function rubricGraderAgent(
  prd: string,
  article: WriterDraft,
  factCheckResult: FactCheckerOutput,
  runId: string
): Promise<RubricGraderOutput> {
  const agentName: AgentName = 'rubric-grader';
  const startTime = Date.now();
  const inputPayload = {
    prd,
    article,
    factCheckResult,
  };

  // Validate inputs
  if (!prd) {
    throw new Error('Rubric Grader Agent Error: PRD input is empty.');
  }
  if (!article) {
    throw new Error('Rubric Grader Agent Error: Article input is empty.');
  }
  if (!factCheckResult) {
    throw new Error('Rubric Grader Agent Error: Fact check result input is empty.');
  }

  try {
    const systemInstruction = `You are an expert Rubric Grader Agent. Your task is to evaluate the final article against the original Product Requirement Document (PRD) and the previous fact-check outcomes.

Provide an objective assessment and output a JSON object containing clarity, accuracy, completeness, and overall_score on a 1-5 integer scale, along with qualitative feedback.

Scoring Scale:
1 = Poor
2 = Needs improvement
3 = Acceptable
4 = Strong
5 = Excellent

Evaluation Criteria:
- Clarity: Evaluates logical structure, readability, and understandable explanations.
- Accuracy: Evaluates consistency with research and fact-check results. (If the fact check failed or listed unresolved unsupported claims, accuracy should be marked lower accordingly).
- Completeness: Evaluates how well the article satisfies every PRD requirement (e.g. key features, target audience, technical constraints).

You must output a JSON object matching this schema:
{
  "clarity": number,
  "accuracy": number,
  "completeness": number,
  "overall_score": number,
  "feedback": "string"
}

Do NOT output any markdown, code blocks, or free text outside the JSON block.`;

    const contents = `--- ORIGINAL PRODUCT REQUIREMENT DOCUMENT (PRD) ---
${prd}

--- PREVIOUS FACT CHECK OUTCOME ---
Passed Verification: ${factCheckResult.passed}
Unsupported Claims Identified: ${JSON.stringify(factCheckResult.unsupported_claims, null, 2)}
Fact Checker Feedback: ${factCheckResult.feedback}

--- FINAL ARTICLE ---
Title: ${article.title}
Introduction: ${article.introduction}
Sections:
${(article.sections || []).map((sec) => `## ${sec.heading}\n${sec.content}`).join('\n\n')}
Conclusion: ${article.conclusion}`;

    const response = await ai.models.generateContent({
      model: AGENT_MODELS['rubric-grader'],
      contents,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: rubricGraderResponseSchema,
      },
    });

    const latency = Date.now() - startTime;
    const responseText = response.text || '';

    if (!responseText) {
      throw new Error('Rubric Grader Agent generated an empty response.');
    }

    let result: RubricGraderOutput;
    try {
      result = JSON.parse(responseText.trim());
    } catch {
      console.error('Failed to parse Rubric Grader response as JSON:', responseText);
      throw new Error('Rubric Grader Agent response was not valid JSON.');
    }

    // Basic structural validation
    if (
      result.clarity === undefined ||
      result.accuracy === undefined ||
      result.completeness === undefined ||
      result.overall_score === undefined ||
      !result.feedback
    ) {
      throw new Error('Rubric Grader Agent response JSON is missing required keys.');
    }

    const tokenCount = response.usageMetadata?.totalTokenCount || undefined;

    // Log successful transaction to Supabase
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

    console.error(`[ERROR] Rubric Grader Agent failed: ${errorMessage}`);

    // Log failed transaction to Supabase
    await logger.logAgentTransaction({
      run_id: runId,
      agent_name: agentName,
      input: inputPayload,
      output: { error: errorMessage },
      latency_ms: latency,
    });

    throw new Error(`Rubric Grader Agent failed: ${errorMessage}`);
  }
}
