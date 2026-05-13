import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-storage';

function getClient() {
  if (!supabaseAdmin) throw new Error('Supabase admin client not configured. Set SUPABASE_SERVICE_ROLE_KEY.');
  return supabaseAdmin;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || 'both';
    const limit = parseInt(searchParams.get('limit') || '5');

    const client = getClient();
    const data: any = {};

    if (type === 'anggota' || type === 'both') {
      const { data: latestAnggota } = await client
        .from('anggota')
        .select('id, nama_anggota, nik, status_anggota, nama_cabang, created_at')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(limit);

      data.anggota = latestAnggota || [];
    }

    if (type === 'klaim' || type === 'both') {
      const { data: latestKlaim } = await client
        .from('dana_kematian')
        .select('id, nama_anggota, nama_ahli_waris, status_proses, besaran_dana_kematian, tanggal_meninggal, created_at')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(limit);

      data.klaim = latestKlaim || [];
    }

    if (type === 'sosial' || type === 'both') {
      const { data: latestSosial } = await client
        .from('dana_sosial')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(limit);

      data.sosial = latestSosial || [];
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error fetching latest data:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch latest data' },
      { status: 500 }
    );
  }
}
