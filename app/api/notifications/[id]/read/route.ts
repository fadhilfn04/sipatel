import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-storage';
import { getCurrentUser, notAuthenticatedResponse, unauthorizedResponse } from '@/lib/rbac-server';

function getClient() {
  if (!supabaseAdmin) throw new Error('Supabase admin client not configured.');
  return supabaseAdmin;
}

const SUPERUSER_SLUGS = ['admin', 'administrator', 'owner'];

/**
 * Pastikan notifikasi terlihat oleh role user:
 *  - superuser → selalu boleh
 *  - target_role_slugs NULL/[] → untuk semua role
 *  - selain itu → harus memuat role user
 */
async function canAccessNotification(id: string) {
  const user = await getCurrentUser();
  if (!user) return { error: notAuthenticatedResponse() };

  const roleSlug = (user.role?.slug as string) || '';
  const isSuperuser = SUPERUSER_SLUGS.includes(roleSlug);

  const { data: notif, error } = await getClient()
    .from('notifications')
    .select('id, target_role_slugs')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (!notif) {
    return { error: NextResponse.json({ error: 'Notifikasi tidak ditemukan' }, { status: 404 }) };
  }

  if (!isSuperuser) {
    const targets: string[] | null = notif.target_role_slugs;
    const visible = !targets || targets.length === 0 || (roleSlug && targets.includes(roleSlug));
    if (!visible) {
      return { error: unauthorizedResponse('Anda tidak memiliki akses ke notifikasi ini') };
    }
  }

  return { error: null };
}

// PATCH /api/notifications/[id]/read — mark single notification as read
export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const access = await canAccessNotification(id);
    if (access.error) return access.error;

    const { error } = await getClient()
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ message: 'Notification marked as read' });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('PATCH /api/notifications/[id]/read error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/notifications/[id] — delete a single notification
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const access = await canAccessNotification(id);
    if (access.error) return access.error;

    const { error } = await getClient()
      .from('notifications')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ message: 'Notification deleted' });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('DELETE /api/notifications/[id] error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

