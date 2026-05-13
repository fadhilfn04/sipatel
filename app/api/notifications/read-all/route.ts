import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-storage';

function getClient() {
  if (!supabaseAdmin) throw new Error('Supabase admin client not configured.');
  return supabaseAdmin;
}

// PATCH /api/notifications/read-all — mark all notifications as read
export async function PATCH() {
  try {
    const { error } = await getClient()
      .from('notifications')
      .update({ is_read: true })
      .eq('is_read', false);

    if (error) throw error;

    return NextResponse.json({ message: 'All notifications marked as read' });
  } catch (error: any) {
    console.error('PATCH /api/notifications/read-all error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
