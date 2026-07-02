import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { fetchTrends } from '@/lib/googleTrends';
import { seoAgent } from '@/lib/seoAgent';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  let targetKeyword = '';
  const runId = crypto.randomUUID();
  
  try {
    const body = await req.json().catch(() => ({}));
    const { keyword, websiteContext, industry } = body;
    
    targetKeyword = keyword || body.keyword;
    
    if (!targetKeyword || typeof targetKeyword !== 'string' || !targetKeyword.trim()) {
      return NextResponse.json(
        { error: 'Bad Request: Missing or invalid "keyword" parameter.' },
        { status: 400 }
      );
    }

    // Write initial pipeline status
    await logger.logAgentTransaction({
      run_id: runId,
      agent_name: 'pipeline_status' as any,
      input: { title: targetKeyword.trim(), feature: 'SEO Intelligence', keyword: targetKeyword.trim(), websiteContext, industry },
      output: { status: 'Running' },
      latency_ms: 0
    });

    // 1. Fetch trends (will hit our trends cache!)
    console.log(`[SEO ANALYZE API] Fetching trends for: "${targetKeyword}"`);
    const trendData = await fetchTrends(targetKeyword);

    // 2. Run the SEO Agent
    console.log(`[SEO ANALYZE API] Running SEO Agent...`);
    const recommendations = await seoAgent(
      targetKeyword.trim(),
      websiteContext || '',
      trendData,
      runId
    );

    // Write completed pipeline status log
    await logger.logAgentTransaction({
      run_id: runId,
      agent_name: 'pipeline_status' as any,
      input: { title: targetKeyword.trim(), feature: 'SEO Intelligence', keyword: targetKeyword.trim(), websiteContext, industry },
      output: { status: 'Completed', result: { trendData, recommendations } },
      latency_ms: Date.now() - startTime
    });

    return NextResponse.json({
      keywords: [recommendations.primaryKeyword, ...(recommendations.secondaryKeywords || [])],
      trends: trendData.relatedQueries || [],
      recommendations: recommendations,
      trendData: trendData
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[SEO ANALYZE API FAILURE] Execution failed:', errorMessage);

    // Write failed pipeline status log
    await logger.logAgentTransaction({
      run_id: runId,
      agent_name: 'pipeline_status' as any,
      input: { title: targetKeyword ? targetKeyword.trim() : 'SEO Search', feature: 'SEO Intelligence', keyword: targetKeyword || '', websiteContext: '' },
      output: { status: 'Failed', error: errorMessage },
      latency_ms: Date.now() - startTime
    });

    return NextResponse.json(
      { error: errorMessage || 'An unexpected error occurred during SEO analysis.' },
      { status: 500 }
    );
  }
}
