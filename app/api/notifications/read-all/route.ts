import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-storage';
import { getCurrentUser, notAuthenticatedResponse } from '@/lib/rbac-server';

function getClient() {
  if (!supabaseAdmin) throw new Error('Supabase admin client not configured.');
  return supabaseAdmin;
}

const SUPERUSER_SLUGS = ['admin', 'administrator', 'owner'];

// PATCH /api/notifications/read-all — mark all notifications as read
// Hanya menandai notifikasi yang TERLIHAT oleh role user (anti efek global).
export async function PATCH() {
  try {
    const user = await getCurrentUser();
    if (!user) return notAuthenticatedResponse();

    const roleSlug = (user.role?.slug as string) || '';
    const isSuperuser = SUPERUSER_SLUGS.includes(roleSlug);

    let query = getClient()
      .from('notifications')
      .update({ is_read: true })
      .eq('is_read', false);

    // Filter role: notifikasi untuk semua (NULL) atau yang menyasar role user.
    if (!isSuperuser && roleSlug) {
      query = query.or(`target_role_slugs.is.null,target_role_slugs.cs.{${roleSlug}}`);
    }

    const { error } = await query;

    if (error) throw error;

    return NextResponse.json({ message: 'All notifications marked as read' });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('PATCH /api/notifications/read-all error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

