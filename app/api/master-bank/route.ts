import { NextRequest, NextResponse } from 'next/server';
import { getActorClient } from '@/lib/supabase-actor';
import { requirePermission, notAuthenticatedResponse, unauthorizedResponse, requireAnyPermission } from '@/lib/rbac-server';
import { PERMISSIONS } from '@/lib/rbac';

async function getClient(request: NextRequest) {
  // Client dengan header aktor — audit_log mencatat pelaku (migration 036).
  return getActorClient({ request });
}

// GET /api/master-bank - Fetch all banks (for dropdown/reference)
export async function GET(request: NextRequest) {
  try {
    // Dropdown bank dipakai menu Keanggotaan (mis. Penggantian Rekening) yang
    // diguard MANAGE_KEANGGOTAAN — izinkan salah satu dari keduanya.
    await requireAnyPermission([
      PERMISSIONS.VIEW_KEANGGOTAAN,
      PERMISSIONS.MANAGE_KEANGGOTAAN,
    ]);

    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';

    const client = await getClient(request);

    let query = client
      .from('master_bank')
      .select('*')
      .order('nama_bank', { ascending: true });

    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data: data || [] });
  } catch (error: any) {
    console.error('Error fetching master banks:', error);

    if (error.message === 'UNAUTHORIZED') {
      return notAuthenticatedResponse();
    }
    if (error.message === 'FORBIDDEN') {
      return unauthorizedResponse('Anda tidak memiliki akses untuk melihat data bank');
    }

    return NextResponse.json(
      { error: error.message || 'Failed to fetch master banks' },
      { status: 500 }
    );
  }
}

// POST /api/master-bank - Add a new bank (requires MANAGE_SYSTEM)
export async function POST(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.MANAGE_SYSTEM);

    const client = await getClient(request);
    const body = await request.json();

    const { kode_bank, nama_bank, is_active = true } = body;

    // Validation
    if (!kode_bank || !nama_bank) {
      return NextResponse.json(
        { error: 'kode_bank and nama_bank are required' },
        { status: 400 }
      );
    }

    // Check if kode_bank already exists
    const { data: existing } = await client
      .from('master_bank')
      .select('kode_bank')
      .eq('kode_bank', kode_bank)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: `Bank with kode_bank "${kode_bank}" already exists` },
        { status: 400 }
      );
    }

    // Create new bank
    const { data, error } = await client
      .from('master_bank')
      .insert({
        kode_bank: kode_bank.toUpperCase(),
        nama_bank: nama_bank.trim(),
        is_active,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      message: 'Bank berhasil dibuat',
      data,
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating master bank:', error);

    if (error.message === 'UNAUTHORIZED') {
      return notAuthenticatedResponse();
    }
    if (error.message === 'FORBIDDEN') {
      return unauthorizedResponse('Anda tidak memiliki akses untuk menambah data bank');
    }

    return NextResponse.json(
      { error: error.message || 'Failed to create master bank' },
      { status: 500 }
    );
  }
}

// PUT /api/master-bank - Update a bank (requires MANAGE_SYSTEM)
export async function PUT(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.MANAGE_SYSTEM);

    const client = await getClient(request);
    const body = await request.json();

    const { id, kode_bank, nama_bank, is_active } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Bank id is required' },
        { status: 400 }
      );
    }

    // Check if bank exists
    const { data: existing } = await client
      .from('master_bank')
      .select('*')
      .eq('id', id)
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: 'Bank tidak ditemukan' },
        { status: 404 }
      );
    }

    // If updating kode_bank, check if new kode already exists
    if (kode_bank && kode_bank !== existing.kode_bank) {
      const { data: duplicate } = await client
        .from('master_bank')
        .select('kode_bank')
        .eq('kode_bank', kode_bank)
        .neq('id', id)
        .single();

      if (duplicate) {
        return NextResponse.json(
          { error: `Bank with kode_bank "${kode_bank}" already exists` },
          { status: 400 }
        );
      }
    }

    // Update bank
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (kode_bank) updateData.kode_bank = kode_bank.toUpperCase();
    if (nama_bank) updateData.nama_bank = nama_bank.trim();
    if (is_active !== undefined) updateData.is_active = is_active;

    const { data, error } = await client
      .from('master_bank')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      message: 'Bank berhasil diperbarui',
      data,
    });
  } catch (error: any) {
    console.error('Error updating master bank:', error);

    if (error.message === 'UNAUTHORIZED') {
      return notAuthenticatedResponse();
    }
    if (error.message === 'FORBIDDEN') {
      return unauthorizedResponse('Anda tidak memiliki akses untuk mengubah data bank');
    }

    return NextResponse.json(
      { error: error.message || 'Failed to update master bank' },
      { status: 500 }
    );
  }
}

// DELETE /api/master-bank - Soft delete a bank (requires MANAGE_SYSTEM)
export async function DELETE(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.MANAGE_SYSTEM);

    const client = await getClient(request);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Bank id is required' },
        { status: 400 }
      );
    }

    // Soft delete by setting is_active to false
    const { data, error } = await client
      .from('master_bank')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Bank tidak ditemukan' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: 'Bank berhasil dinonaktifkan',
      data,
    });
  } catch (error: any) {
    console.error('Error deactivating master bank:', error);

    if (error.message === 'UNAUTHORIZED') {
      return notAuthenticatedResponse();
    }
    if (error.message === 'FORBIDDEN') {
      return unauthorizedResponse('Anda tidak memiliki akses untuk menghapus data bank');
    }

    return NextResponse.json(
      { error: error.message || 'Failed to deactivate master bank' },
      { status: 500 }
    );
  }
}
