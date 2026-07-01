import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { fetchTrends } from '@/lib/googleTrends';
import { seoAgent } from '@/lib/seoAgent';
import { logger } from '@/lib/logger';

/**
 * POST endpoint to analyze SEO opportunities.
 * Retrieves trends via fetchTrends and executes the seoAgent to get content recommendations.
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const runId = crypto.randomUUID();
  let keyword = '';

  try {
    const body = await req.json().catch(() => ({}));
    keyword = body.keyword;
    const { websiteContext } = body;

    // Validate inputs
    if (!keyword || typeof keyword !== 'string' || !keyword.trim()) {
      return NextResponse.json(
        { error: 'Bad Request: Missing or invalid "keyword" parameter in request body.' },
        { status: 400 }
      );
    }

    // Write initial pipeline status
    await logger.logAgentTransaction({
      run_id: runId,
      agent_name: 'pipeline_status' as any,
      input: { title: keyword.trim(), feature: 'SEO Analysis' },
      output: { status: 'Running' },
      latency_ms: 0
    });

    // 1. Fetch search trend data using googleSearch grounding
    console.log(`[SEO ROUTE] Fetching trends for: "${keyword}"`);
    const trendData = await fetchTrends(keyword);

    // 2. Run the SEO analysis agent (computes target keywords, title selection, strategy)
    console.log(`[SEO ROUTE] Running SEO Agent with runId: ${runId}`);
    const recommendations = await seoAgent(
      keyword.trim(),
      websiteContext || '',
      trendData,
      runId
    );

    // Write completed pipeline status log
    await logger.logAgentTransaction({
      run_id: runId,
      agent_name: 'pipeline_status' as any,
      input: { title: keyword.trim(), feature: 'SEO Analysis' },
      output: { status: 'Completed', result: { trendData, recommendations } },
      latency_ms: Date.now() - startTime
    });

    return NextResponse.json({
      trendData,
      recommendations,
      run_id: runId,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[SEO ROUTE FAILURE] Execution failed:', errorMessage);

    // Write failed pipeline status log
    await logger.logAgentTransaction({
      run_id: runId,
      agent_name: 'pipeline_status' as any,
      input: { title: keyword ? keyword.trim() : 'SEO Search', feature: 'SEO Analysis' },
      output: { status: 'Failed', error: errorMessage },
      latency_ms: Date.now() - startTime
    });

    return NextResponse.json(
      { error: errorMessage || 'An unexpected error occurred during SEO analysis.' },
      { status: 500 }
    );
  }
}
