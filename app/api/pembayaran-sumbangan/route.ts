import { NextRequest, NextResponse } from 'next/server';
import { supabase, CreatePembayaranSumbanganInput } from '@/lib/supabase';
import { requirePermission, notAuthenticatedResponse, unauthorizedResponse } from '@/lib/rbac-server';
import { PERMISSIONS } from '@/lib/rbac';

// GET /api/pembayaran-sumbangan - Get all payments with filtering and pagination
export async function GET(request: NextRequest) {
  // Check permission
  await requirePermission(PERMISSIONS.VIEW_IURAN);

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status_pembayaran = searchParams.get('status_pembayaran') || 'all';
    const tipe_sumbangan = searchParams.get('tipe_sumbangan') || 'all';
    const tanggal_transaksi_from = searchParams.get('tanggal_transaksi_from') || '';
    const tanggal_transaksi_to = searchParams.get('tanggal_transaksi_to') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = (page - 1) * limit;

    let query = supabase
      .from('pembayaran_sumbangan')
      .select('*', { count: 'exact' })
      .is('deleted_at', null);

    // Search filter
    if (search) {
      query = query.or(`nama_anggota.ilike.%${search}%,nik.ilike.%${search}%,nomor_referensi.ilike.%${search}%`);
    }

    // Status filter
    if (status_pembayaran !== 'all') {
      query = query.eq('status_pembayaran', status_pembayaran);
    }

    // Tipe sumbangan filter
    if (tipe_sumbangan !== 'all') {
      query = query.eq('tipe_sumbangan', tipe_sumbangan);
    }

    // Date range filter
    if (tanggal_transaksi_from) {
      query = query.gte('tanggal_transaksi', tanggal_transaksi_from);
    }
    if (tanggal_transaksi_to) {
      query = query.lte('tanggal_transaksi', tanggal_transaksi_to);
    }

    // Get paginated data
    const { data: pembayaran, error, count } = await query
      .order('tanggal_transaksi', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching pembayaran sumbangan:', error);
      return NextResponse.json(
        { error: 'Failed to fetch pembayaran sumbangan data', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: pembayaran || [],
      pagination: {
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error: any) {
    console.error('Error in GET /api/pembayaran-sumbangan:', error);

    if (error.message === 'UNAUTHORIZED') {
      return notAuthenticatedResponse();
    }
    if (error.message === 'FORBIDDEN') {
      return unauthorizedResponse('Anda tidak memiliki akses untuk melihat data iuran');
    }

    return NextResponse.json(
      { error: 'Terjadi kesalahan pada server', details: error.message },
      { status: 500 }
    );
  }
}

// POST /api/pembayaran-sumbangan - Create new payment
export async function POST(request: NextRequest) {
  // Check permission
  await requirePermission(PERMISSIONS.MANAGE_IURAN);

  try {
    const body: CreatePembayaranSumbanganInput = await request.json();

    // Validate required fields
    const requiredFields = ['nama_anggota', 'tanggal_transaksi', 'jumlah_pembayaran', 'tipe_sumbangan'];

    for (const field of requiredFields) {
      if (!body[field as keyof CreatePembayaranSumbanganInput]) {
        return NextResponse.json(
          { error: `Field '${field}' is required` },
          { status: 400 }
        );
      }
    }

    // Generate unique reference number if not provided
    if (!body.nomor_referensi) {
      const timestamp = Date.now().toString(36).toUpperCase();
      const random = Math.random().toString(36).substring(2, 6).toUpperCase();
      body.nomor_referensi = `PS${timestamp}${random}`;
    }

    // Clean empty strings for optional fields (convert to null/undefined)
    const cleanedData: Record<string, any> = {
      ...body,
      // Convert empty strings to null for date fields
      tanggal_verifikasi: body.tanggal_verifikasi || null,
      diverifikasi_oleh: body.diverifikasi_oleh || null,
      catatan_verifikasi: body.catatan_verifikasi || null,
      keterangan_pembayaran: body.keterangan_pembayaran || null,
      metode_pembayaran: body.metode_pembayaran || null,
      bukti_pembayaran: body.bukti_pembayaran || null,
      nomor_referensi: body.nomor_referensi || null,
      status_pembayaran: body.status_pembayaran || 'pending',
    };

    // Create new pembayaran sumbangan
    const { data: newPembayaran, error } = await supabase
      .from('pembayaran_sumbangan')
      .insert([cleanedData])
      .select()
      .single();

    if (error) {
      console.error('Error creating pembayaran sumbangan:', error);
      return NextResponse.json(
        { error: 'Failed to create pembayaran sumbangan', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: newPembayaran,
      message: 'Pembayaran sumbangan berhasil ditambahkan',
    }, { status: 201 });

  } catch (error: any) {
    console.error('Error in POST /api/pembayaran-sumbangan:', error);

    if (error.message === 'UNAUTHORIZED') {
      return notAuthenticatedResponse();
    }
    if (error.message === 'FORBIDDEN') {
      return unauthorizedResponse('Anda tidak memiliki akses untuk menambah data iuran');
    }

    return NextResponse.json(
      { error: 'Terjadi kesalahan pada server', details: error.message },
      { status: 500 }
    );
  }
}
