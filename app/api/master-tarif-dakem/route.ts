import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-storage';
import { requirePermission, notAuthenticatedResponse, unauthorizedResponse } from '@/lib/rbac-server';
import { PERMISSIONS } from '@/lib/rbac';

function getClient() {
  if (!supabaseAdmin) throw new Error('Supabase admin client not configured. Set SUPABASE_SERVICE_ROLE_KEY.');
  return supabaseAdmin;
}

// GET /api/master-tarif-dakem - Fetch all tariffs (for dropdown/reference)
export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.ACCESS_DANA_KEMATIAN);

    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';
    const kategoriAnggota = searchParams.get('kategori_anggota');

    const client = getClient();

    let query = client
      .from('master_tarif_dana_kematian')
      .select('*')
      .order('kategori_anggota', { ascending: true })
      .order('masa_kerja_min', { ascending: true });

    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    // Filter by kategori_anggota if specified
    if (kategoriAnggota) {
      query = query.eq('kategori_anggota', kategoriAnggota);
    }

    // Also filter by effective date
    query = query.or('tanggal_berakhir.is.null,tanggal_berakhir.gte.' + new Date().toISOString().split('T')[0]);

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data: data || [] });
  } catch (error: any) {
    console.error('Error fetching master tarif dakem:', error);

    if (error.message === 'UNAUTHORIZED') {
      return notAuthenticatedResponse();
    }
    if (error.message === 'FORBIDDEN') {
      return unauthorizedResponse('Anda tidak memiliki akses untuk melihat data tarif dana kematian');
    }

    return NextResponse.json(
      { error: error.message || 'Failed to fetch master tarif dakem' },
      { status: 500 }
    );
  }
}

// GET /api/master-tarif-dakem/applicable - Get applicable tariff for given parameters
export async function getApplicableTarif(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.ACCESS_DANA_KEMATIAN);

    const { searchParams } = new URL(request.url);
    const kategoriAnggota = searchParams.get('kategori_anggota');
    const masaKerja = searchParams.get('masa_kerja');

    if (!kategoriAnggota) {
      return NextResponse.json(
        { error: 'kategori_anggota is required' },
        { status: 400 }
      );
    }

    const client = getClient();

    // Use the helper function to get applicable tariff
    const { data, error } = await client.rpc('get_applicable_tarif', {
      p_kategori_anggota: kategoriAnggota,
      p_masa_kerja: masaKerja ? parseInt(masaKerja, 10) : null,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data });
  } catch (error: any) {
    console.error('Error getting applicable tarif:', error);

    if (error.message === 'UNAUTHORIZED') {
      return notAuthenticatedResponse();
    }
    if (error.message === 'FORBIDDEN') {
      return unauthorizedResponse('Anda tidak memiliki akses untuk melihat data tarif dana kematian');
    }

    return NextResponse.json(
      { error: error.message || 'Failed to get applicable tarif' },
      { status: 500 }
    );
  }
}

// POST /api/master-tarif-dakem - Add a new tariff (requires MANAGE_DANA_KEMATIAN)
export async function POST(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.MANAGE_DANA_KEMATIAN);

    const client = getClient();
    const body = await request.json();

    const {
      kategori_anggota,
      masa_kerja_min,
      masa_kerja_max,
      besaran_dana,
      tanggal_berlaku,
      tanggal_berakhir,
      keterangan,
      is_active = true
    } = body;

    // Validation
    if (!kategori_anggota || !besaran_dana || !tanggal_berlaku) {
      return NextResponse.json(
        { error: 'kategori_anggota, besaran_dana, and tanggal_berlaku are required' },
        { status: 400 }
      );
    }

    if (besaran_dana <= 0) {
      return NextResponse.json(
        { error: 'besaran_dana must be greater than 0' },
        { status: 400 }
      );
    }

    // Validate masa_kerja range
    if (masa_kerja_min !== undefined && masa_kerja_max !== undefined) {
      if (masa_kerja_min > masa_kerja_max) {
        return NextResponse.json(
          { error: 'masa_kerja_min cannot be greater than masa_kerja_max' },
          { status: 400 }
        );
      }
    }

    // Create new tariff
    const { data, error } = await client
      .from('master_tarif_dana_kematian')
      .insert({
        kategori_anggota,
        masa_kerja_min,
        masa_kerja_max,
        besaran_dana,
        tanggal_berlaku,
        tanggal_berakhir,
        keterangan,
        is_active,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      message: 'Tarif dana kematian created successfully',
      data,
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating master tarif dakem:', error);

    if (error.message === 'UNAUTHORIZED') {
      return notAuthenticatedResponse();
    }
    if (error.message === 'FORBIDDEN') {
      return unauthorizedResponse('Anda tidak memiliki akses untuk menambah data tarif dana kematian');
    }

    return NextResponse.json(
      { error: error.message || 'Failed to create master tarif dakem' },
      { status: 500 }
    );
  }
}

