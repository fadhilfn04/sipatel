import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-storage';

function getClient() {
  if (!supabaseAdmin) throw new Error('Supabase admin client not configured.');
  return supabaseAdmin;
}

// GET /api/laporan-periode-dakem/claims?periode=YYYY-MM&cabang=xxx
// Returns selesai claims whose cabang_tanggal_serah_ke_ahli_waris falls in the given month
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const periode = searchParams.get('periode'); // 'YYYY-MM'
    const cabang = searchParams.get('cabang') || '';

    if (!periode || !/^\d{4}-\d{2}$/.test(periode)) {
      return NextResponse.json({ error: 'Parameter periode wajib diisi (format: YYYY-MM)' }, { status: 400 });
    }

    const [year, month] = periode.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
    const endDate = new Date(year, month, 0).toISOString().split('T')[0]; // last day of month

    let query = getClient()
      .from('dana_kematian')
      .select('id, nama_anggota, cabang_asal_melapor, tanggal_meninggal, nama_ahli_waris, status_ahli_waris, besaran_dana_kematian, cabang_tanggal_serah_ke_ahli_waris, file_bukti_penyerahan, anggota:anggota_id(nik)')
      .eq('status_proses', 'selesai')
      .gte('cabang_tanggal_serah_ke_ahli_waris', startDate)
      .lte('cabang_tanggal_serah_ke_ahli_waris', endDate)
      .is('deleted_at', null)
      .order('cabang_tanggal_serah_ke_ahli_waris', { ascending: true });

    if (cabang) query = query.eq('cabang_asal_melapor', cabang);

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const claims = data ?? [];
    const totalDana = claims.reduce((sum: number, c: any) => sum + (c.besaran_dana_kematian || 0), 0);

    return NextResponse.json({
      data: claims,
      meta: {
        periode,
        jumlah_klaim: claims.length,
        total_dana: totalDana,
        start_date: startDate,
        end_date: endDate,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: 'Terjadi kesalahan pada server' }, { status: 500 });
  }
}
