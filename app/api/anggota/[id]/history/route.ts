import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requirePermission, unauthorizedResponse } from '@/lib/rbac-server';
import { PERMISSIONS } from '@/lib/rbac';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Check permission
  const user = await requirePermission(PERMISSIONS.HISTORY_ANGGOTA_VIEW);
  if (!user) {
    return unauthorizedResponse();
  }

  try {
    const { id } = params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Fetch history for this anggota
    const { data: history, error } = await supabase
      .from('anggota_history')
      .select('*')
      .eq('anggota_id', id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching anggota history:', error);
      return NextResponse.json(
        { error: 'Failed to fetch history', details: error.message },
        { status: 500 }
      );
    }

    // Get total count
    const { count } = await supabase
      .from('anggota_history')
      .select('*', { count: 'exact', head: true })
      .eq('anggota_id', id);

    // Fetch user information for changed_by field
    const userIds = history
      .map(h => h.changed_by)
      .filter(Boolean) as string[];

    const { data: users } = await supabase
      .from('users')
      .select('id, email, full_name')
      .in('id', userIds);

    const userMap = new Map(users?.map(u => [u.id, u]));

    // Enrich history with user information
    const enrichedHistory = history.map(h => ({
      ...h,
      changed_by_user: h.changed_by ? userMap.get(h.changed_by) : null,
    }));

    return NextResponse.json({
      data: enrichedHistory,
      pagination: {
        total: count || 0,
        limit,
        offset,
      },
    });

  } catch (error: any) {
    console.error('Error in GET /api/anggota/[id]/history:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}