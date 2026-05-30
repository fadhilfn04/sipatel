import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-storage';

function getClient() {
  if (!supabaseAdmin) throw new Error('Supabase admin client not configured.');
  return supabaseAdmin;
}

// PUT /api/laporan-periode-dakem/[id] - Update (upload file, add catatan)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.file_laporan !== undefined) patch['file_laporan'] = body.file_laporan;
    if (body.catatan !== undefined) patch['catatan'] = body.catatan;

    const { data, error } = await getClient()
      .from('laporan_periode_dakem')
      .update(patch)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/laporan-periode-dakem/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { error } = await getClient()
      .from('laporan_periode_dakem')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: 'Laporan berhasil dihapus' });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
