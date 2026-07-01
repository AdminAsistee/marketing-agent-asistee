import { ai, AGENT_MODELS } from './gemini';
import { logger } from './logger';
import type { WriterDraft, ResearchResult, AgentName, SeoRecommendations, WritingConfiguration } from './types';

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
  seoRecommendations?: SeoRecommendations,
  writingConfiguration?: WritingConfiguration
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
    writingConfiguration,
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
      systemInstruction = `You are an expert marketing writer and content editor. You are in OPTIMIZATION MODE.
Your absolute priority is to IMPROVE the existing article draft provided in the input, NOT replace, rebuild, or override it with a completely new topic or different ideas.
Follow these constraints strictly:
1. Do NOT change the core topic, message, ideas, or arguments of the original article. Keep them identical.
2. Keep the exact same structure, sections, and headings of the original article as much as possible. Only add new sections if explicitly recommended to fill content gaps.
3. Preserve the original author's voice, tone, vocabulary, and specific writing style. Do not make unnecessary edits or rewrite sentences that are already good.
4. Only make changes necessary to support its SEO performance (e.g., natural integration of missing keywords, addressing specific content gaps, improving formatting).
5. Output a JSON object matching the requested schema exactly. Do not include any text outside the JSON block.`;
    }

    if (writingConfiguration) {
      let configInstruction = `\n\nAdditionally, you must write the article conforming to these specific content customization preferences:`;
      
      const primary = writingConfiguration.primaryTone || 'Professional';
      const secondary = writingConfiguration.secondaryTone;
      configInstruction += `\n- Tone/Voice: The primary tone must be "${primary}".`;
      if (secondary) {
        configInstruction += ` The secondary tone should blend in elements of "${secondary}".`;
      }
      
      const audience = writingConfiguration.audienceType || 'General audience';
      const customAud = writingConfiguration.customAudience;
      const targetAud = audience === 'Other' && customAud ? customAud : audience;
      configInstruction += `\n- Target Audience: The article is written specifically for "${targetAud}". Tailor vocabulary, style, and explanation depth for this group.`;

      const formality = writingConfiguration.formalityLevel || 3;
      const formalityDescriptions = [
        "Very casual (conversational, colloquial, relaxed)",
        "Casual (friendly, accessible, low formality)",
        "Balanced (approachable yet professional, natural)",
        "Professional (structured, business-ready, clean)",
        "Highly formal (academic, authoritative, highly precise)"
      ];
      configInstruction += `\n- Formality Level: ${formality}/5 - ${formalityDescriptions[formality - 1]}.`;

      const domain = writingConfiguration.domainIndustry || '';
      const customDom = writingConfiguration.customDomainIndustry;
      const targetDom = domain === 'Other' && customDom ? customDom : domain;
      if (targetDom) {
        configInstruction += `\n- Domain/Industry Context: "${targetDom}". Use appropriate industry terminology, examples, and contextual jargon correctly.`;
      }

      const intent = writingConfiguration.contentIntent || 'Inform readers';
      configInstruction += `\n- Article Goal/Intent: "${intent}".`;
      if (intent === 'Generate leads') {
        configInstruction += ` Prioritize highlighting benefits, using strong Calls-To-Action (CTAs), and structure sections to be highly conversion-focused.`;
      } else if (intent === 'Inform readers' || intent === 'Explain a concept') {
        configInstruction += ` Prioritize deep explanations, clear examples, educational analogies, and thorough definitions.`;
      } else if (intent === 'Rank on Google') {
        configInstruction += ` Ensure content matches searcher intent comprehensively, covers subtopics fully, and provides maximum value.`;
      } else if (intent === 'Sell a product') {
        configInstruction += ` Highlight features, advantages, customer benefits, and strong product integration with clear purchase incentives.`;
      } else if (intent === 'Build authority' || intent === 'Compare options') {
        configInstruction += ` Provide objective, unbiased, expert comparisons, detailed feature comparisons, and well-researched viewpoints.`;
      }

      const paraStyle = writingConfiguration.paragraphStyle || 'Balanced';
      if (paraStyle === 'Short') {
        configInstruction += `\n- Paragraph Style: Short paragraphs (mobile-friendly writing with frequent line breaks, 1-3 sentences per paragraph).`;
      } else if (paraStyle === 'Long') {
        configInstruction += `\n- Paragraph Style: Long-form paragraphs (traditional deep article style, allowing expanded explanations and longer, cohesive paragraphs).`;
      } else {
        configInstruction += `\n- Paragraph Style: Balanced paragraphs (combination of short, punchy statements and deeper, informative paragraphs).`;
      }

      let formattingRules = [];
      if (writingConfiguration.allowBullets) formattingRules.push("bullet point lists");
      if (writingConfiguration.allowNumberedLists) formattingRules.push("numbered lists");
      if (writingConfiguration.allowTables) formattingRules.push("structured Markdown tables");
      if (writingConfiguration.allowHeadings) formattingRules.push("clear Markdown headings (H2, H3)");
      if (writingConfiguration.allowExamples) formattingRules.push("concrete real-world examples");
      
      if (formattingRules.length > 0) {
        configInstruction += `\n- Allowed Formatting Elements: You are encouraged to use ${formattingRules.join(', ')} where appropriate to improve readability.`;
      } else {
        configInstruction += `\n- Formatting Restraints: Do NOT use lists or tables. Rely entirely on structured paragraphs and headers.`;
      }

      const customWords = parseInt(String(writingConfiguration.customWordCount || ''));
      const lengthSlider = writingConfiguration.lengthSlider || 'Medium';
      let wordConstraint = "";
      if (!isNaN(customWords) && customWords > 0) {
        wordConstraint = `Aim for approximately ${customWords} words (within ±10% margin).`;
      } else if (lengthSlider === 'Short') {
        wordConstraint = "Write a shorter article of 500-800 words.";
      } else if (lengthSlider === 'Long') {
        wordConstraint = "Write a long, comprehensive, in-depth article of 2000+ words.";
      } else {
        wordConstraint = "Write a medium-length article of 1000-1500 words.";
      }
      configInstruction += `\n- Length Goal: ${wordConstraint} Structure the sections and content depth accordingly to meet this target naturally.`;

      systemInstruction += configInstruction;
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

    if (writingConfiguration) {
      contents += `\n\nWriting Configuration:\n${JSON.stringify(writingConfiguration, null, 2)}`;
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
