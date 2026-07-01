import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request body.' }, { status: 400 });
  }

  const { runId } = body as { runId?: string };

  if (!runId || typeof runId !== 'string') {
    return NextResponse.json(
      { error: 'Bad Request: Missing or invalid "runId" parameter in request body.' },
      { status: 400 }
    );
  }

  try {
    console.log(`[CANCEL ROUTE] Cancelling run: ${runId}`);
    
    // Log the cancellation event to Supabase
    await logger.logAgentTransaction({
      run_id: runId,
      agent_name: 'pipeline_status' as any,
      input: {},
      output: { status: 'Cancelled' },
      latency_ms: 0
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[CANCEL ROUTE FAILURE] Failed to cancel run ${runId}:`, errorMessage);
    return NextResponse.json(
      { error: errorMessage || 'An unexpected error occurred during cancellation.' },
      { status: 500 }
    );
  }
}
