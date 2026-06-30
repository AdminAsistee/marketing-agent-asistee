import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { fetchTrends } from '@/lib/googleTrends';
import { seoOptimizerAgent } from '@/lib/seoOptimizer';

/**
 * POST endpoint to optimize an existing article.
 * Fetches keyword trends and analyzes the article via the seoOptimizerAgent.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { article, websiteContext, targetKeyword } = body;

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

    // 1. Retrieve search trend data for the target keyword
    console.log(`[OPTIMIZE ROUTE] Fetching trends for: "${targetKeyword}"`);
    const trendData = await fetchTrends(targetKeyword);

    // 2. Execute the SEO Optimizer Agent
    const runId = crypto.randomUUID();
    console.log(`[OPTIMIZE ROUTE] Running SEO Optimizer Agent with runId: ${runId}`);
    const report = await seoOptimizerAgent(
      article.trim(),
      websiteContext || '',
      targetKeyword.trim(),
      trendData,
      runId
    );

    return NextResponse.json({
      trendData,
      report,
      run_id: runId,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[OPTIMIZE ROUTE FAILURE] Execution failed:', errorMessage);
    return NextResponse.json(
      { error: errorMessage || 'An unexpected error occurred during SEO optimization.' },
      { status: 500 }
    );
  }
}
