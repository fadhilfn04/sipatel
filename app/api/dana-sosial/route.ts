import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { DanaSosialFilter } from '@/lib/supabase';
import { notifyDanaSosialCreated } from '@/lib/server/create-notification';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const search = searchParams.get('search') || '';
    const jenis_bantuan = searchParams.get('jenis_bantuan') || '';
    const status_pengajuan = searchParams.get('status_pengajuan') || '';
    const status_penyaluran = searchParams.get('status_penyaluran') || '';
    const tanggal_pengajuan_from = searchParams.get('tanggal_pengajuan_from') || '';
    const tanggal_pengajuan_to = searchParams.get('tanggal_pengajuan_to') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = (page - 1) * limit;

    let query = supabase
      .from('dana_sosial')
      .select('*', { count: 'exact' })
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    // Search by nama_pemohon, nikap_pemohon, or no_telepon
    if (search) {
      query = query.or(`nama_pemohon.ilike.%${search}%,nikap_pemohon.ilike.%${search}%,no_telepon.ilike.%${search}%`);
    }

    // Filter by jenis_bantuan
    if (jenis_bantuan && jenis_bantuan !== 'all') {
      query = query.eq('jenis_bantuan', jenis_bantuan);
    }

    // Filter by status_pengajuan
    if (status_pengajuan && status_pengajuan !== 'all') {
      query = query.eq('status_pengajuan', status_pengajuan);
    }

    // Filter by status_penyaluran
    if (status_penyaluran && status_penyaluran !== 'all') {
      query = query.eq('status_penyaluran', status_penyaluran);
    }

    // Filter by tanggal_pengajuan range
    if (tanggal_pengajuan_from) {
      query = query.gte('created_at', tanggal_pengajuan_from);
    }
    if (tanggal_pengajuan_to) {
      query = query.lte('created_at', tanggal_pengajuan_to);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    const totalPages = count ? Math.ceil(count / limit) : 1;

    return NextResponse.json({
      data: data || [],
      pagination: {
        total: count || 0,
        page,
        limit,
        totalPages,
      },
    });
  } catch (error: any) {
    console.error('Error fetching dana sosial:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch dana sosial' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    const requiredFields = ['nama_pemohon', 'hubungan_pemohon', 'no_telepon', 'jenis_bantuan', 'alasan_pengajuan', 'jumlah_diajukan'];
    const missingFields = requiredFields.filter(field => !body[field]);

    if (missingFields.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missingFields.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate anggota_id if provided
    if (body.anggota_id) {
      const { data: anggota } = await supabase
        .from('anggota')
        .select('id')
        .eq('id', body.anggota_id)
        .is('deleted_at', null)
        .single();

      if (!anggota) {
        return NextResponse.json(
          { error: 'Anggota not found' },
          { status: 404 }
        );
      }
    }

    // Validate jumlah_diajukan
    if (body.jumlah_diajukan < 0) {
      return NextResponse.json(
        { error: 'Jumlah diajukan must be greater than or equal to 0' },
        { status: 400 }
      );
    }

    // Set default values
    const dataToInsert = {
      ...body,
      status_pengajuan: body.status_pengajuan || 'Pending',
      status_penyaluran: body.status_penyaluran || 'Belum Disalurkan',
      jumlah_disetujui: 0,
    };

    const { data, error } = await supabase
      .from('dana_sosial')
      .insert([dataToInsert])
      .select()
      .single();

    if (error) throw error;

    // Fire notification (non-blocking)
    notifyDanaSosialCreated(data.id, data.nama_pemohon, data.jenis_bantuan);

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    console.error('Error creating dana sosial:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create dana sosial' },
      { status: 500 }
    );
  }
}
