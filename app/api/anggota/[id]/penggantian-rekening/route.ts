import { NextRequest, NextResponse } from 'next/server';
import {
  computeRekeningDiff,
  isNamaPemilikSesuai,
  safeParsePenggantianRekening,
  WAJIB_PEMILIK_SAMA_DENGAN_ANGGOTA,
} from '@/lib/anggota-rekening';
import { PERMISSIONS } from '@/lib/rbac';
import {
  notAuthenticatedResponse,
  requirePermission,
  unauthorizedResponse,
} from '@/lib/rbac-server';
import { applyPenggantianRekening } from '@/lib/server/anggota-rekening-service';
import {
  hasActiveDakemTransactions,
  isAdminActor,
} from '@/lib/server/anggota-service';
import { supabase } from '@/lib/supabase';

/**
 * GET /api/anggota/[id]/penggantian-rekening
 *
 * Informasi untuk menu Keanggotaan → Penggantian Rekening:
 * rekening aktif anggota, riwayat penggantian (anggota_rekening), dan
 * indikasi apakah anggota masih memiliki pengajuan Dana Kematian aktif
 * (peringatan lembut — tidak memblokir, karena pencairan dakem memakai
 * snapshot rekeningnya sendiri).
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requirePermission(PERMISSIONS.MANAGE_KEANGGOTAAN);
    const { id } = await context.params;

    const { data: member, error } = await supabase
      .from('anggota')
      .select(
        'id, nik, nama_anggota, nama_cabang, nama_bank, norek_bank, nama_pemilik_rekening',
      )
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error || !member) {
      return NextResponse.json(
        { error: 'Anggota tidak ditemukan' },
        { status: 404 },
      );
    }

    const { data: riwayat, error: riwayatError } = await supabase
      .from('anggota_rekening')
      .select('*')
      .eq('anggota_id', id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (riwayatError) {
      console.error(
        'Error fetching riwayat penggantian rekening:',
        riwayatError.message,
      );
    }

    const hasActiveDakem = await hasActiveDakemTransactions(id);

    return NextResponse.json({
      data: {
        anggota: member,
        riwayat: riwayat || [],
        has_active_dakem: hasActiveDakem,
      },
    });
  } catch (error: any) {
    console.error(
      'Error in GET /api/anggota/[id]/penggantian-rekening:',
      error,
    );

    if (error.message === 'UNAUTHORIZED') {
      return notAuthenticatedResponse();
    }
    if (error.message === 'FORBIDDEN') {
      return unauthorizedResponse(
        'Anda tidak memiliki akses untuk melihat informasi rekening anggota',
      );
    }

    return NextResponse.json(
      { error: 'Terjadi kesalahan pada server', details: error.message },
      { status: 500 },
    );
  }
}

/**
 * POST /api/anggota/[id]/penggantian-rekening
 *
 * Menu Keanggotaan → Penggantian Rekening.
 *
 * body: {
 *   nama_bank, kode_bank?, norek_bank, nama_pemilik_rekening,
 *   tanggal_efektif (YYYY-MM-DD, >= hari ini), dokumen_pendukung (URL unggahan),
 *   alasan (wajib, minimal 10 karakter)
 * }
 *
 * - Non-admin (cabang/pengurus) → usulan `anggota_perubahan`
 *   (jenis 'rekening', status 'menunggu'); rekening aktif TIDAK berubah
 *   sampai admin menyetujui.
 * - Admin → rekening baru langsung aktif + snapshot rekening lama ke
 *   `anggota_rekening` (append-only) + jejak audit self-approved.
 *
 * Aturan bisnis (docs/penggantian-rekening-audit.md §4.4):
 * nama pemilik rekening wajib sama dengan nama anggota (default aman).
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requirePermission(PERMISSIONS.MANAGE_KEANGGOTAAN);
    const { id } = await context.params;

    const body = await request.json();
    const parsed = safeParsePenggantianRekening(body);

    if (!parsed.ok) {
      return NextResponse.json(
        { error: 'Validasi gagal', errors: parsed.errors },
        { status: 422 },
      );
    }

    const input = parsed.data!;

    // Ambil data anggota existing (snapshot rekening lama).
    const { data: existing, error: fetchError } = await supabase
      .from('anggota')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: 'Anggota tidak ditemukan' },
        { status: 404 },
      );
    }

    // Tidak ada perubahan rekening yang berarti.
    if (
      (existing.norek_bank || '').trim() === input.norek_bank &&
      (existing.nama_bank || '').trim() === input.nama_bank
    ) {
      return NextResponse.json(
        {
          error:
            'Nomor rekening baru sama dengan rekening yang terdaftar saat ini. Tidak ada data yang disimpan.',
        },
        { status: 400 },
      );
    }

    // Aturan nama pemilik rekening (default aman — mudah dilonggarkan nanti).
    if (
      WAJIB_PEMILIK_SAMA_DENGAN_ANGGOTA &&
      !isNamaPemilikSesuai(input.nama_pemilik_rekening, existing.nama_anggota)
    ) {
      return NextResponse.json(
        {
          error: 'Validasi gagal',
          errors: [
            `Nama pemilik rekening wajib sama dengan nama anggota (${existing.nama_anggota}). Rekening atas nama pihak lain belum diizinkan.`,
          ],
        },
        { status: 422 },
      );
    }

    // Peringatan lembut: pengajuan dakem aktif tidak terganggu (dakem memakai
    // snapshot rekeningnya sendiri), cukup disadarkan ke petugas.
    const peringatanDakem = await hasActiveDakemTransactions(id);

    const perubahan = computeRekeningDiff(existing, input);
    const dataSebelum = {
      nama_bank: existing.nama_bank ?? null,
      norek_bank: existing.norek_bank ?? null,
      nama_pemilik_rekening: existing.nama_pemilik_rekening ?? null,
    };

    // ── Non-admin → usulan approval (jenis 'rekening') ───────────
    if (!isAdminActor(user)) {
      const { error: proposalError } = await supabase
        .from('anggota_perubahan')
        .insert({
          anggota_id: id,
          jenis: 'rekening',
          status: 'menunggu',
          data_sebelum: dataSebelum,
          data_usulan: input,
          alasan: input.alasan,
          diajukan_oleh: user.id,
        });

      if (proposalError) {
        console.error(
          'Error creating penggantian rekening approval:',
          proposalError,
        );
        return NextResponse.json(
          {
            error: 'Gagal membuat usulan penggantian rekening',
            details: proposalError.message,
          },
          { status: 500 },
        );
      }

      return NextResponse.json(
        {
          status: 'menunggu',
          message: 'Usulan penggantian rekening menunggu persetujuan admin.',
          perubahan,
          peringatan_dakem: peringatanDakem,
        },
        { status: 202 },
      );
    }

    // ── Admin → terapkan langsung + histori + jejak audit ────────
    const nowIso = new Date().toISOString();
    const applied = await applyPenggantianRekening({
      anggotaId: id,
      before: existing,
      usulan: input,
      diajukanOleh: user.id,
      disetujuiOleh: user.id,
      diputuskanPada: nowIso,
    });

    if (applied.error) {
      console.error('Error applying penggantian rekening:', applied.error);
      return NextResponse.json(
        {
          error: 'Gagal menyimpan penggantian rekening',
          details: applied.error,
        },
        { status: 500 },
      );
    }

    // Jejak audit (best-effort): riwayat siapa/kenapa/kapan tetap tercatat
    // untuk penerapan langsung oleh admin — pola perubahan-data-pribadi.
    const { error: logError } = await supabase
      .from('anggota_perubahan')
      .insert({
        anggota_id: id,
        jenis: 'rekening',
        status: 'disetujui',
        data_sebelum: dataSebelum,
        data_usulan: input,
        alasan: input.alasan,
        diajukan_oleh: user.id,
        diputuskan_oleh: user.id,
        diputuskan_pada: nowIso,
        alasan_keputusan:
          'Penggantian rekening disimpan langsung oleh admin.',
      });

    if (logError) {
      console.error(
        'Gagal mencatat jejak audit penggantian rekening:',
        logError.message,
      );
    }

    return NextResponse.json({
      data: applied.data,
      status: 'tersimpan',
      message: 'Penggantian rekening berhasil disimpan.',
      perubahan,
      peringatan_dakem: peringatanDakem,
    });
  } catch (error: any) {
    console.error(
      'Error in POST /api/anggota/[id]/penggantian-rekening:',
      error,
    );

    if (error.message === 'UNAUTHORIZED') {
      return notAuthenticatedResponse();
    }
    if (error.message === 'FORBIDDEN') {
      return unauthorizedResponse(
        'Anda tidak memiliki akses untuk mengganti rekening anggota',
      );
    }

    return NextResponse.json(
      { error: 'Terjadi kesalahan pada server', details: error.message },
      { status: 500 },
    );
  }
}


