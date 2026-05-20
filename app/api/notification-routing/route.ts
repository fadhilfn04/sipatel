import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { supabaseAdmin } from '@/lib/supabase-storage';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';

function getClient() {
  if (!supabaseAdmin) throw new Error('Supabase admin client not configured.');
  return supabaseAdmin;
}

// GET /api/notification-routing — list all routing rules
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data, error } = await getClient()
      .from('notification_routing')
      .select('*')
      .order('event_type', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ data: data || [] });
  } catch (error: any) {
    console.error('GET /api/notification-routing error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/notification-routing — create a new routing rule
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { event_type, event_label, description, target_role_slugs, is_enabled } = body;

    if (!event_type || !event_label) {
      return NextResponse.json({ error: 'event_type and event_label are required' }, { status: 400 });
    }

    // Check if event_type already exists
    const { data: existing } = await getClient()
      .from('notification_routing')
      .select('id')
      .eq('event_type', event_type)
      .single();

    if (existing) {
      return NextResponse.json({ error: 'Event type already exists' }, { status: 409 });
    }

    const { data, error } = await getClient()
      .from('notification_routing')
      .insert({
        event_type,
        event_label,
        description: description || null,
        target_role_slugs: target_role_slugs ?? [],
        is_enabled: is_enabled ?? true,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data }, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/notification-routing error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT /api/notification-routing — bulk-update routing rules
// Body: Array<{ event_type: string; target_role_slugs: string[]; is_enabled: boolean }>
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const rules: Array<{ event_type: string; target_role_slugs: string[]; is_enabled: boolean }> = body.rules;

    if (!Array.isArray(rules)) {
      return NextResponse.json({ error: 'rules must be an array' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const updates = await Promise.all(
      rules.map(async (rule) => {
        const { data, error } = await getClient()
          .from('notification_routing')
          .update({
            target_role_slugs: rule.target_role_slugs,
            is_enabled: rule.is_enabled,
            updated_at: now,
          })
          .eq('event_type', rule.event_type)
          .select()
          .single();

        if (error) throw new Error(`Failed to update ${rule.event_type}: ${error.message}`);
        return data;
      })
    );

    return NextResponse.json({ data: updates });
  } catch (error: any) {
    console.error('PUT /api/notification-routing error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/notification-routing?event_type=xxx — delete a routing rule
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const eventType = request.nextUrl.searchParams.get('event_type');
    if (!eventType) {
      return NextResponse.json({ error: 'event_type query param is required' }, { status: 400 });
    }

    const { error } = await getClient()
      .from('notification_routing')
      .delete()
      .eq('event_type', eventType);

    if (error) throw error;

    return NextResponse.json({ message: 'Routing rule deleted' });
  } catch (error: any) {
    console.error('DELETE /api/notification-routing error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
