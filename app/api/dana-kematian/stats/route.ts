import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getCurrentUser, notAuthenticatedResponse } from '@/lib/rbac-server';
import { PERMISSIONS, hasAnyPermission } from '@/lib/rbac';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return notAuthenticatedResponse();
    }

    // Statistik dakem hanya untuk pengguna modul Pelayanan (Dana Kematian).
    if (
      !hasAnyPermission(user, [
        PERMISSIONS.ACCESS_DANA_KEMATIAN,
        PERMISSIONS.MANAGE_DANA_KEMATIAN,
        PERMISSIONS.DAKEM_MANAGE_PC,
        PERMISSIONS.DAKEM_VERIFY_PP,
      ])
    ) {
      return NextResponse.json(
        { error: 'Anda tidak memiliki akses ke statistik dana kematian' },
        { status: 403 },
      );
    }

    // Get all claims
    const { data: claims, error } = await supabase
      .from('dana_kematian')
      .select('*')
      .is('deleted_at', null);

    if (error) throw error;

    if (!claims) {
      return NextResponse.json({
        total: 0,
        verifikasi_cabang: 0,
        proses_pusat: 0,
        verified: 0,
        ditolak: 0,
        selesai: 0,
        total_dana: 0,
        avg_duration: null,
      });
    }

    // Calculate stats
    const stats = {
      total: claims.length,
      verifikasi_cabang: claims.filter(c => c.status_proses === 'verifikasi_cabang').length,
      proses_pusat: claims.filter(c => c.status_proses === 'proses_pusat').length,
      verified: claims.filter(c => c.status_proses === 'verified').length,
      ditolak: claims.filter(c => c.status_proses === 'ditolak').length,
      selesai: claims.filter(c => c.status_proses === 'selesai').length,
      total_dana: claims
        .filter(c => c.status_proses === 'selesai')
        .reduce((sum, c) => sum + (c.besaran_dana_kematian || 0), 0),
      avg_duration: calculateAverageDuration(claims),
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching dana kematian stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}

function calculateAverageDuration(claims: any[]): number | null {
  const completedClaims = claims.filter(
    c => c.status_proses === 'selesai' && c.waktu_0 && c.waktu_6
  );

  if (completedClaims.length === 0) return null;

  const durations = completedClaims.map(claim => {
    const start = new Date(claim.waktu_0);
    const end = new Date(claim.waktu_6);
    return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  });

  const total = durations.reduce((sum, d) => sum + d, 0);
  return Math.round(total / durations.length);
}
