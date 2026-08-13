import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requirePermission, requireAnyPermission, notAuthenticatedResponse, unauthorizedResponse } from '@/lib/rbac-server';
import { PERMISSIONS } from '@/lib/rbac';
import { CreateMasterCabangInput } from '@/lib/supabase';

// GET /api/master-cabang - Get all active branch master data
export async function GET(request: NextRequest) {
  try {
    // Allow access for users who can view Keanggotaan, Dana Kematian, or Dana Sosial
    await requireAnyPermission([
      PERMISSIONS.VIEW_KEANGGOTAAN,
      PERMISSIONS.MANAGE_KEANGGOTAAN,
      PERMISSIONS.ACCESS_DANA_KEMATIAN,
      PERMISSIONS.ACCESS_DANA_SOCIAL,
    ]);

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const includeInactive = searchParams.get('include_inactive') === 'true';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = (page - 1) * limit;

    let query = supabase
      .from('master_cabang')
      .select('*', { count: 'exact' });

    // Search filter
    if (search) {
      query = query.or(`kode_cabang.ilike.%${search}%,nama_cabang.ilike.%${search}%`);
    }

    // Only active branches by default
    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    const { data: cabang, error, count } = await query
      .order('nama_cabang', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching master_cabang:', error);
      return NextResponse.json(
        { error: 'Failed to fetch cabang data', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: cabang || [],
      pagination: {
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error: any) {
    console.error('Error in GET /api/master-cabang:', error);

    if (error.message === 'UNAUTHORIZED') {
      return notAuthenticatedResponse();
    }
    if (error.message === 'FORBIDDEN') {
      return unauthorizedResponse('Anda tidak memiliki akses untuk melihat data cabang');
    }

    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

// POST /api/master-cabang - Create new branch master record
export async function POST(request: NextRequest) {
  try {
    // Require manage permission
    await requirePermission(PERMISSIONS.MANAGE_KEANGGOTAAN);

    const body: CreateMasterCabangInput = await request.json();

    // Validate required fields
    if (!body.kode_cabang || !body.nama_cabang) {
      return NextResponse.json(
        { error: 'Field kode_cabang and nama_cabang are required' },
        { status: 400 }
      );
    }

    // Check for duplicate kode_cabang
    const { data: existing } = await supabase
      .from('master_cabang')
      .select('id')
      .eq('kode_cabang', body.kode_cabang)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: `Kode cabang '${body.kode_cabang}' already exists` },
        { status: 409 }
      );
    }

    const { data: newCabang, error } = await supabase
      .from('master_cabang')
      .insert([{
        kode_cabang: body.kode_cabang,
        nama_cabang: body.nama_cabang,
        kelas_cabang: body.kelas_cabang || null,
        area_regional: body.area_regional || null,
        area_witel: body.area_witel || null,
        is_active: body.is_active !== undefined ? body.is_active : true,
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating master_cabang:', error);
      return NextResponse.json(
        { error: 'Failed to create cabang', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: newCabang,
      message: 'Cabang berhasil ditambahkan',
    }, { status: 201 });

  } catch (error: any) {
    console.error('Error in POST /api/master-cabang:', error);

    if (error.message === 'UNAUTHORIZED') {
      return notAuthenticatedResponse();
    }
    if (error.message === 'FORBIDDEN') {
      return unauthorizedResponse('Anda tidak memiliki akses untuk menambah data cabang');
    }

    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}