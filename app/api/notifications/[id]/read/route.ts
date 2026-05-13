import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-storage';

function getClient() {
  if (!supabaseAdmin) throw new Error('Supabase admin client not configured.');
  return supabaseAdmin;
}

// PATCH /api/notifications/[id]/read — mark single notification as read
export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const { error } = await getClient()
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ message: 'Notification marked as read' });
  } catch (error: any) {
    console.error('PATCH /api/notifications/[id]/read error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/notifications/[id] — delete a single notification
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const { error } = await getClient()
      .from('notifications')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ message: 'Notification deleted' });
  } catch (error: any) {
    console.error('DELETE /api/notifications/[id] error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
