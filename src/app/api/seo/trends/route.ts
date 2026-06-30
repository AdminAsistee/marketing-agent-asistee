import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { fetchTrends } from '@/lib/googleTrends';
import { seoAgent } from '@/lib/seoAgent';

/**
 * POST endpoint to analyze SEO opportunities.
 * Retrieves trends via fetchTrends and executes the seoAgent to get content recommendations.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { keyword, websiteContext } = body;

    // Validate inputs
    if (!keyword || typeof keyword !== 'string' || !keyword.trim()) {
      return NextResponse.json(
        { error: 'Bad Request: Missing or invalid "keyword" parameter in request body.' },
        { status: 400 }
      );
    }

    // 1. Fetch search trend data using googleSearch grounding
    console.log(`[SEO ROUTE] Fetching trends for: "${keyword}"`);
    const trendData = await fetchTrends(keyword);

    // 2. Run the SEO analysis agent (computes target keywords, title selection, strategy)
    const runId = crypto.randomUUID();
    console.log(`[SEO ROUTE] Running SEO Agent with runId: ${runId}`);
    const recommendations = await seoAgent(
      keyword.trim(),
      websiteContext || '',
      trendData,
      runId
    );

    return NextResponse.json({
      trendData,
      recommendations,
      run_id: runId,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[SEO ROUTE FAILURE] Execution failed:', errorMessage);
    return NextResponse.json(
      { error: errorMessage || 'An unexpected error occurred during SEO analysis.' },
      { status: 500 }
    );
  }
}
