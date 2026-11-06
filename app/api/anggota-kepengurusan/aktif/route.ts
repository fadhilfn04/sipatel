import { NextRequest, NextResponse } from 'next/server';
import {
  requireAnyPermission,
  notAuthenticatedResponse,
  unauthorizedResponse,
} from '@/lib/rbac-server';
import { KEPENGURUSAN_VIEW_PERMISSIONS } from '@/lib/rbac';
import { listPengurusAktif } from '@/lib/server/kepengurusan-service';

/**
 * GET /api/anggota-kepengurusan/aktif?search=&page=&limit=
 *
 * Daftar pengurus aktif (anggota dengan posisi kepengurusan) untuk langkah
 * "Pilih Pengurus" pada menu Pemberhentian Pengurus — pengurus/admin.
 * Menggabungkan posisi saat ini (tahan data legacy) dengan detail jabatan
 * aktif dari histori (periode, tanggal mulai, nomor SK) + flag pengajuan aktif.
 */
export async function GET(request: NextRequest) {
  try {
    await requireAnyPermission([...KEPENGURUSAN_VIEW_PERMISSIONS]);

    const { searchParams } = new URL(request.url);
    const search = (searchParams.get('search') || '').trim();
    const page = Math.max(parseInt(searchParams.get('page') || '1'), 1);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '20'), 1), 100);

    const result = await listPengurusAktif({ search, page, limit });

    return NextResponse.json({
      data: result.data,
      pagination: {
        total: result.total,
        page,
        limit,
        totalPages: result.total ? Math.ceil(result.total / limit) : 1,
      },
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return notAuthenticatedResponse();
    if (error.message === 'FORBIDDEN') {
      return unauthorizedResponse('Anda tidak memiliki akses ke daftar pengurus aktif');
    }
    console.error('Error in GET /api/anggota-kepengurusan/aktif:', error);
    return NextResponse.json(
      { error: 'Gagal memuat daftar pengurus aktif', details: error.message },
      { status: 500 },
    );
  }
}
