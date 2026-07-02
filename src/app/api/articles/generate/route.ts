import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { runPipelineInBackground, getPrdTopic } from '../../generate/route';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    
    // Support standard API-First parameters
    const { topic, requirements, writingConfiguration, seoContext } = body;
    
    // Support backwards compatibility parameters (frontend)
    const prdInput = body.prd;
    const seoRecommendationsInput = body.seoRecommendations;
    
    let prd = prdInput || '';
    if (!prd && topic) {
      prd = `# Product Requirement Document (PRD)\n\n## 1. Title Goal\n${topic}\n\n## 2. Core Focus\n${requirements || topic}\n`;
    }
    
    const seoRecommendations = seoContext || seoRecommendationsInput || null;
    let runId = body.runId || crypto.randomUUID();
    
    // Robust validation
    if (!prd || typeof prd !== 'string' || !prd.trim()) {
      return NextResponse.json(
        { error: 'Bad Request: Missing or invalid "prd" or "topic" parameter.' },
        { status: 400 }
      );
    }
    
    const requiredEnv = ['GEMINI_API_KEY', 'NEXT_PUBLIC_SUPABASE_URL'];
    const missing = requiredEnv.filter((env) => !process.env[env]);
    if (missing.length > 0) {
      return NextResponse.json(
        { error: 'Internal Server Error: Missing required environment configurations.' },
        { status: 500 }
      );
    }
    
    const resolvedTopic = topic || getPrdTopic(prd);
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
        title: resolvedTopic, 
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

    // 3. Return the response matching the API-First structure
    return NextResponse.json({
      runId,
      run_id: runId,
      status: 'Running',
      article: null,
      metadata: {
        topic: resolvedTopic,
        writingConfiguration: writingConfiguration || null
      }
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: errorMessage || 'An unexpected error occurred during article generation.' },
      { status: 500 }
    );
  }
}
