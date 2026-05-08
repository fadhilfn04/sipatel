import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export async function GET(request: NextRequest) {
  try {
    // Get active claims (not selesai, not ditolak)
    const { data: claims, error } = await supabase
      .from('dana_kematian')
      .select('*')
      .not('status_proses', 'in', '("selesai", "ditolak")')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) throw error;

    if (!claims) {
      return NextResponse.json([]);
    }

    // Enrich with progress and duration info
    const enrichedClaims = claims.map(claim => {
      const timelineFields = [
        claim.waktu_0,
        claim.waktu_1,
        claim.waktu_2,
        claim.waktu_3,
        claim.waktu_4,
        claim.waktu_5,
        claim.waktu_6,
        claim.waktu_7,
      ];

      const completedFields = timelineFields.filter(t => t !== null).length;
      const progress = Math.round((completedFields / timelineFields.length) * 100);

      // Calculate duration
      let totalDays = null;
      const firstTimestamp = timelineFields.find(t => t !== null);
      const lastTimestamp = [
        claim.waktu_7,
        claim.waktu_6,
        claim.waktu_5,
        claim.waktu_4,
        claim.waktu_3,
      ].find(t => t !== null);

      if (firstTimestamp && lastTimestamp) {
        const start = new Date(firstTimestamp);
        const end = new Date(lastTimestamp);
        totalDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      }

      return {
        id: claim.id,
        nama_anggota: claim.nama_anggota,
        status_proses: claim.status_proses,
        created_at: claim.created_at,
        progress,
        duration_info: {
          totalDays,
          isOverdue: false,
        },
      };
    });

    return NextResponse.json(enrichedClaims);
  } catch (error) {
    console.error('Error fetching active claims:', error);
    return NextResponse.json(
      { error: 'Failed to fetch active claims' },
      { status: 500 }
    );
  }
}
