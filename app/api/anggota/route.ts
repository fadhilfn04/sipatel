import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { CreateAnggotaInput, AnggotaFilter } from '@/lib/supabase';
import { requirePermission, requireAnyPermission, notAuthenticatedResponse, unauthorizedResponse } from '@/lib/rbac-server';
import { PERMISSIONS, ROLES } from '@/lib/rbac';
import { notifyAnggotaBaru } from '@/lib/server/create-notification';
import {
  buildAnggotaCreatePayload,
  isAdminActor,
} from '@/lib/server/anggota-service';

// GET /api/anggota - Get all members with filtering and pagination
export async function GET(request: NextRequest) {
    // Check permission - allow access for Keanggotaan (view & manage), Dana Kematian, or Dana Sosial access
    const user = await requireAnyPermission([
      PERMISSIONS.VIEW_KEANGGOTAAN,
      PERMISSIONS.MANAGE_KEANGGOTAAN,
      PERMISSIONS.ACCESS_DANA_KEMATIAN,
      PERMISSIONS.ACCESS_DANA_SOCIAL,
    ]);

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const kategori_anggota = searchParams.get('kategori_anggota') || 'all';
    const status_anggota = searchParams.get('status_anggota') || 'all';
    const status_mps = searchParams.get('status_mps') || 'all';
    const status_iuran = searchParams.get('status_iuran') || 'all';
    let nama_cabang = searchParams.get('nama_cabang') || 'all';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = (page - 1) * limit;
    const sortColumn = searchParams.get('sortColumn') || 'created_at';
    const sortDirection = searchParams.get('sortDirection') || 'desc';

    // Check if user is admin
    const isAdmin = user?.role?.slug === ROLES.ADMINISTRATOR;

    // If not admin, get user's cabang from their anggota record and auto-filter
    if (!isAdmin && user?.id) {
      const { data: userAnggota } = await supabase
        .from('anggota')
        .select('nama_cabang')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .single();

      // If user has an anggota record with a cabang, filter by it
      if (userAnggota?.nama_cabang) {
        nama_cabang = userAnggota.nama_cabang;
      }
    }

    let query = supabase
      .from('anggota')
      .select('*', { count: 'exact' })
      .is('deleted_at', null);

    // Search filter
    if (search) {
      query = query.or(`nama_anggota.ilike.%${search}%,nik.ilike.%${search}%,nama_cabang.ilike.%${search}%`);
    }

    // Status filters
    if (kategori_anggota !== 'all') {
      query = query.eq('kategori_anggota', kategori_anggota);
    }
    if (status_anggota !== 'all') {
      query = query.eq('status_anggota', status_anggota);
    }
    if (status_mps !== 'all') {
      query = query.eq('status_mps', status_mps);
    }
    if (status_iuran !== 'all') {
      query = query.eq('status_iuran', status_iuran);
    }
    if (nama_cabang !== 'all') {
      query = query.eq('nama_cabang', nama_cabang);
    }

    // Get paginated data with sorting
    const { data: anggota, error, count } = await query
      .order(sortColumn, { ascending: sortDirection === 'asc' })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching anggota:', error);
      return NextResponse.json(
        { error: 'Failed to fetch anggota data', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: anggota || [],
      pagination: {
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error: any) {
    console.error('Error in GET /api/anggota:', error);

    // Handle permission errors
    if (error.message === 'UNAUTHORIZED') {
      return notAuthenticatedResponse();
    }
    if (error.message === 'FORBIDDEN') {
      return unauthorizedResponse('Anda tidak memiliki akses untuk melihat data anggota');
    }

    return NextResponse.json(
      { error: 'Terjadi kesalahan pada server', details: error.message },
      { status: 500 }
    );
  }
}

// POST /api/anggota - Create new member
export async function POST(request: NextRequest) {
    // Check permission
    const user = await requirePermission(PERMISSIONS.MANAGE_KEANGGOTAAN);

  try {
    const body: CreateAnggotaInput = await request.json();

    // Validate only the 3 truly required fields
    const requiredFields = ['nik', 'nama_anggota', 'nama_cabang'];

    for (const field of requiredFields) {
      if (!body[field as keyof CreateAnggotaInput]) {
        return NextResponse.json(
          { error: `Field '${field}' is required` },
          { status: 400 }
        );
      }
    }

    // Check for duplicate NIK
    const { data: existingNik } = await supabase
      .from('anggota')
      .select('id')
      .eq('nik', body.nik)
      .is('deleted_at', null)
      .single();

    if (existingNik) {
      return NextResponse.json(
        { error: 'NIK already exists' },
        { status: 409 }
      );
    }

    // ── Approval pembuatan anggota ─────────────────────────────────
    // Create oleh non-admin → buat usulan approval; data utama TIDAK dibuat
    // sampai disetujui admin. Admin (penyetuju) dapat langsung membuat.
    if (!isAdminActor(user)) {
      const { error: proposalError } = await supabase
        .from('anggota_perubahan')
        .insert({
          anggota_id: null,
          jenis: 'create',
          status: 'menunggu',
          data_sebelum: null,
          data_usulan: body,
          alasan: (body as any).alasan_perubahan || null,
          diajukan_oleh: user.id,
        });

      if (proposalError) {
        console.error('Error creating anggota create approval:', proposalError);
        return NextResponse.json(
          { error: 'Gagal membuat usulan penambahan anggota', details: proposalError.message },
          { status: 500 }
        );
      }

      return NextResponse.json(
        { message: 'Usulan penambahan anggota menunggu persetujuan admin.', status: 'menunggu' },
        { status: 202 }
      );
    }

    // Admin: buat langsung.
    const { data: newAnggota, error } = await supabase
      .from('anggota')
      .insert([buildAnggotaCreatePayload(body)])
      .select()
      .single();

    if (error) {
      console.error('Error creating anggota:', error);
      return NextResponse.json(
        { error: 'Failed to create anggota', details: error.message },
        { status: 500 }
      );
    }

    // Fire notification (non-blocking)
    notifyAnggotaBaru(newAnggota.id, newAnggota.nama_anggota, newAnggota.nama_cabang ?? '');

    return NextResponse.json({
      data: newAnggota,
      message: 'Anggota berhasil ditambahkan',
    }, { status: 201 });

  } catch (error: any) {
    console.error('Error in POST /api/anggota:', error);

    // Handle permission errors
    if (error.message === 'UNAUTHORIZED') {
      return notAuthenticatedResponse();
    }
    if (error.message === 'FORBIDDEN') {
      return unauthorizedResponse('Anda tidak memiliki akses untuk menambah data anggota');
    }

    return NextResponse.json(
      { error: 'Terjadi kesalahan pada server', details: error.message },
      { status: 500 }
    );
  }
}