import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-storage';
import { requirePermission, notAuthenticatedResponse, unauthorizedResponse } from '@/lib/rbac-server';
import { PERMISSIONS } from '@/lib/rbac';

function getClient() {
  if (!supabaseAdmin) throw new Error('Supabase admin client not configured. Set SUPABASE_SERVICE_ROLE_KEY.');
  return supabaseAdmin;
}

// GET /api/master-kategori-bantuan - Fetch all bantuan categories (for dropdown/reference)
export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.VIEW_KEANGGOTAAN);

    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';

    const client = getClient();

    let query = client
      .from('master_kategori_bantuan')
      .select('*')
      .order('nama_kategori', { ascending: true });

    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data: data || [] });
  } catch (error: any) {
    console.error('Error fetching master kategori bantuan:', error);

    if (error.message === 'UNAUTHORIZED') {
      return notAuthenticatedResponse();
    }
    if (error.message === 'FORBIDDEN') {
      return unauthorizedResponse('Anda tidak memiliki akses untuk melihat data kategori bantuan');
    }

    return NextResponse.json(
      { error: error.message || 'Failed to fetch master kategori bantuan' },
      { status: 500 }
    );
  }
}

// POST /api/master-kategori-bantuan - Add a new bantuan category (requires MANAGE_KEANGGOTAAN)
export async function POST(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.MANAGE_KEANGGOTAAN);

    const client = getClient();
    const body = await request.json();

    const { kode_kategori, nama_kategori, deskripsi, is_active = true } = body;

    // Validation
    if (!kode_kategori || !nama_kategori) {
      return NextResponse.json(
        { error: 'kode_kategori and nama_kategori are required' },
        { status: 400 }
      );
    }

    // Check if kode_kategori already exists
    const { data: existing } = await client
      .from('master_kategori_bantuan')
      .select('kode_kategori')
      .eq('kode_kategori', kode_kategori)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: `Kategori with kode_kategori "${kode_kategori}" already exists` },
        { status: 400 }
      );
    }

    // Create new kategori bantuan
    const { data, error } = await client
      .from('master_kategori_bantuan')
      .insert({
        kode_kategori: kode_kategori.toUpperCase().replace(/\s+/g, '_'),
        nama_kategori: nama_kategori.trim(),
        deskripsi,
        is_active,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      message: 'Kategori bantuan created successfully',
      data,
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating master kategori bantuan:', error);

    if (error.message === 'UNAUTHORIZED') {
      return notAuthenticatedResponse();
    }
    if (error.message === 'FORBIDDEN') {
      return unauthorizedResponse('Anda tidak memiliki akses untuk menambah data kategori bantuan');
    }

    return NextResponse.json(
      { error: error.message || 'Failed to create master kategori bantuan' },
      { status: 500 }
    );
  }
}

// PUT /api/master-kategori-bantuan - Update a bantuan category (requires MANAGE_KEANGGOTAAN)
export async function PUT(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.MANAGE_KEANGGOTAAN);

    const client = getClient();
    const body = await request.json();

    const { id, kode_kategori, nama_kategori, deskripsi, is_active } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Kategori id is required' },
        { status: 400 }
      );
    }

    // Check if kategori exists
    const { data: existing } = await client
      .from('master_kategori_bantuan')
      .select('*')
      .eq('id', id)
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: 'Kategori bantuan not found' },
        { status: 404 }
      );
    }

    // If updating kode_kategori, check if new kode already exists
    if (kode_kategori && kode_kategori !== existing.kode_kategori) {
      const { data: duplicate } = await client
        .from('master_kategori_bantuan')
        .select('kode_kategori')
        .eq('kode_kategori', kode_kategori)
        .neq('id', id)
        .single();

      if (duplicate) {
        return NextResponse.json(
          { error: `Kategori with kode_kategori "${kode_kategori}" already exists` },
          { status: 400 }
        );
      }
    }

    // Update kategori bantuan
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (kode_kategori) updateData.kode_kategori = kode_kategori.toUpperCase().replace(/\s+/g, '_');
    if (nama_kategori) updateData.nama_kategori = nama_kategori.trim();
    if (deskripsi !== undefined) updateData.deskripsi = deskripsi;
    if (is_active !== undefined) updateData.is_active = is_active;

    const { data, error } = await client
      .from('master_kategori_bantuan')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      message: 'Kategori bantuan updated successfully',
      data,
    });
  } catch (error: any) {
    console.error('Error updating master kategori bantuan:', error);

    if (error.message === 'UNAUTHORIZED') {
      return notAuthenticatedResponse();
    }
    if (error.message === 'FORBIDDEN') {
      return unauthorizedResponse('Anda tidak memiliki akses untuk mengubah data kategori bantuan');
    }

    return NextResponse.json(
      { error: error.message || 'Failed to update master kategori bantuan' },
      { status: 500 }
    );
  }
}

// DELETE /api/master-kategori-bantuan - Soft delete a bantuan category (requires MANAGE_KEANGGOTAAN)
export async function DELETE(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.MANAGE_KEANGGOTAAN);

    const client = getClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Kategori id is required' },
        { status: 400 }
      );
    }

    // Check if kategori has anggota references
    const { data: references } = await client
      .from('anggota')
      .select('id')
      .eq('kategori_bantuan_id', id)
      .is('deleted_at', null)
      .limit(1);

    if (references && references.length > 0) {
      return NextResponse.json(
        { error: 'Cannot deactivate kategori with active anggota references. Please update anggota records first.' },
        { status: 400 }
      );
    }

    // Soft delete by setting is_active to false
    const { data, error } = await client
      .from('master_kategori_bantuan')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Kategori bantuan not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: 'Kategori bantuan deactivated successfully',
      data,
    });
  } catch (error: any) {
    console.error('Error deactivating master kategori bantuan:', error);

    if (error.message === 'UNAUTHORIZED') {
      return notAuthenticatedResponse();
    }
    if (error.message === 'FORBIDDEN') {
      return unauthorizedResponse('Anda tidak memiliki akses untuk menghapus data kategori bantuan');
    }

    return NextResponse.json(
      { error: error.message || 'Failed to deactivate master kategori bantuan' },
      { status: 500 }
    );
  }
}
