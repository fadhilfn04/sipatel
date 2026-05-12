import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getCurrentUser, notAuthenticatedResponse } from '@/lib/rbac-server';

// GET /api/anggota/me - Get the anggota record linked to the currently logged-in user
export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return notAuthenticatedResponse();
  }

  const { data, error } = await supabase
    .from('anggota')
    .select('*')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .single();

  if (error || !data) {
    return NextResponse.json({ data: null }, { status: 200 });
  }

  return NextResponse.json({ data });
}
