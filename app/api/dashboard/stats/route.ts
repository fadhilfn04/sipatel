import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-storage';

function getClient() {
  if (!supabaseAdmin) throw new Error('Supabase admin client not configured. Set SUPABASE_SERVICE_ROLE_KEY.');
  return supabaseAdmin;
}

export async function GET() {
  try {
    const client = getClient();

    const [
      { count: totalAnggota },
      { count: anggotaAktif },
      { count: anggotaMeninggal },
      { data: klaimRows },
      { count: totalDanaSosial },
    ] = await Promise.all([
      client.from('anggota').select('*', { count: 'exact', head: true }).is('deleted_at', null),
      client.from('anggota').select('*', { count: 'exact', head: true }).neq('status_anggota', 'meninggal').is('deleted_at', null),
      client.from('anggota').select('*', { count: 'exact', head: true }).eq('status_anggota', 'meninggal').is('deleted_at', null),
      client.from('dana_kematian').select('status_proses, besaran_dana_kematian').is('deleted_at', null),
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
    const klaimAktif = totalKlaim - klaimSelesai - klaimDitolak;

    return NextResponse.json({
      totalAnggota: totalAnggota || 0,
      anggotaAktif: anggotaAktif || 0,
      anggotaMeninggal: anggotaMeninggal || 0,
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
  } catch (error: any) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch dashboard stats' },
      { status: 500 }
    );
  }
}
