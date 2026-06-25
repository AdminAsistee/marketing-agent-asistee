import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const runId = searchParams.get('runId');

  if (!runId) {
    return NextResponse.json(
      { error: 'Missing runId query parameter.' },
      { status: 400 }
    );
  }

  try {
    const { data, error } = await supabase
      .from('agent_logs')
      .select('*')
      .eq('run_id', runId)
      .order('timestamp', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: errorMessage || 'Failed to fetch logs.' },
      { status: 500 }
    );
  }
}
