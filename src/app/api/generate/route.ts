import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { researchAgent } from '@/lib/researcher';
import { writerAgent } from '@/lib/writer';
import { factCheckerAgent } from '@/lib/factChecker';
import { stylePolisherAgent } from '@/lib/stylePolisher';
import { rubricGraderAgent } from '@/lib/rubricGrader';
import type { FactCheckerOutput, WriterDraft } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { prd, seoRecommendations } = body;

    // Robust validation: Check for empty or malformed inputs
    if (!prd || typeof prd !== 'string') {
      return NextResponse.json(
        { error: 'Bad Request: Missing or invalid "prd" parameter in request body.' },
        { status: 400 }
      );
    }

    // Robust validation: Check for missing environment variables
    const requiredEnv = [
      'GEMINI_API_KEY',
      'NEXT_PUBLIC_SUPABASE_URL',
    ];
    const missing = requiredEnv.filter((env) => !process.env[env]);
    if (missing.length > 0) {
      console.error(`Missing required environment variables: ${missing.join(', ')}`);
      return NextResponse.json(
        { error: 'Internal Server Error: Missing required API keys or database configuration.' },
        { status: 500 }
      );
    }

    // Generate unique run_id once at the beginning of the pipeline
    const runId = crypto.randomUUID();
    console.log(`[PIPELINE START] Generating runId: ${runId}`);

    // Step 1: Research Agent (Google Search Grounding + Telemetry Logging)
    console.log(`[PIPELINE] Running Research Agent...`);
    const researchResult = await researchAgent(prd, runId);

    // Initial setup for the rollback loop
    let currentDraft: WriterDraft;
    let factCheckResult: FactCheckerOutput;
    const factCheckHistory: FactCheckerOutput[] = [];
    let retryCount = 0;
    const maxRetries = 2; // Maximum revisions (total 3 attempts)

    // Step 2: Run Initial Writer Agent Attempt
    console.log(`[PIPELINE] Running Writer Agent Initial Attempt (Attempt 1)...`);
    currentDraft = await writerAgent(
      prd,
      researchResult,
      runId,
      undefined,
      undefined,
      'writer_agent_attempt_1',
      { attempt: 1, max_attempts: 3, is_revision: false },
      seoRecommendations
    );

    // Step 3: Run Initial Fact Checker Attempt
    console.log(`[PIPELINE] Running Fact Checker Agent Initial Attempt (Attempt 1)...`);
    factCheckResult = await factCheckerAgent(
      prd,
      researchResult,
      currentDraft,
      runId,
      'fact_checker_attempt_1',
      { attempt: 1, max_attempts: 3, is_revision: false }
    );
    factCheckHistory.push(factCheckResult);

    // Rollback Loop (if Fact Checker fails)
    while (!factCheckResult.passed && retryCount < maxRetries) {
      retryCount++;
      console.log(`[PIPELINE] Fact check failed. Starting revision attempt ${retryCount}/${maxRetries}...`);

      // Run Writer Agent in Revision Mode
      currentDraft = await writerAgent(
        prd,
        researchResult,
        runId,
        currentDraft,
        factCheckResult.feedback,
        `writer_agent_revision_${retryCount}`,
        { attempt: retryCount + 1, max_attempts: 3, is_revision: true },
        seoRecommendations
      );

      // Run Fact Checker Agent on the revised draft
      factCheckResult = await factCheckerAgent(
        prd,
        researchResult,
        currentDraft,
        runId,
        `fact_checker_attempt_${retryCount + 1}`,
        { attempt: retryCount + 1, max_attempts: 3, is_revision: true }
      );
      factCheckHistory.push(factCheckResult);
    }

    let finalArticle = currentDraft;
    let verificationStatus: 'passed' | 'failed_max_retries' = 'failed_max_retries';

    if (factCheckResult.passed) {
      verificationStatus = 'passed';
      console.log(`[PIPELINE] Fact check passed. Running Style Polisher...`);
      finalArticle = await stylePolisherAgent(currentDraft, runId, 'style-polisher');
    } else {
      console.warn(`[PIPELINE WARNING] Fact check failed after maximum retries. Returning last draft unpolished.`);
    }

    // Run final evaluation layer (Rubric Grader)
    console.log(`[PIPELINE] Running Rubric Grader Agent...`);
    const rubricResult = await rubricGraderAgent(
      prd,
      finalArticle,
      factCheckResult,
      runId
    );

    console.log(`[PIPELINE SUCCESS] Completed generation for runId: ${runId}`);
    return NextResponse.json({
      run_id: runId,
      final_output: finalArticle,
      final_article: finalArticle,
      verification_status: verificationStatus,
      fact_check_history: factCheckHistory,
      retry_count: retryCount,
      rubric_grader_result: rubricResult,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[PIPELINE FAILURE] Execution failed:', errorMessage);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
