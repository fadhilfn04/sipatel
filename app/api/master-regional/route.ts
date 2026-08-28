import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-storage';
import { requirePermission, notAuthenticatedResponse, unauthorizedResponse } from '@/lib/rbac-server';
import { PERMISSIONS } from '@/lib/rbac';

function getClient() {
  if (!supabaseAdmin) throw new Error('Supabase admin client not configured. Set SUPABASE_SERVICE_ROLE_KEY.');
  return supabaseAdmin;
}

// GET /api/master-regional - Fetch all regionals (for dropdown/reference)
export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.VIEW_KEANGGOTAAN);

    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';
    const includeWitel = searchParams.get('includeWitel') === 'true';

    const client = getClient();

    let query = client
      .from('master_regional')
      .select(`
        *,
        ${includeWitel ? 'master_witel(id, kode_witel, nama_witel, is_active)' : ''}
      `)
      .order('nama_regional', { ascending: true });

    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data: data || [] });
  } catch (error: any) {
    console.error('Error fetching master regionals:', error);

    if (error.message === 'UNAUTHORIZED') {
      return notAuthenticatedResponse();
    }
    if (error.message === 'FORBIDDEN') {
      return unauthorizedResponse('Anda tidak memiliki akses untuk melihat data regional');
    }

    return NextResponse.json(
      { error: error.message || 'Failed to fetch master regionals' },
      { status: 500 }
    );
  }
}

// POST /api/master-regional - Add a new regional (requires MANAGE_SYSTEM)
export async function POST(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.MANAGE_SYSTEM);

    const client = getClient();
    const body = await request.json();

    const { kode_regional, nama_regional, is_active = true } = body;

    // Validation
    if (!kode_regional || !nama_regional) {
      return NextResponse.json(
        { error: 'kode_regional and nama_regional are required' },
        { status: 400 }
      );
    }

    // Check if kode_regional already exists
    const { data: existing } = await client
      .from('master_regional')
      .select('kode_regional')
      .eq('kode_regional', kode_regional)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: `Regional with kode_regional "${kode_regional}" already exists` },
        { status: 400 }
      );
    }

    // Create new regional
    const { data, error } = await client
      .from('master_regional')
      .insert({
        kode_regional: kode_regional.toUpperCase(),
        nama_regional: nama_regional.trim(),
        is_active,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      message: 'Regional berhasil dibuat',
      data,
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating master regional:', error);

    if (error.message === 'UNAUTHORIZED') {
      return notAuthenticatedResponse();
    }
    if (error.message === 'FORBIDDEN') {
      return unauthorizedResponse('Anda tidak memiliki akses untuk menambah data regional');
    }

    return NextResponse.json(
      { error: error.message || 'Failed to create master regional' },
      { status: 500 }
    );
  }
}

// PUT /api/master-regional - Update a regional (requires MANAGE_SYSTEM)
export async function PUT(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.MANAGE_SYSTEM);

    const client = getClient();
    const body = await request.json();

    const { id, kode_regional, nama_regional, is_active } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Regional id is required' },
        { status: 400 }
      );
    }

    // Check if regional exists
    const { data: existing } = await client
      .from('master_regional')
      .select('*')
      .eq('id', id)
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: 'Regional tidak ditemukan' },
        { status: 404 }
      );
    }

    // If updating kode_regional, check if new kode already exists
    if (kode_regional && kode_regional !== existing.kode_regional) {
      const { data: duplicate } = await client
        .from('master_regional')
        .select('kode_regional')
        .eq('kode_regional', kode_regional)
        .neq('id', id)
        .single();

      if (duplicate) {
        return NextResponse.json(
          { error: `Regional with kode_regional "${kode_regional}" already exists` },
          { status: 400 }
        );
      }
    }

    // Update regional
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (kode_regional) updateData.kode_regional = kode_regional.toUpperCase();
    if (nama_regional) updateData.nama_regional = nama_regional.trim();
    if (is_active !== undefined) updateData.is_active = is_active;

    const { data, error } = await client
      .from('master_regional')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      message: 'Regional berhasil diperbarui',
      data,
    });
  } catch (error: any) {
    console.error('Error updating master regional:', error);

    if (error.message === 'UNAUTHORIZED') {
      return notAuthenticatedResponse();
    }
    if (error.message === 'FORBIDDEN') {
      return unauthorizedResponse('Anda tidak memiliki akses untuk mengubah data regional');
    }

    return NextResponse.json(
      { error: error.message || 'Failed to update master regional' },
      { status: 500 }
    );
  }
}

// DELETE /api/master-regional - Soft delete a regional (requires MANAGE_SYSTEM)
export async function DELETE(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.MANAGE_SYSTEM);

    const client = getClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Regional id is required' },
        { status: 400 }
      );
    }

    // Check if regional has witels or cabang references
    const { data: references } = await client
      .from('master_witel')
      .select('id')
      .eq('regional_id', id)
      .limit(1);

    if (references && references.length > 0) {
      return NextResponse.json(
        { error: 'Cannot deactivate regional with active witels. Please deactivate witels first.' },
        { status: 400 }
      );
    }

    // Soft delete by setting is_active to false
    const { data, error } = await client
      .from('master_regional')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Regional tidak ditemukan' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: 'Regional berhasil dinonaktifkan',
      data,
    });
  } catch (error: any) {
    console.error('Error deactivating master regional:', error);

    if (error.message === 'UNAUTHORIZED') {
      return notAuthenticatedResponse();
    }
    if (error.message === 'FORBIDDEN') {
      return unauthorizedResponse('Anda tidak memiliki akses untuk menghapus data regional');
    }

    return NextResponse.json(
      { error: error.message || 'Failed to deactivate master regional' },
      { status: 500 }
    );
  }
}
