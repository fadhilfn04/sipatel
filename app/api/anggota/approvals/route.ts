import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requirePermission, notAuthenticatedResponse, unauthorizedResponse } from '@/lib/rbac-server';
import { PERMISSIONS } from '@/lib/rbac';
import { isAdminActor } from '@/lib/server/anggota-service';

/**
 * GET /api/anggota/approvals?status=menunggu&limit=50
 *
 * Daftar usulan perubahan data anggota (edit/hapus).
 * - Admin melihat seluruh usulan.
 * - Non-admin hanya melihat usulan yang ia ajukan.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requirePermission(PERMISSIONS.MANAGE_KEANGGOTAAN);
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'menunggu';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = supabase
      .from('anggota_perubahan')
      .select('*, anggota:anggota_id(id, nik, nama_anggota, nama_cabang)', { count: 'exact' })
      .order('diajukan_pada', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status !== 'all') query = query.eq('status', status);
    if (!isAdminActor(user)) query = query.eq('diajukan_oleh', user.id);

    const { data, error, count } = await query;
    if (error) {
      console.error('Error fetching anggota approvals:', error);
      return NextResponse.json({ error: 'Gagal mengambil daftar usulan', details: error.message }, { status: 500 });
    }

    return NextResponse.json({
      data: data || [],
      pagination: { total: count || 0, limit, offset },
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return notAuthenticatedResponse();
    if (error.message === 'FORBIDDEN') return unauthorizedResponse('Anda tidak memiliki akses ke approval keanggotaan');
    console.error('Error in GET /api/anggota/approvals:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan pada server' }, { status: 500 });
  }
}

/**
 * POST /api/anggota/approvals — buat usulan perubahan (opsional; PUT/DELETE
 * anggota non-admin sudah otomatis membuat usulan).
 *
 * body: { anggota_id, jenis: 'edit'|'hapus', data_usulan?, alasan? }
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission(PERMISSIONS.MANAGE_KEANGGOTAAN);
    const body = await request.json();

    const anggotaId = body?.anggota_id;
    const jenis = body?.jenis === 'hapus' ? 'hapus' : body?.jenis === 'edit' ? 'edit' : null;
    if (!anggotaId || !jenis) {
      return NextResponse.json({ error: 'anggota_id dan jenis (edit|hapus) wajib diisi.' }, { status: 400 });
    }
    if (jenis === 'edit' && (!body?.data_usulan || typeof body.data_usulan !== 'object')) {
      return NextResponse.json({ error: 'data_usulan wajib diisi untuk usulan edit.' }, { status: 400 });
    }

    const { data: existing, error: existingError } = await supabase
      .from('anggota')
      .select('*')
      .eq('id', anggotaId)
      .is('deleted_at', null)
      .single();

    if (existingError || !existing) {
      return NextResponse.json({ error: 'Anggota tidak ditemukan' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('anggota_perubahan')
      .insert({
        anggota_id: anggotaId,
        jenis,
        status: 'menunggu',
        data_sebelum: existing,
        data_usulan: jenis === 'edit' ? body.data_usulan : {},
        alasan: body?.alasan || null,
        diajukan_oleh: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating anggota approval:', error);
      return NextResponse.json({ error: 'Gagal membuat usulan', details: error.message }, { status: 500 });
    }

    return NextResponse.json({ data, message: 'Usulan perubahan menunggu persetujuan admin.' }, { status: 201 });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return notAuthenticatedResponse();
    if (error.message === 'FORBIDDEN') return unauthorizedResponse('Anda tidak memiliki akses ke approval keanggotaan');
    console.error('Error in POST /api/anggota/approvals:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan pada server' }, { status: 500 });
  }
}
