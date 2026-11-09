import { NextResponse } from 'next/server';
import {
  getCurrentUser,
  notAuthenticatedResponse,
} from '@/lib/rbac-server';
import { PERMISSIONS, ROLES, hasAnyPermission } from '@/lib/rbac';
import { supabaseAdmin } from '@/lib/supabase-storage';

function getClient() {
  if (!supabaseAdmin) throw new Error('Supabase admin client not configured. Set SUPABASE_SERVICE_ROLE_KEY.');
  return supabaseAdmin;
}

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return notAuthenticatedResponse();
    }

    // Dashboard minimal melihat ringkasan keanggotaan/dana kematian —
    // gunakan set permission yang sama longgarnya dengan GET /api/anggota.
    if (
      !hasAnyPermission(user, [
        PERMISSIONS.VIEW_KEANGGOTAAN,
        PERMISSIONS.ACCESS_KEANGGOTAAN,
        PERMISSIONS.MANAGE_KEANGGOTAAN,
        PERMISSIONS.ACCESS_DANA_KEMATIAN,
        PERMISSIONS.ACCESS_DANA_SOCIAL,
      ])
    ) {
      return NextResponse.json(
        { error: 'Anda tidak memiliki akses ke statistik dashboard' },
        { status: 403 },
      );
    }

    const client = getClient();

    // Scope cabang untuk non-admin (pola GET /api/anggota).
    const isAdmin = user.role?.slug === ROLES.ADMINISTRATOR;
    let cabangFilter: string | null = null;
    if (!isAdmin && user.id) {
      const { data: userAnggota } = await client
        .from('anggota')
        .select('nama_cabang')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .maybeSingle();
      cabangFilter = userAnggota?.nama_cabang || null;
    }

    const anggotaBase = client
      .from('anggota')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null);
    if (cabangFilter) anggotaBase.eq('nama_cabang', cabangFilter);

    const [
      { count: totalAnggota },
      { count: anggotaAktif },
      { count: anggotaNonAktif },
      { count: anggotaBerhenti },
      { count: anggotaMeninggal },
      { data: klaimRows },
      { count: totalDanaSosial },
    ] = await Promise.all([
      anggotaBase,
      // Status keanggotaan (siklus hidup): aktif/non_aktif/berhenti —
      // migration 032. Default 'aktif' sehingga baris lama tetap terhitung.
      cabangFilter
        ? client.from('anggota').select('*', { count: 'exact', head: true })
            .eq('status_keanggotaan', 'aktif').eq('nama_cabang', cabangFilter).is('deleted_at', null)
        : client.from('anggota').select('*', { count: 'exact', head: true })
            .eq('status_keanggotaan', 'aktif').is('deleted_at', null),
      cabangFilter
        ? client.from('anggota').select('*', { count: 'exact', head: true })
            .eq('status_keanggotaan', 'non_aktif').eq('nama_cabang', cabangFilter).is('deleted_at', null)
        : client.from('anggota').select('*', { count: 'exact', head: true })
            .eq('status_keanggotaan', 'non_aktif').is('deleted_at', null),
      cabangFilter
        ? client.from('anggota').select('*', { count: 'exact', head: true })
            .eq('status_keanggotaan', 'berhenti').eq('nama_cabang', cabangFilter).is('deleted_at', null)
        : client.from('anggota').select('*', { count: 'exact', head: true })
            .eq('status_keanggotaan', 'berhenti').is('deleted_at', null),
      cabangFilter
        ? client.from('anggota').select('*', { count: 'exact', head: true })
            .eq('status_anggota', 'meninggal').eq('nama_cabang', cabangFilter).is('deleted_at', null)
        : client.from('anggota').select('*', { count: 'exact', head: true })
            .eq('status_anggota', 'meninggal').is('deleted_at', null),
      cabangFilter
        ? client.from('dana_kematian').select('status_proses, besaran_dana_kematian')
            .eq('cabang_asal_melapor', cabangFilter).is('deleted_at', null)
        : client.from('dana_kematian').select('status_proses, besaran_dana_kematian')
            .is('deleted_at', null),
      client.from('dana_sosial').select('*', { count: 'exact', head: true }).is('deleted_at', null),
    ]);

    // Aggregate dana kematian by status
    const klaimByStatus: Record<string, number> = {};
    let totalDicairkan = 0;

    (klaimRows || []).forEach((row) => {
      const s = row.status_proses || 'unknown';
      klaimByStatus[s] = (klaimByStatus[s] || 0) + 1;
      if (s === 'selesai') {
        totalDicairkan += row.besaran_dana_kematian || 0;
      }
    });

    const totalKlaim = klaimRows?.length || 0;
    const klaimSelesai = klaimByStatus['selesai'] || 0;
    const klaimDitolak = klaimByStatus['ditolak'] || 0;
    const klaimBatal = klaimByStatus['batal'] || 0;
    const klaimAktif = totalKlaim - klaimSelesai - klaimDitolak - klaimBatal;

    return NextResponse.json({
      totalAnggota: totalAnggota || 0,
      anggotaAktif: anggotaAktif || 0,
      anggotaNonAktif: anggotaNonAktif || 0,
      anggotaBerhenti: anggotaBerhenti || 0,
      anggotaMeninggal: anggotaMeninggal || 0,
      scope: { cabang: cabangFilter, isScoped: !!cabangFilter },
      totalKlaim,
      klaimAktif,
      klaimSelesai,
      klaimDitolak,
      klaimByStatus,
      totalDicairkan,
      totalDanaSosial: totalDanaSosial || 0,
      // legacy fields kept for backward compatibility
      klaimPending: klaimAktif,
      danaSosialPending: 0,
      totalDanaSosialDicairkan: 0,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json(
      { error: message || 'Failed to fetch dashboard stats' },
      { status: 500 }
    );
  }
}
