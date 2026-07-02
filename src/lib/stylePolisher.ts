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
    const systemInstruction = `You are a professional executive copyeditor and editorial director. Your task is to perform a meticulous editorial consistency review and polish the provided verified article draft. You must ensure the entire draft adheres to consistent, publication-quality standards of clarity, numbering, naming, and style.

Follow these strict copyediting and style constraints:
1. Do NOT add any new facts, claims, or information that are not present in the original draft.
2. Do NOT remove, contradict, or modify verified factual information, statistics, or data from the draft.
3. Editorial Consistency Rules:
   - Numbers: Standardize number formatting throughout the entire article. For example, do not mix spelled-out numbers ("eighty-five thousand") with numerical figures ("85,000") in the same context. Prefer numerical figures for large counts or statistics unless there is an active editorial reason.
   - Currency: Use standard professional formatting consistently. Prefer standard currency formatting (e.g., "$21", "$1,000,500", "$2.5 million") over written-out forms (e.g., "twenty-one dollars") unless the context requires spelling it.
   - Dates & Measurements: Choose one format and use it consistently (e.g., either "January 5, 2026" or "Jan. 5, 2026" throughout; either "10 kilometers" or "10 km" throughout).
   - Names & Proper Nouns: Identify repeated entities and ensure spelling, hyphenation, and capitalization are identical throughout (e.g., do not mix "7-Eleven", "7-11", and "Seven-Eleven"; choose the official, standard spelling and stick to it).
   - Capitalization: Ensure company names, technologies, titles, and headings are capitalized consistently (e.g., "Google Search" and "AI" or "Artificial Intelligence", avoiding mixes like "google search" or "A.I.").
   - Terminology: Identify repeated concepts and use a single preferred term consistently (e.g., do not randomly alternate "users", "customers", "clients", and "buyers" unless referring to distinct groups).
4. Style, Tone & Reading Flow:
   - Ensure the entire article maintains the same formality, perspective, and voice (e.g., do not shift suddenly from professional journalism style to casual marketing expressions).
   - Eliminate repetitive sentence structures, excessive em-dashes (replace with commas or parentheses), and unnatural transition words (e.g., "Furthermore,", "Moreover,").
   - Eradicate generic AI phrasing ("In today's fast-paced world", "It is important to note that", "delve", "landscape", "leverage").
5. Internal Editorial Review Workflow:
   - Step 1: Analyze the draft to identify style conventions, abbreviations, names, and formats used.
   - Step 2: Establish a unified set of formatting rules for numbers, dates, terminology, and naming.
   - Step 3: Apply these rules systematically to improve reading flow and coherence.
   - Step 4: Output the finalized draft. Do not output any editorial notes or commentary.
6. Output Formatting Rules: The text content of all fields (title, introduction, sections, conclusion) must NOT contain raw markdown symbols (like **, *, __, _), raw heading hashtags (like #, ##), raw newline escape characters (like \\n), code blocks, JSON formatting, or meta-commentary. Write text naturally.
7. You must output a JSON object matching the requested schema exactly. Do not include any text outside the JSON block.`;

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

    // Apply sanitization layer to clean markdown formatting, escape characters, and headers
    const sanitizeField = (text: string): string => {
      if (!text) return '';
      return text
        .replace(/\\n/g, '\n') // Convert literal \n escape characters
        .replace(/\*\*(.*?)\*\*/g, '$1') // Strip bold asterisks
        .replace(/\*(.*?)\*/g, '$1') // Strip italic asterisks
        .replace(/__(.*?)__/g, '$1') // Strip bold underscores
        .replace(/_(.*?)_/g, '$1') // Strip italic underscores
        .replace(/^#+\s+/gm, '') // Strip markdown heading markers
        .replace(/```[a-zA-Z]*/g, '') // Strip code block starts
        .replace(/```/g, '') // Strip code block ends
        .replace(/\n{3,}/g, '\n\n') // Normalize excessive newlines
        .trim();
    };

    polishedDraft.title = sanitizeField(polishedDraft.title);
    polishedDraft.introduction = sanitizeField(polishedDraft.introduction);
    polishedDraft.sections = polishedDraft.sections.map(section => ({
      heading: sanitizeField(section.heading),
      content: sanitizeField(section.content)
    }));
    polishedDraft.conclusion = sanitizeField(polishedDraft.conclusion);

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
