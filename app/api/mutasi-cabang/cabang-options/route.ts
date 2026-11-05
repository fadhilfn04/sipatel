import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-storage';
import { prisma } from '@/lib/prisma';
import {
  requirePermission,
  notAuthenticatedResponse,
  unauthorizedResponse,
} from '@/lib/rbac-server';
import { PERMISSIONS } from '@/lib/rbac';
import type { MutasiCabangOption } from '@/lib/supabase';

function getClient() {
  if (!supabaseAdmin) {
    throw new Error('Supabase admin client not configured. Set SUPABASE_SERVICE_ROLE_KEY.');
  }
  return supabaseAdmin;
}

/**
 * GET /api/mutasi-cabang/cabang-options
 *
 * Opsi cabang tujuan mutasi — gabungan master_cabang (aktif) dan nama cabang
 * unik dari data anggota. Dedupe case-insensitive agar pilihan tidak ganda.
 */
export async function GET(_request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.MANAGE_KEANGGOTAAN);

    const options = new Map<string, MutasiCabangOption>();

    // 1) Master cabang (single source of truth bila sudah terisi).
    try {
      const client = getClient();
      const { data: masterCabang } = await client
        .from('master_cabang')
        .select('kode_cabang, nama_cabang')
        .eq('is_active', true);

      for (const row of masterCabang || []) {
        const nama = String(row.nama_cabang || '').trim();
        if (!nama) continue;
        options.set(nama.toUpperCase(), {
          kode_cabang: row.kode_cabang ?? null,
          nama_cabang: nama,
        });
      }
    } catch (error) {
      console.error('Gagal memuat master cabang untuk opsi mutasi:', error);
    }

    // 2) Nama cabang unik dari data anggota (fallback saat master belum terisi).
    let anggotaCabang: { nama_cabang: string | null }[] = [];
    try {
      anggotaCabang = await prisma.$queryRaw<{ nama_cabang: string | null }[]>`
        SELECT DISTINCT nama_cabang
        FROM anggota
        WHERE deleted_at IS NULL
          AND nama_cabang IS NOT NULL
          AND btrim(nama_cabang) <> ''
        ORDER BY nama_cabang ASC
      `;
    } catch (error) {
      console.error('Gagal memuat nama cabang anggota:', error);
      const client = getClient();
      const { data } = await client
        .from('anggota')
        .select('nama_cabang')
        .is('deleted_at', null)
        .not('nama_cabang', 'is', null)
        .limit(5000);
      anggotaCabang = data || [];
    }

    for (const row of anggotaCabang) {
      const nama = String(row.nama_cabang || '').trim();
      if (!nama) continue;
      const key = nama.toUpperCase();
      if (!options.has(key)) {
        options.set(key, { kode_cabang: null, nama_cabang: nama });
      }
    }

    const data = Array.from(options.values()).sort((a, b) =>
      a.nama_cabang.localeCompare(b.nama_cabang, 'id', { sensitivity: 'base' }),
    );

    return NextResponse.json({ data });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return notAuthenticatedResponse();
    if (error.message === 'FORBIDDEN') {
      return unauthorizedResponse('Anda tidak memiliki akses ke menu mutasi cabang');
    }
    console.error('Error in GET /api/mutasi-cabang/cabang-options:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan pada server' }, { status: 500 });
  }
}
