import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Force dynamic execution to bypass build-time caching
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const feature = searchParams.get('feature');
    const limitParam = searchParams.get('limit');
    const pageParam = searchParams.get('page');
    const userId = searchParams.get('userId');

    if (!userId) {
      // Enforce strict privacy user isolation: return empty array if no userId is queried
      return NextResponse.json([]);
    }

    let query = supabase
      .from('agent_logs')
      .select('*')
      .eq('agent_name', 'pipeline_status')
      .eq('input->>userId', userId)
      .order('timestamp', { ascending: false });

    const limit = limitParam ? parseInt(limitParam, 10) : null;
    const page = pageParam ? parseInt(pageParam, 10) : 1;

    // Filter by JSONB input feature value
    if (feature) {
      query = query.eq('input->>feature', feature);
    }

    // Apply pagination range if limit is provided
    if (limit && !isNaN(limit) && limit > 0) {
      const pageNum = !isNaN(page) && page > 0 ? page : 1;
      const from = (pageNum - 1) * limit;
      const to = from + limit - 1;
      query = query.range(from, to);
    }

    const { data, error } = await query;

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
