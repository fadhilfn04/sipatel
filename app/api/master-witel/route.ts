import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-storage';
import { requirePermission, notAuthenticatedResponse, unauthorizedResponse } from '@/lib/rbac-server';
import { PERMISSIONS } from '@/lib/rbac';

function getClient() {
  if (!supabaseAdmin) throw new Error('Supabase admin client not configured. Set SUPABASE_SERVICE_ROLE_KEY.');
  return supabaseAdmin;
}

// GET /api/master-witel - Fetch all witels (for dropdown/reference)
export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.VIEW_KEANGGOTAAN);

    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';
    const includeRegional = searchParams.get('includeRegional') === 'true';
    const regionalId = searchParams.get('regionalId');

    const client = getClient();

    let query = client
      .from('master_witel')
      .select(`
        *,
        ${includeRegional ? 'master_regional(id, kode_regional, nama_regional)' : ''}
      `)
      .order('nama_witel', { ascending: true });

    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    if (regionalId) {
      query = query.eq('regional_id', regionalId);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data: data || [] });
  } catch (error: any) {
    console.error('Error fetching master witels:', error);

    if (error.message === 'UNAUTHORIZED') {
      return notAuthenticatedResponse();
    }
    if (error.message === 'FORBIDDEN') {
      return unauthorizedResponse('Anda tidak memiliki akses untuk melihat data witel');
    }

    return NextResponse.json(
      { error: error.message || 'Failed to fetch master witels' },
      { status: 500 }
    );
  }
}

// POST /api/master-witel - Add a new witel (requires MANAGE_SYSTEM)
export async function POST(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.MANAGE_SYSTEM);

    const client = getClient();
    const body = await request.json();

    const { kode_witel, nama_witel, regional_id, is_active = true } = body;

    // Validation
    if (!kode_witel || !nama_witel) {
      return NextResponse.json(
        { error: 'kode_witel and nama_witel are required' },
        { status: 400 }
      );
    }

    // Validate regional_id if provided
    if (regional_id) {
      const { data: regional } = await client
        .from('master_regional')
        .select('id')
        .eq('id', regional_id)
        .eq('is_active', true)
        .single();

      if (!regional) {
        return NextResponse.json(
          { error: 'Invalid regional_id or regional is not active' },
          { status: 400 }
        );
      }
    }

    // Check if kode_witel already exists
    const { data: existing } = await client
      .from('master_witel')
      .select('kode_witel')
      .eq('kode_witel', kode_witel)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: `Witel with kode_witel "${kode_witel}" already exists` },
        { status: 400 }
      );
    }

    // Create new witel
    const { data, error } = await client
      .from('master_witel')
      .insert({
        kode_witel: kode_witel.toUpperCase(),
        nama_witel: nama_witel.trim(),
        regional_id,
        is_active,
        created_at: new Date().toISOString(),
      })
      .select(`
        *,
        master_regional(id, kode_regional, nama_regional)
      `)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      message: 'Witel created successfully',
      data,
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating master witel:', error);

    if (error.message === 'UNAUTHORIZED') {
      return notAuthenticatedResponse();
    }
    if (error.message === 'FORBIDDEN') {
      return unauthorizedResponse('Anda tidak memiliki akses untuk menambah data witel');
    }

    return NextResponse.json(
      { error: error.message || 'Failed to create master witel' },
      { status: 500 }
    );
  }
}

// PUT /api/master-witel - Update a witel (requires MANAGE_SYSTEM)
export async function PUT(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.MANAGE_SYSTEM);

    const client = getClient();
    const body = await request.json();

    const { id, kode_witel, nama_witel, regional_id, is_active } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Witel id is required' },
        { status: 400 }
      );
    }

    // Check if witel exists
    const { data: existing } = await client
      .from('master_witel')
      .select('*')
      .eq('id', id)
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: 'Witel not found' },
        { status: 404 }
      );
    }

    // If updating kode_witel, check if new kode already exists
    if (kode_witel && kode_witel !== existing.kode_witel) {
      const { data: duplicate } = await client
        .from('master_witel')
        .select('kode_witel')
        .eq('kode_witel', kode_witel)
        .neq('id', id)
        .single();

      if (duplicate) {
        return NextResponse.json(
          { error: `Witel with kode_witel "${kode_witel}" already exists` },
          { status: 400 }
        );
      }
    }

    // Validate regional_id if provided
    if (regional_id && regional_id !== existing.regional_id) {
      const { data: regional } = await client
        .from('master_regional')
        .select('id')
        .eq('id', regional_id)
        .eq('is_active', true)
        .single();

      if (!regional) {
        return NextResponse.json(
          { error: 'Invalid regional_id or regional is not active' },
          { status: 400 }
        );
      }
    }

    // Update witel
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (kode_witel) updateData.kode_witel = kode_witel.toUpperCase();
    if (nama_witel) updateData.nama_witel = nama_witel.trim();
    if (regional_id !== undefined) updateData.regional_id = regional_id || null;
    if (is_active !== undefined) updateData.is_active = is_active;

    const { data, error } = await client
      .from('master_witel')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        master_regional(id, kode_regional, nama_regional)
      `)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      message: 'Witel updated successfully',
      data,
    });
  } catch (error: any) {
    console.error('Error updating master witel:', error);

    if (error.message === 'UNAUTHORIZED') {
      return notAuthenticatedResponse();
    }
    if (error.message === 'FORBIDDEN') {
      return unauthorizedResponse('Anda tidak memiliki akses untuk mengubah data witel');
    }

    return NextResponse.json(
      { error: error.message || 'Failed to update master witel' },
      { status: 500 }
    );
  }
}

// DELETE /api/master-witel - Soft delete a witel (requires MANAGE_SYSTEM)
export async function DELETE(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.MANAGE_SYSTEM);

    const client = getClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Witel id is required' },
        { status: 400 }
      );
    }

    // Check if witel has cabang references
    const { data: references } = await client
      .from('master_cabang')
      .select('id')
      .eq('witel_id', id)
      .limit(1);

    if (references && references.length > 0) {
      return NextResponse.json(
        { error: 'Cannot deactivate witel with active cabang. Please deactivate cabang first.' },
        { status: 400 }
      );
    }

    // Soft delete by setting is_active to false
    const { data, error } = await client
      .from('master_witel')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Witel not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: 'Witel deactivated successfully',
      data,
    });
  } catch (error: any) {
    console.error('Error deactivating master witel:', error);

    if (error.message === 'UNAUTHORIZED') {
      return notAuthenticatedResponse();
    }
    if (error.message === 'FORBIDDEN') {
      return unauthorizedResponse('Anda tidak memiliki akses untuk menghapus data witel');
    }

    return NextResponse.json(
      { error: error.message || 'Failed to deactivate master witel' },
      { status: 500 }
    );
  }
}
