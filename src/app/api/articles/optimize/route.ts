import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { fetchTrends } from '@/lib/googleTrends';
import { seoOptimizerAgent } from '@/lib/seoOptimizer';
import { researchAgent } from '@/lib/researcher';
import { writerAgent } from '@/lib/writer';
import { factCheckerAgent } from '@/lib/factChecker';
import { stylePolisherAgent } from '@/lib/stylePolisher';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const runId = crypto.randomUUID();
  let userId = 'anonymous';
  
  try {
    const body = await req.json().catch(() => ({}));
    const { article, seoContext, writingConfiguration } = body;
    userId = body.userId || 'anonymous';
    
    // Support targetKeyword directly as a fallback
    const targetKeyword = body.targetKeyword || (typeof seoContext === 'string' ? seoContext : seoContext?.primaryKeyword);
    
    if (!article || typeof article !== 'string' || !article.trim()) {
      return NextResponse.json(
        { error: 'Bad Request: Missing or invalid "article" parameter.' },
        { status: 400 }
      );
    }
    
    if (!targetKeyword || typeof targetKeyword !== 'string' || !targetKeyword.trim()) {
      return NextResponse.json(
        { error: 'Bad Request: Missing or invalid "seoContext" or "targetKeyword" parameter.' },
        { status: 400 }
      );
    }

    // Write initial pipeline status
    await logger.logAgentTransaction({
      run_id: runId,
      agent_name: 'pipeline_status' as any,
      input: { 
        title: targetKeyword.trim(), 
        feature: 'Optimize Existing Article', 
        userId: userId || 'anonymous',
        targetKeyword: targetKeyword.trim(), 
        articleSnippet: article.slice(0, 150),
        writingConfiguration
      },
      output: { status: 'Running' },
      latency_ms: 0
    });

    // 1. Retrieve search trend data for the target keyword (will hit our trends cache!)
    console.log(`[ARTICLE OPTIMIZE API] Fetching trends for: "${targetKeyword}"`);
    const trendData = await fetchTrends(targetKeyword);

    // 2. Execute the SEO Optimizer Agent to analyze the draft
    console.log(`[ARTICLE OPTIMIZE API] Running SEO Optimizer Agent...`);
    const report = await seoOptimizerAgent(
      article.trim(),
      '',
      targetKeyword.trim(),
      trendData,
      runId
    );

    // 3. Compile the PRD for the Writer Agent in optimization mode
    const customPrd = `# Product Requirement Document (PRD) / Content Spec
    
## Original Article
${article.trim()}

## SEO Analysis & Recommendations
- Primary Keyword: ${targetKeyword}
- SEO Score: ${report.seo_score || "N/A"}
- Content Gaps to Fill: ${(report.content_gaps || []).join(', ')}
`;

    // 4. Run the collaborative agent pipeline synchronously
    console.log(`[ARTICLE OPTIMIZE API] Running Research Agent...`);
    const researchResult = await researchAgent(customPrd, runId);
    
    console.log(`[ARTICLE OPTIMIZE API] Running Writer Agent in Optimization Mode...`);
    const writerDraft = await writerAgent(
      customPrd,
      researchResult,
      runId,
      undefined,
      undefined,
      'writer_agent_attempt_1',
      { attempt: 1, max_attempts: 1, is_revision: false },
      { primaryKeyword: targetKeyword, secondaryKeywords: report.missing_keywords?.map(k => k.keyword) || [] } as any,
      writingConfiguration
    );

    console.log(`[ARTICLE OPTIMIZE API] Running Fact Checker Agent...`);
    const factCheckResult = await factCheckerAgent(
      customPrd,
      researchResult,
      writerDraft,
      runId,
      'fact_checker_attempt_1'
    );

    let finalArticle = writerDraft;
    if (factCheckResult.passed) {
      console.log(`[ARTICLE OPTIMIZE API] Fact checker passed. Running Style Polisher...`);
      finalArticle = await stylePolisherAgent(writerDraft, runId, 'style-polisher');
    } else {
      console.warn(`[ARTICLE OPTIMIZE API] Fact checker failed. Returning draft unpolished.`);
    }

    // Write completed pipeline status log
    await logger.logAgentTransaction({
      run_id: runId,
      agent_name: 'pipeline_status' as any,
      input: { 
        title: targetKeyword.trim(), 
        feature: 'Optimize Existing Article', 
        userId: userId || 'anonymous',
        targetKeyword: targetKeyword.trim(), 
        articleSnippet: article.slice(0, 150),
        writingConfiguration
      },
      output: { status: 'Completed', result: finalArticle },
      latency_ms: Date.now() - startTime
    });

    return NextResponse.json({
      analysis: report.title_analysis + '\n' + report.readability_feedback,
      recommendations: report.improvement_suggestions || [],
      optimizedArticle: finalArticle,
      trendData,
      report,
      run_id: runId,
      runId
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[ARTICLE OPTIMIZE API FAILURE] Execution failed:', errorMessage);

    // Write failed pipeline status log
    await logger.logAgentTransaction({
      run_id: runId,
      agent_name: 'pipeline_status' as any,
      input: { 
        title: 'Optimization Run', 
        feature: 'Optimize Existing Article', 
        userId: userId || 'anonymous',
        targetKeyword: '', 
        websiteContext: '', 
        articleSnippet: '' 
      },
      output: { status: 'Failed', error: errorMessage },
      latency_ms: Date.now() - startTime
    });

    return NextResponse.json(
      { error: errorMessage || 'An unexpected error occurred during SEO optimization.' },
      { status: 500 }
    );
  }
}
