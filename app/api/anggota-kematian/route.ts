import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-storage';
import {
  requireAnyPermission,
  notAuthenticatedResponse,
  unauthorizedResponse,
} from '@/lib/rbac-server';
import {
  ENTRY_KEMATIAN_MANAGE_PERMISSIONS,
  ENTRY_KEMATIAN_VIEW_PERMISSIONS,
} from '@/lib/rbac';
import {
  ANGGOTA_KEMATIAN_WITH_ANGGOTA_SELECT,
  hasActiveAnggotaKematian,
  markAnggotaMeninggal,
} from '@/lib/server/anggota-kematian-service';
import type { CreateAnggotaKematianInput } from '@/lib/supabase';

function getClient() {
  if (!supabaseAdmin) {
    throw new Error('Supabase admin client not configured. Set SUPABASE_SERVICE_ROLE_KEY.');
  }
  return supabaseAdmin;
}

/** Validasi tanggal meninggal: wajib, format tanggal, tidak boleh di masa depan. */
function validateTanggalMeninggal(value: unknown): string | null {
  if (!value || typeof value !== 'string' || !value.trim()) {
    return 'Tanggal meninggal wajib diisi';
  }
  const dateOnly = value.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
    return 'Format tanggal tidak valid';
  }
  const parsed = new Date(`${dateOnly}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return 'Format tanggal tidak valid';
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (parsed.getTime() > today.getTime()) {
    return 'Tanggal meninggal tidak boleh di masa depan';
  }
  return null;
}

/**
 * GET /api/anggota-kematian?search=&page=&limit=
 *
 * Daftar entry data karyawan meninggal dunia. Dapat diakses oleh pengurus
 * keanggotaan, capability Dakem PC/PP, atau permission khusus.
 */
export async function GET(request: NextRequest) {
  try {
    await requireAnyPermission([...ENTRY_KEMATIAN_VIEW_PERMISSIONS]);

    const { searchParams } = new URL(request.url);
    const search = (searchParams.get('search') || '').trim();
    const page = Math.max(parseInt(searchParams.get('page') || '1'), 1);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '10'), 1), 100);
    const offset = (page - 1) * limit;

    const client = getClient();

    let query = client
      .from('anggota_kematian')
      .select(ANGGOTA_KEMATIAN_WITH_ANGGOTA_SELECT, { count: 'exact' })
      .is('deleted_at', null)
      .order('tanggal_meninggal', { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      // Cari berdasarkan NIK/Nama anggota (relasi) — cari id anggota yang cocok.
      const { data: matchingAnggota } = await client
        .from('anggota')
        .select('id')
        .or(`nik.ilike.%${search}%,nama_anggota.ilike.%${search}%`)
        .is('deleted_at', null)
        .limit(200);

      const matchingIds = (matchingAnggota || []).map((a: { id: string }) => a.id);
      query = query.in(
        'anggota_id',
        matchingIds.length ? matchingIds : ['00000000-0000-0000-0000-000000000000'],
      );
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching anggota_kematian:', error);
      return NextResponse.json(
        { error: 'Gagal mengambil data entry meninggal dunia', details: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      data: data || [],
      pagination: {
        total: count || 0,
        page,
        limit,
        totalPages: count ? Math.ceil(count / limit) : 1,
      },
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return notAuthenticatedResponse();
    if (error.message === 'FORBIDDEN') {
      return unauthorizedResponse('Anda tidak memiliki akses ke data entry meninggal dunia');
    }
    console.error('Error in GET /api/anggota-kematian:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan pada server' }, { status: 500 });
  }
}

/**
 * POST /api/anggota-kematian
 *
 * Simpan entry kematian baru: INSERT anggota_kematian + sinkronisasi
 * anggota.status_anggota = 'meninggal'. Entry ini TIDAK membuat pengajuan
 * Dana Kematian. Tanpa workflow approval (dicatat langsung).
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAnyPermission([...ENTRY_KEMATIAN_MANAGE_PERMISSIONS]);

    const body: CreateAnggotaKematianInput = await request.json();

    if (!body?.anggota_id) {
      return NextResponse.json({ error: 'Anggota wajib dipilih' }, { status: 400 });
    }

    const tanggalError = validateTanggalMeninggal(body.tanggal_meninggal);
    if (tanggalError) {
      return NextResponse.json({ error: tanggalError }, { status: 400 });
    }

    const client = getClient();

    // Anggota harus terdaftar & belum dihapus.
    const { data: anggota, error: anggotaError } = await client
      .from('anggota')
      .select('id, status_anggota')
      .eq('id', body.anggota_id)
      .is('deleted_at', null)
      .maybeSingle();

    if (anggotaError) {
      console.error('Error fetching anggota:', anggotaError);
      return NextResponse.json(
        { error: 'Gagal memuat data anggota', details: anggotaError.message },
        { status: 500 },
      );
    }
    if (!anggota) {
      return NextResponse.json({ error: 'Anggota tidak ditemukan' }, { status: 404 });
    }

    // Cegah duplikasi fakta kematian per anggota.
    if (await hasActiveAnggotaKematian(body.anggota_id)) {
      return NextResponse.json(
        {
          error:
            'Anggota ini sudah tercatat meninggal dunia. Gunakan data yang sudah ada (edit).',
          code: 'DUPLICATE',
        },
        { status: 409 },
      );
    }

    const nowIso = new Date().toISOString();

    // Bila pernah di-soft-delete, aktifkan kembali baris tersebut agar tetap
    // satu fakta kematian per anggota (UNIQUE anggota_id).
    const { data: existingRow } = await client
      .from('anggota_kematian')
      .select('id')
      .eq('anggota_id', body.anggota_id)
      .maybeSingle();

    const payload = {
      anggota_id: body.anggota_id,
      tanggal_meninggal: String(body.tanggal_meninggal).trim().slice(0, 10),
      file_surat_kematian: body.file_surat_kematian || null,
      dicatat_oleh: user.id,
      dicatat_pada: nowIso,
      deleted_at: null,
      updated_at: nowIso,
    };

    let data: unknown;
    let error: { message: string } | null = null;

    if (existingRow) {
      const result = await client
        .from('anggota_kematian')
        .update(payload)
        .eq('id', existingRow.id)
        .select(ANGGOTA_KEMATIAN_WITH_ANGGOTA_SELECT)
        .single();
      data = result.data;
      error = result.error;
    } else {
      const result = await client
        .from('anggota_kematian')
        .insert(payload)
        .select(ANGGOTA_KEMATIAN_WITH_ANGGOTA_SELECT)
        .single();
      data = result.data;
      error = result.error;
    }

    if (error) {
      console.error('Error creating anggota_kematian:', error);
      return NextResponse.json(
        { error: 'Gagal menyimpan entry meninggal dunia', details: error.message },
        { status: 500 },
      );
    }

    // Sinkronkan status anggota → meninggal (idempotent).
    await markAnggotaMeninggal(body.anggota_id);

    return NextResponse.json(
      {
        data,
        message:
          'Data karyawan meninggal dunia berhasil dicatat dan status anggota diperbarui.',
      },
      { status: 201 },
    );
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return notAuthenticatedResponse();
    if (error.message === 'FORBIDDEN') {
      return unauthorizedResponse('Anda tidak memiliki akses untuk mencatat data meninggal dunia');
    }
    console.error('Error in POST /api/anggota-kematian:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan pada server' }, { status: 500 });
  }
}
