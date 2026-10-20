import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-storage';
import { getDakemActorContext, getActorCabang } from '@/lib/server/dakem-enforcement';
import {
  getDakemDurationSummary,
  summarizeByCabang,
  type DakemHistoryRow,
} from '@/lib/utils/dakem-duration-summary';

function getClient() {
  if (!supabaseAdmin) throw new Error('Supabase admin client not configured. Set SUPABASE_SERVICE_ROLE_KEY.');
  return supabaseAdmin;
}

/**
 * GET /api/dana-kematian/duration
 *
 * Ringkasan durasi proses:
 *  - `?id=<uuid>` → ringkasan satu pengajuan + riwayat koreksi.
 *  - tanpa id     → rekap per cabang (agregasi durasi, tanpa skor/peringkat).
 *
 * Query opsional: `from`, `to` (filter tanggal_meninggal), `cabang`.
 * Cabang hanya dapat melihat data cabangnya sendiri.
 */
export async function GET(request: NextRequest) {
  try {
    const actor = await getDakemActorContext();
    if (!actor.userId) {
      return NextResponse.json({ error: 'Silakan login terlebih dahulu', code: 'UNAUTHORIZED' }, { status: 401 });
    }
    if (!actor.canManagePC && !actor.canVerifyPP) {
      return NextResponse.json({ error: 'Anda tidak memiliki akses ke modul Dana Kematian', code: 'PERMISSION_DENIED' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    let cabang = searchParams.get('cabang');

    // Cabang-only: paksa filter ke cabang sendiri.
    if (actor.isCabangOnly) {
      const actorCabang = await getActorCabang(actor.userId);
      cabang = actorCabang.nama_cabang || actorCabang.kode_cabang || cabang;
      if (!cabang) {
        return NextResponse.json({ error: 'User cabang tidak terhubung ke data cabang.' }, { status: 403 });
      }
    }

    const selectFields =
      'id, cabang_asal_melapor, status_proses, waktu_0, waktu_2, waktu_3, waktu_4, waktu_5, waktu_6, waktu_7, ' +
      'tanggal_lapor_keluarga, cabang_tanggal_kirim_ke_pusat, pusat_tanggal_validasi, ' +
      'cabang_tanggal_serah_ke_ahli_waris, cabang_tanggal_lapor_ke_pusat';

    // ── Ringkasan satu pengajuan ──
    if (id) {
      const { data: claim, error } = await getClient()
        .from('dana_kematian')
        .select(selectFields)
        .eq('id', id)
        .is('deleted_at', null)
        .maybeSingle();

      if (error || !claim) {
        return NextResponse.json({ error: 'Dana kematian tidak ditemukan' }, { status: 404 });
      }

      // Cabang-only: pastikan pengajuan milik cabangnya.
      if (actor.isCabangOnly && (claim as any).cabang_asal_melapor !== cabang) {
        return NextResponse.json({ error: 'Pengajuan milik cabang lain.' }, { status: 403 });
      }

      const { data: history } = await getClient()
        .from('riwayat_proses_dakem')
        .select('status_dari, status_ke, timestamp')
        .eq('dana_kematian_id', id)
        .order('timestamp', { ascending: true })
        .limit(500);

      const summary = getDakemDurationSummary(claim as any, (history || []) as DakemHistoryRow[]);
      return NextResponse.json({ data: summary, claim, history: history || [] });
    }

    // ── Rekap per cabang ──
    let query = getClient()
      .from('dana_kematian')
      .select(selectFields)
      .is('deleted_at', null);

    if (from) query = query.gte('tanggal_meninggal', from);
    if (to) query = query.lte('tanggal_meninggal', to);
    if (cabang) query = query.eq('cabang_asal_melapor', cabang);

    const { data: claims, error } = await query;
    if (error) {
      console.error('Error fetching duration data:', error);
      return NextResponse.json({ error: 'Gagal mengambil data durasi', details: error.message }, { status: 500 });
    }

    // Ambil riwayat koreksi untuk seluruh klaim (batch).
    const ids = (claims || []).map((c: any) => c.id);
    const historyByClaim: Record<string, DakemHistoryRow[]> = {};
    if (ids.length > 0) {
      const { data: historyRows } = await getClient()
        .from('riwayat_proses_dakem')
        .select('dana_kematian_id, status_dari, status_ke')
        .in('dana_kematian_id', ids);
      for (const row of historyRows || []) {
        const key = (row as any).dana_kematian_id;
        (historyByClaim[key] ||= []).push(row as DakemHistoryRow);
      }
    }

    const per_claim = (claims || []).map((c: any) => ({
      id: c.id,
      cabang_asal_melapor: c.cabang_asal_melapor,
      status_proses: c.status_proses,
      ...getDakemDurationSummary(c, historyByClaim[c.id] || []),
    }));

    return NextResponse.json({
      data: {
        per_claim,
        per_cabang: summarizeByCabang(claims as any, historyByClaim),
      },
    });
  } catch (error) {
    console.error('Error in GET /api/dana-kematian/duration:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan pada server' }, { status: 500 });
  }
}
