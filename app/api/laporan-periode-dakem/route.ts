import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { supabaseAdmin } from '@/lib/supabase-storage';
import { CreateLaporanPeriodeDakemInput } from '@/lib/supabase';

function getClient() {
  if (!supabaseAdmin) throw new Error('Supabase admin client not configured.');
  return supabaseAdmin;
}

// GET /api/laporan-periode-dakem - List all period reports
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const cabang = searchParams.get('cabang') || '';
    const periode = searchParams.get('periode') || '';

    let query = getClient()
      .from('laporan_periode_dakem')
      .select('*')
      .order('periode', { ascending: false });

    if (cabang) query = query.eq('cabang', cabang);
    if (periode) query = query.eq('periode', periode);

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: data ?? [] });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/laporan-periode-dakem - Create new period report
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const body: CreateLaporanPeriodeDakemInput = await request.json();

    if (!body.periode) {
      return NextResponse.json({ error: 'periode wajib diisi' }, { status: 400 });
    }

    // Prevent duplicate laporan for same periode + cabang
    const { data: existing } = await getClient()
      .from('laporan_periode_dakem')
      .select('id')
      .eq('periode', body.periode)
      .eq('cabang', body.cabang)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: `Laporan periode ${body.periode_label} untuk cabang ${body.cabang} sudah ada.` },
        { status: 409 }
      );
    }

    const { data, error } = await getClient()
      .from('laporan_periode_dakem')
      .insert({
        periode: body.periode,
        periode_label: body.periode_label,
        cabang: body.cabang,
        file_laporan: body.file_laporan ?? null,
        catatan: body.catatan ?? null,
        jumlah_klaim: body.jumlah_klaim,
        total_dana: body.total_dana,
        created_by: session?.user?.name ?? body.created_by ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
