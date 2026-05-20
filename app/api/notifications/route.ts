import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { supabaseAdmin } from '@/lib/supabase-storage';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';

function getClient() {
  if (!supabaseAdmin) throw new Error('Supabase admin client not configured.');
  return supabaseAdmin;
}

const SUPERUSER_SLUGS = ['admin', 'administrator', 'owner'];

// GET /api/notifications — list notifications filtered by current user's role
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userRoleSlug: string | undefined = (session?.user as any)?.role?.slug;
    const isSuperuser = userRoleSlug ? SUPERUSER_SLUGS.includes(userRoleSlug) : false;

    const { searchParams } = request.nextUrl;
    const unreadOnly = searchParams.get('unread') === 'true';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const category = searchParams.get('category') || '';

    // Build base query
    let query = getClient()
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (unreadOnly) query = query.eq('is_read', false);
    if (category) query = query.eq('category', category);

    // Filter by role: show if target_role_slugs is null OR contains user's role.
    // Superusers see everything.
    if (userRoleSlug && !isSuperuser) {
      query = query.or(
        `target_role_slugs.is.null,target_role_slugs.cs.{${userRoleSlug}}`
      );
    }

    const { data, error } = await query;
    if (error) throw error;

    // Unread count uses the same role filter
    let unreadCount = 0;
    if (unreadOnly) {
      unreadCount = (data || []).length;
    } else {
      let countQuery = getClient()
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('is_read', false);

      if (userRoleSlug && !isSuperuser) {
        countQuery = countQuery.or(
          `target_role_slugs.is.null,target_role_slugs.cs.{${userRoleSlug}}`
        );
      }

      const { count } = await countQuery;
      unreadCount = count ?? 0;
    }

    return NextResponse.json({
      notifications: data || [],
      unreadCount,
    });
  } catch (error: any) {
    console.error('GET /api/notifications error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/notifications — create notification (internal use)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, message, type, category, event_type, link, metadata, target_role_slugs } = body;

    if (!title || !message) {
      return NextResponse.json({ error: 'title and message are required' }, { status: 400 });
    }

    const { data, error } = await getClient()
      .from('notifications')
      .insert({
        title,
        message,
        type: type || 'info',
        category: category || 'system',
        event_type: event_type || null,
        link: link || null,
        metadata: metadata || {},
        target_role_slugs: target_role_slugs ?? null,
        is_read: false,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ notification: data }, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/notifications error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
