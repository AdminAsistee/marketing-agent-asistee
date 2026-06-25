import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { researchAgent } from '@/lib/researcher';
import { writerAgent } from '@/lib/writer';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { prd } = body;

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

    // Step 2: Writer Agent (Structured Output + Telemetry Logging)
    console.log(`[PIPELINE] Running Writer Agent...`);
    const draftResult = await writerAgent(prd, researchResult, runId);

    console.log(`[PIPELINE SUCCESS] Completed generation for runId: ${runId}`);
    return NextResponse.json({
      run_id: runId,
      research: researchResult,
      draft: draftResult,
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
