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
      .order('timestamp', { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error('[HISTORY API ERROR] Failed to fetch from Supabase:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Filter by user ID and feature in-memory
    const filtered = (data || []).filter((log: any) => {
      const inputVal = typeof log.input === 'string' ? JSON.parse(log.input) : log.input;
      
      // Feature check
      if (feature && inputVal.feature !== feature) {
        return false;
      }
      
      // Privacy check: Legacy runs (no userId) are visible.
      // New runs are strictly isolated to their matching userId.
      return !inputVal.userId || inputVal.userId === userId || inputVal.userId === 'anonymous';
    });

    // Apply pagination in-memory
    const limit = limitParam ? parseInt(limitParam, 10) : null;
    const page = pageParam ? parseInt(pageParam, 10) : 1;
    let paginated = filtered;
    if (limit && !isNaN(limit) && limit > 0) {
      const pageNum = !isNaN(page) && page > 0 ? page : 1;
      const from = (pageNum - 1) * limit;
      const to = from + limit;
      paginated = filtered.slice(from, to);
    }

    return NextResponse.json(paginated);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('[HISTORY API EXCEPTION] GET failed:', errorMessage);
    return NextResponse.json(
      { error: errorMessage || 'Failed to fetch history logs.' },
      { status: 500 }
    );
  }
}
