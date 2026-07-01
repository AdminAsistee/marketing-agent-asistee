import { ai, AGENT_MODELS } from './gemini';
import { logger } from './logger';
import type { WriterDraft, ResearchResult, AgentName, SeoRecommendations } from './types';

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
  runId: string,
  previousDraft?: WriterDraft,
  feedback?: string,
  agentName: AgentName = 'writer',
  retryMetadata?: {
    attempt: number;
    max_attempts: number;
    is_revision: boolean;
  },
  seoRecommendations?: SeoRecommendations
): Promise<WriterDraft> {
  const startTime = Date.now();
  const inputPayload = {
    prd,
    researchSummary: research.summary,
    researchSources: research.sources,
    previousDraft,
    feedback,
    retry_metadata: retryMetadata,
    seo_recommendations: seoRecommendations,
  };

  // Validate inputs
  if (!prd) {
    throw new Error('Writer Agent Error: PRD input is empty.');
  }
  if (!research || !research.summary) {
    throw new Error('Writer Agent Error: Research summary input is empty.');
  }

  try {
    let systemInstruction = `You are an expert marketing writer and content strategist. Your task is to write a comprehensive, professional blog post or article based on the provided Product Requirement Document (PRD) and web research findings.

Follow these strict writing guidelines to ensure the content feels natural, human-written, and high-quality:
1. Avoid generic AI writing signals:
   - Do NOT use excessive em-dashes (—). Use normal punctuation.
   - Avoid generic AI introductions (like "In today's world...", "In the fast-paced digital era...", "It is important to note...", "With the rise of..."). Start directly with engaging, specific hooks.
   - Do NOT write repetitive conclusion paragraphs that just restate the same points. Make the conclusion forward-looking or action-oriented.
   - Avoid overly formal, academic, or robotic language. Keep the tone natural, professional, specific, and useful.
   - Do NOT use unnecessary or excessive bullet-point lists where flowing paragraph prose is more appropriate.
   - Avoid artificial transitions (such as "Furthermore,", "Moreover,", "In addition,"). Use smooth, thematic transitions.
2. Prefer:
   - Shorter, punchy sentences.
   - Natural variations in sentence length and structure.
   - Concrete examples and specific scenarios instead of vague generalizations.
3. Ground all content in the provided PRD and web research findings.
4. Avoid unsupported claims. Cite facts and trends identified during research.
5. Structure the draft with a compelling title, an engaging introduction, detailed body sections, and a clear conclusion.
6. You must output a JSON object matching the requested schema exactly. Do not include any text outside the JSON block.`;

    if (prd.includes('## Original Article') || prd.includes('Optimize Existing Article')) {
      systemInstruction += `\n\nAdditionally, you are in OPTIMIZATION MODE. Your goal is to IMPROVE the existing article draft, NOT replace or rebuild it from scratch. Follow these constraints strictly:
- Preserve the original author's voice, tone, and specific style.
- Maintain the original article structure, sections, and headings as much as possible.
- Improve only the necessary sections (e.g. to integrate missing keywords, improve readability, or address content gaps).
- Add missing information and expand thin sections rather than rewriting the entire text.
- Do NOT change the original factual meaning or core message of the article.`;
    }

    let contents = `PRD details:\n${prd}\n\nWeb Research findings:\n${research.summary}\n\nSources cited:\n${JSON.stringify(
      research.sources,
      null,
      2
    )}`;

    if (seoRecommendations) {
      systemInstruction += `\n\nAdditionally, you must optimize the article for search visibility using these SEO recommendations:
- Primary Keyword: "${seoRecommendations.primaryKeyword}" (incorporate naturally throughout the article, especially in headings).
- Secondary Keywords: ${JSON.stringify(seoRecommendations.secondaryKeywords)} (incorporate where relevant).
- Recommended Titles: ${JSON.stringify(seoRecommendations.recommendedTitles)} (choose one of these or write a highly similar optimized title).
- SEO Strategy Guidelines: ${seoRecommendations.seoStrategy}

Follow these strict SEO writing rules:
1. Use the keywords naturally; do NOT stuff keywords.
2. Prioritize high-quality, useful content over search engine manipulation.
3. Structure the content cleanly (with headings and subheadings) to maximize search visibility.`;

      contents += `\n\nSEO Recommendations:\n${JSON.stringify(seoRecommendations, null, 2)}`;
    }

    if (previousDraft && feedback) {
      systemInstruction += `\n\nAdditionally, you are in REVISION MODE. You must revise the previous draft based on feedback from a Fact Checker.
Follow these revision guidelines:
1. Carefully address and fix all unsupported claims listed in the Fact Checker feedback.
2. Preserve accurate sections and content from the previous draft that did not have issues.
3. Do NOT introduce new unsupported information.
4. Maintain the exact same output schema.`;

      contents += `\n\n--- PREVIOUS DRAFT TO REVISE ---\n${JSON.stringify(previousDraft, null, 2)}` +
                  `\n\n--- FACT CHECKER FEEDBACK ---\n${feedback}`;
    }

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

    // Extract total token count from the SDK response
    const tokenCount = response.usageMetadata?.totalTokenCount || undefined;

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
