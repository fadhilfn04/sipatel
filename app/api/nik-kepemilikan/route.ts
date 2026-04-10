import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET /api/nik-kepemilikan - Get all NIK kepemilikan records
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const nikId = searchParams.get('nik_id');
    const anggotaId = searchParams.get('anggota_id');
    const isCurrent = searchParams.get('is_current');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = (page - 1) * limit;

    let query = supabase
      .from('nik_kepemilikan')
      .select(`
        *,
        nik_master (
          nik
        )
      `, { count: 'exact' });

    // Filters
    if (nikId) {
      query = query.eq('nik_id', nikId);
    }
    if (anggotaId) {
      query = query.eq('anggota_id', anggotaId);
    }
    if (isCurrent === 'true') {
      query = query.eq('is_current', true);
    }

    // Get paginated data
    const { data: kepemilikan, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching nik_kepemilikan:', error);
      return NextResponse.json(
        { error: 'Failed to fetch NIK kepemilikan data', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: kepemilikan || [],
      pagination: {
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error('Unexpected error in GET /api/nik-kepemilikan:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/nik-kepemilikan - Create new NIK kepemilikan (assign NIK to heir)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.nik_id || !body.anggota_id || !body.tanggal_mulai) {
      return NextResponse.json(
        { error: 'nik_id, anggota_id, and tanggal_mulai are required' },
        { status: 400 }
      );
    }

    // If this is set as current, update previous current records to non-current
    if (body.is_current) {
      await supabase
        .from('nik_kepemilikan')
        .update({ is_current: false, tanggal_selesai: body.tanggal_mulai })
        .eq('nik_id', body.nik_id)
        .eq('is_current', true);
    }

    // Create new NIK kepemilikan
    const { data: newKepemilikan, error } = await supabase
      .from('nik_kepemilikan')
      .insert([{
        nik_id: body.nik_id,
        anggota_id: body.anggota_id,
        hubungan: body.hubungan || null,
        status: body.status || 'aktif',
        tanggal_mulai: body.tanggal_mulai,
        tanggal_selesai: body.tanggal_selesai || null,
        is_current: body.is_current !== undefined ? body.is_current : true,
      }])
      .select(`
        *,
        nik_master (
          nik
        )
      `)
      .single();

    if (error) {
      console.error('Error creating NIK kepemilikan:', error);
      return NextResponse.json(
        { error: 'Failed to create NIK kepemilikan', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: newKepemilikan,
      message: 'NIK berhasil diwariskan kepada ' + body.anggota_id,
    }, { status: 201 });

  } catch (error) {
    console.error('Unexpected error in POST /api/nik-kepemilikan:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
