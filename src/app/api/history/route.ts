import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Force dynamic execution to bypass build-time caching
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { data, error } = await supabase
      .from('agent_logs')
      .select('*')
      .eq('agent_name', 'pipeline_status')
      .order('timestamp', { ascending: false });

    if (error) {
      console.error('[HISTORY API ERROR] Failed to fetch from Supabase:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('[HISTORY API EXCEPTION] GET failed:', errorMessage);
    return NextResponse.json(
      { error: errorMessage || 'Failed to fetch history logs.' },
      { status: 500 }
    );
  }
}
