import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { fetchTrends } from '@/lib/googleTrends';
import { seoOptimizerAgent } from '@/lib/seoOptimizer';
import { logger } from '@/lib/logger';

/**
 * POST endpoint to optimize an existing article.
 * Fetches keyword trends and analyzes the article via the seoOptimizerAgent.
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const runId = crypto.randomUUID();
  let targetKeyword = '';

  try {
    const body = await req.json().catch(() => ({}));
    const { article, websiteContext } = body;
    targetKeyword = body.targetKeyword;

    // Validate inputs
    if (!article || typeof article !== 'string' || !article.trim()) {
      return NextResponse.json(
        { error: 'Bad Request: Missing or invalid "article" parameter in request body.' },
        { status: 400 }
      );
    }
    if (!targetKeyword || typeof targetKeyword !== 'string' || !targetKeyword.trim()) {
      return NextResponse.json(
        { error: 'Bad Request: Missing or invalid "targetKeyword" parameter in request body.' },
        { status: 400 }
      );
    }

    // Write initial pipeline status
    await logger.logAgentTransaction({
      run_id: runId,
      agent_name: 'pipeline_status' as any,
      input: { title: targetKeyword.trim(), feature: 'Optimize Existing Article', targetKeyword: targetKeyword.trim(), websiteContext, articleSnippet: article.slice(0, 150) },
      output: { status: 'Running' },
      latency_ms: 0
    });

    // 1. Retrieve search trend data for the target keyword
    console.log(`[OPTIMIZE ROUTE] Fetching trends for: "${targetKeyword}"`);
    const trendData = await fetchTrends(targetKeyword);

    // 2. Execute the SEO Optimizer Agent
    console.log(`[OPTIMIZE ROUTE] Running SEO Optimizer Agent with runId: ${runId}`);
    const report = await seoOptimizerAgent(
      article.trim(),
      websiteContext || '',
      targetKeyword.trim(),
      trendData,
      runId
    );

    // Write completed pipeline status log
    await logger.logAgentTransaction({
      run_id: runId,
      agent_name: 'pipeline_status' as any,
      input: { title: targetKeyword.trim(), feature: 'Optimize Existing Article', targetKeyword: targetKeyword.trim(), websiteContext, articleSnippet: article.slice(0, 150) },
      output: { status: 'Completed', result: { trendData, report, article: article.trim() } },
      latency_ms: Date.now() - startTime
    });

    return NextResponse.json({
      trendData,
      report,
      run_id: runId,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[OPTIMIZE ROUTE FAILURE] Execution failed:', errorMessage);

    // Write failed pipeline status log
    await logger.logAgentTransaction({
      run_id: runId,
      agent_name: 'pipeline_status' as any,
      input: { title: targetKeyword ? targetKeyword.trim() : 'Optimization Run', feature: 'Optimize Existing Article', targetKeyword: targetKeyword || '', websiteContext: '', articleSnippet: '' },
      output: { status: 'Failed', error: errorMessage },
      latency_ms: Date.now() - startTime
    });

    return NextResponse.json(
      { error: errorMessage || 'An unexpected error occurred during SEO optimization.' },
      { status: 500 }
    );
  }
}
