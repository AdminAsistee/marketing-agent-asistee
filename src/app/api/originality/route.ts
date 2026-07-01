import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { originalityAgent } from '@/lib/originalityAgent';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const runId = crypto.randomUUID();

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request body.' }, { status: 400 });
  }

  const { input, websiteContext } = body as { input?: string; websiteContext?: string };

  if (!input || typeof input !== 'string' || !input.trim()) {
    return NextResponse.json(
      { error: 'Bad Request: Missing or invalid "input" parameter in request body.' },
      { status: 400 }
    );
  }

  try {
    const topic = input.slice(0, 60) + (input.length > 60 ? '...' : '');

    // Write initial pipeline status
    await logger.logAgentTransaction({
      run_id: runId,
      agent_name: 'pipeline_status' as any,
      input: { title: topic, feature: 'Originality Analysis', inputSnippet: input.slice(0, 150), websiteContext },
      output: { status: 'Running' },
      latency_ms: 0
    });

    const report = await originalityAgent(input.trim(), websiteContext || '', runId);

    // Write completed pipeline status with output payload
    await logger.logAgentTransaction({
      run_id: runId,
      agent_name: 'pipeline_status' as any,
      input: { title: topic, feature: 'Originality Analysis', inputSnippet: input.slice(0, 150), websiteContext },
      output: { status: 'Completed', result: report },
      latency_ms: Date.now() - startTime
    });

    return NextResponse.json({ report, run_id: runId });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[ORIGINALITY ROUTE FAILURE] Execution failed:', errorMessage);

    const topic = input.slice(0, 60) + (input.length > 60 ? '...' : '');

    // Write failed pipeline status
    await logger.logAgentTransaction({
      run_id: runId,
      agent_name: 'pipeline_status' as any,
      input: { title: topic, feature: 'Originality Analysis', inputSnippet: input.slice(0, 150), websiteContext: '' },
      output: { status: 'Failed', error: errorMessage },
      latency_ms: Date.now() - startTime
    });

    return NextResponse.json(
      { error: errorMessage || 'An unexpected error occurred during originality analysis.' },
      { status: 500 }
    );
  }
}
