import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { researchAgent } from '@/lib/researcher';
import { writerAgent } from '@/lib/writer';
import { factCheckerAgent } from '@/lib/factChecker';
import { stylePolisherAgent } from '@/lib/stylePolisher';
import { rubricGraderAgent } from '@/lib/rubricGrader';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';
import type { FactCheckerOutput, WriterDraft } from '@/lib/types';

export function getPrdTopic(prd: string): string {
  const lines = prd.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('# ') || trimmed.startsWith('## Title Goal') || trimmed.startsWith('Title:')) {
      return trimmed.replace(/^#\s+|## Title Goal\s+|Title:\s+/, '').trim();
    }
  }
  return prd.slice(0, 60).trim() + (prd.length > 60 ? '...' : '');
}

async function checkIfCancelled(runId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('agent_logs')
      .select('output')
      .eq('run_id', runId)
      .eq('agent_name', 'pipeline_status')
      .order('timestamp', { ascending: false });
    
    if (data && data.length > 0) {
      const latest = data[0].output as Record<string, any>;
      if (latest && latest.status === 'Cancelled') {
        return true;
      }
    }
  } catch (err) {
    console.error(`Error checking cancel status for run ${runId}:`, err);
  }
  return false;
}

export async function runPipelineInBackground(
  runId: string,
  prd: string,
  seoRecommendations: any,
  writingConfiguration?: any
) {
  const startTime = Date.now();
  const topic = getPrdTopic(prd);
  const featureType = seoRecommendations 
    ? 'SEO-optimized article generation' 
    : (prd.includes('## Original Article') || prd.includes('Optimize Existing Article')
        ? 'Optimize Existing Article'
        : 'Generate Article');
  try {
    // Step 1: Research Agent (Google Search Grounding + Telemetry Logging)
    if (await checkIfCancelled(runId)) {
      console.log(`[PIPELINE CANCELLED] Run ${runId} stopped before Research.`);
      return;
    }
    console.log(`[PIPELINE] Running Research Agent...`);
    const researchResult = await researchAgent(prd, runId);

    // Initial setup for the rollback loop
    let currentDraft: WriterDraft;
    let factCheckResult: FactCheckerOutput;
    const factCheckHistory: FactCheckerOutput[] = [];
    let retryCount = 0;
    const maxRetries = 2; // Maximum revisions (total 3 attempts)

    // Step 2: Run Initial Writer Agent Attempt
    if (await checkIfCancelled(runId)) {
      console.log(`[PIPELINE CANCELLED] Run ${runId} stopped before Writer Attempt 1.`);
      return;
    }
    console.log(`[PIPELINE] Running Writer Agent Initial Attempt (Attempt 1)...`);
    currentDraft = await writerAgent(
      prd,
      researchResult,
      runId,
      undefined,
      undefined,
      'writer_agent_attempt_1',
      { attempt: 1, max_attempts: 3, is_revision: false },
      seoRecommendations,
      writingConfiguration
    );

    // Step 3: Run Initial Fact Checker Attempt
    if (await checkIfCancelled(runId)) {
      console.log(`[PIPELINE CANCELLED] Run ${runId} stopped before Fact Checker Attempt 1.`);
      return;
    }
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
      if (await checkIfCancelled(runId)) {
        console.log(`[PIPELINE CANCELLED] Run ${runId} stopped inside loop.`);
        return;
      }
      retryCount++;
      console.log(`[PIPELINE] Fact check failed. Starting revision attempt ${retryCount}/${maxRetries}...`);

      // Run Writer Agent in Revision Mode
      if (await checkIfCancelled(runId)) return;
      currentDraft = await writerAgent(
        prd,
        researchResult,
        runId,
        currentDraft,
        factCheckResult.feedback,
        `writer_agent_revision_${retryCount}`,
        { attempt: retryCount + 1, max_attempts: 3, is_revision: true },
        seoRecommendations,
        writingConfiguration
      );

      // Run Fact Checker Agent on the revised draft
      if (await checkIfCancelled(runId)) return;
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
      if (await checkIfCancelled(runId)) {
        console.log(`[PIPELINE CANCELLED] Run ${runId} stopped before Style Polisher.`);
        return;
      }
      console.log(`[PIPELINE] Fact check passed. Running Style Polisher...`);
      finalArticle = await stylePolisherAgent(currentDraft, runId, 'style-polisher');
    } else {
      console.warn(`[PIPELINE WARNING] Fact check failed after maximum retries. Returning last draft unpolished.`);
    }

    // Run final evaluation layer (Rubric Grader)
    if (await checkIfCancelled(runId)) {
      console.log(`[PIPELINE CANCELLED] Run ${runId} stopped before Rubric Grader.`);
      return;
    }
    console.log(`[PIPELINE] Running Rubric Grader Agent...`);
    const rubricResult = await rubricGraderAgent(
      prd,
      finalArticle,
      factCheckResult,
      runId
    );

    if (await checkIfCancelled(runId)) {
      console.log(`[PIPELINE CANCELLED] Run ${runId} stopped after Rubric Grader.`);
      return;
    }

    console.log(`[PIPELINE SUCCESS] Completed generation for runId: ${runId}`);

    // Write final completed pipeline status log
    await logger.logAgentTransaction({
      run_id: runId,
      agent_name: 'pipeline_status' as any,
      input: { title: topic, feature: featureType, prdSnippet: prd.slice(0, 150), hasSeoRecs: !!seoRecommendations },
      output: { 
        status: 'Completed', 
        result: finalArticle,
        rubric: rubricResult,
        verification_status: verificationStatus,
        retry_count: retryCount
      },
      latency_ms: Date.now() - startTime
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[PIPELINE FAILURE] Background execution failed:', errorMessage);
    
    // Log failure log in agent_logs
    await logger.logAgentTransaction({
      run_id: runId,
      agent_name: 'pipeline_status' as any,
      input: { title: topic, feature: featureType, prdSnippet: prd.slice(0, 150), hasSeoRecs: !!seoRecommendations },
      output: { status: 'Failed', error: errorMessage },
      latency_ms: Date.now() - startTime
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { prd, seoRecommendations, writingConfiguration } = body;
    let runId = body.runId;

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

    // Use client-provided runId or generate a new one
    if (!runId || typeof runId !== 'string') {
      runId = crypto.randomUUID();
    }
    
    console.log(`[PIPELINE START] Starting pipeline asynchronously with runId: ${runId}`);

    const topic = getPrdTopic(prd);
    const featureType = seoRecommendations 
      ? 'SEO-optimized article generation' 
      : (prd.includes('## Original Article') || prd.includes('Optimize Existing Article')
          ? 'Optimize Existing Article'
          : 'Generate Article');

    // 1. Log the pipeline starting state to Supabase
    await logger.logAgentTransaction({
      run_id: runId,
      agent_name: 'pipeline_status' as any,
      input: { 
        title: topic, 
        feature: featureType, 
        prdSnippet: prd.slice(0, 150), 
        hasSeoRecs: !!seoRecommendations,
        writingConfiguration
      },
      output: { status: 'Running' },
      latency_ms: 0
    });

    // 2. Start the pipeline in the background (asynchronous, non-blocking)
    runPipelineInBackground(runId, prd, seoRecommendations, writingConfiguration).catch((err) => {
      console.error(`[BACKGROUND ERROR] Pipeline background process crashed:`, err);
    });

    // 3. Return immediately to the client with the runId
    return NextResponse.json({
      run_id: runId,
      status: 'Running'
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[PIPELINE ROUTE FAILURE] Execution failed:', errorMessage);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