// PUT /api/master-tarif-dakem - Update a tariff (requires MANAGE_DANA_KEMATIAN)
export async function PUT(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.MANAGE_DANA_KEMATIAN);

    const client = getClient();
    const body = await request.json();

    const {
      id,
      kategori_anggota,
      masa_kerja_min,
      masa_kerja_max,
      besaran_dana,
      tanggal_berlaku,
      tanggal_berakhir,
      keterangan,
      is_active
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Tarif id is required' },
        { status: 400 }
      );
    }

    // Check if tarif exists
    const { data: existing } = await client
      .from('master_tarif_dana_kematian')
      .select('*')
      .eq('id', id)
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: 'Tarif not found' },
        { status: 404 }
      );
    }

    // Validate besaran_dana if being updated
    if (besaran_dana !== undefined && besaran_dana <= 0) {
      return NextResponse.json(
        { error: 'besaran_dana must be greater than 0' },
        { status: 400 }
      );
    }

    // Validate masa_kerja range if being updated
    if (masa_kerja_min !== undefined && masa_kerja_max !== undefined) {
      if (masa_kerja_min > masa_kerja_max) {
        return NextResponse.json(
          { error: 'masa_kerja_min cannot be greater than masa_kerja_max' },
          { status: 400 }
        );
      }
    }

    // Update tarif
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (kategori_anggota) updateData.kategori_anggota = kategori_anggota;
    if (masa_kerja_min !== undefined) updateData.masa_kerja_min = masa_kerja_min;
    if (masa_kerja_max !== undefined) updateData.masa_kerja_max = masa_kerja_max;
    if (besaran_dana !== undefined) updateData.besaran_dana = besaran_dana;
    if (tanggal_berlaku) updateData.tanggal_berlaku = tanggal_berlaku;
    if (tanggal_berakhir !== undefined) updateData.tanggal_berakhir = tanggal_berakhir;
    if (keterangan !== undefined) updateData.keterangan = keterangan;
    if (is_active !== undefined) updateData.is_active = is_active;

    const { data, error } = await client
      .from('master_tarif_dana_kematian')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      message: 'Tarif dana kematian updated successfully',
      data,
    });
  } catch (error: any) {
    console.error('Error updating master tarif dakem:', error);

    if (error.message === 'UNAUTHORIZED') {
      return notAuthenticatedResponse();
    }
    if (error.message === 'FORBIDDEN') {
      return unauthorizedResponse('Anda tidak memiliki akses untuk mengubah data tarif dana kematian');
    }

    return NextResponse.json(
      { error: error.message || 'Failed to update master tarif dakem' },
      { status: 500 }
    );
  }
}

// DELETE /api/master-tarif-dakem - Soft delete a tariff (requires MANAGE_DANA_KEMATIAN)
export async function DELETE(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.MANAGE_DANA_KEMATIAN);

    const client = getClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Tarif id is required' },
        { status: 400 }
      );
    }

    // Check if tarif is referenced by active dana_kematian records
    const { data: references } = await client
      .from('dana_kematian')
      .select('id')
      .eq('tarif_id', id)
      .is('deleted_at', null)
      .limit(1);

    if (references && references.length > 0) {
      return NextResponse.json(
        { error: 'Cannot deactivate tarif with active dana kematian references. Please set end date instead.' },
        { status: 400 }
      );
    }

    // Soft delete by setting is_active to false
    const { data, error } = await client
      .from('master_tarif_dana_kematian')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Tarif not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: 'Tarif dana kematian deactivated successfully',
      data,
    });
  } catch (error: any) {
    console.error('Error deactivating master tarif dakem:', error);

    if (error.message === 'UNAUTHORIZED') {
      return notAuthenticatedResponse();
    }
    if (error.message === 'FORBIDDEN') {
      return unauthorizedResponse('Anda tidak memiliki akses untuk menghapus data tarif dana kematian');
    }

    return NextResponse.json(
      { error: error.message || 'Failed to deactivate master tarif dakem' },
      { status: 500 }
    );
  }
}
