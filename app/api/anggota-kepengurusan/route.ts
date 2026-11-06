import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-storage';
import {
  requireAnyPermission,
  notAuthenticatedResponse,
  unauthorizedResponse,
} from '@/lib/rbac-server';
import {
  KEPENGURUSAN_MANAGE_PERMISSIONS,
  KEPENGURUSAN_VIEW_PERMISSIONS,
} from '@/lib/rbac';
import { isAdminActor } from '@/lib/server/anggota-service';
import {
  KEPENGURUSAN_WITH_ANGGOTA_SELECT,
  applyKepengurusanApproval,
  getActiveJabatan,
  hasActiveKepengurusanPengajuan,
  hasActivePengakhiranPengajuan,
  isNomorSkUsed,
} from '@/lib/server/kepengurusan-service';
import {
  formatKepengurusanValidationErrors,
  validateKepengurusanInput,
} from '@/lib/utils/kepengurusan-validation';
import { POSISI_NETRAL } from '@/lib/anggota-kepengurusan';

function getClient() {
  if (!supabaseAdmin) {
    throw new Error('Supabase admin client not configured. Set SUPABASE_SERVICE_ROLE_KEY.');
  }
  return supabaseAdmin;
}

function actorName(user: { name?: string | null; email?: string | null; id: string }): string {
  return user.name || user.email || user.id;
}

/**
 * GET /api/anggota-kepengurusan?status=&search=&page=&limit=&anggota_id=
 *
 * Daftar pengajuan/riwayat perubahan kepengurusan — pengurus/admin.
 */
export async function GET(request: NextRequest) {
  try {
    await requireAnyPermission([...KEPENGURUSAN_VIEW_PERMISSIONS]);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'all';
    const search = (searchParams.get('search') || '').trim();
    const anggotaId = (searchParams.get('anggota_id') || '').trim();
    const jenisParam = (searchParams.get('jenis') || '').trim();
    const page = Math.max(parseInt(searchParams.get('page') || '1'), 1);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '20'), 1), 100);
    const offset = (page - 1) * limit;

    const client = getClient();

    let query = client
      .from('anggota_kepengurusan')
      .select(KEPENGURUSAN_WITH_ANGGOTA_SELECT, { count: 'exact' })
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status !== 'all') query = query.eq('status', status);
    if (anggotaId) query = query.eq('anggota_id', anggotaId);
    if (jenisParam) query = query.eq('jenis', jenisParam);

    if (search) {
      // Cari berdasarkan NIK/Nama anggota (relasi) — cari id anggota yang cocok.
      const { data: matchingAnggota } = await client
        .from('anggota')
        .select('id')
        .or(`nik.ilike.%${search}%,nama_anggota.ilike.%${search}%`)
        .is('deleted_at', null)
        .limit(200);

      const matchingIds = (matchingAnggota || []).map((a: { id: string }) => a.id);
      query = query.in(
        'anggota_id',
        matchingIds.length ? matchingIds : ['00000000-0000-0000-0000-000000000000'],
      );
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching anggota_kepengurusan:', error);
      return NextResponse.json(
        { error: 'Gagal mengambil data perubahan kepengurusan', details: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      data: data || [],
      pagination: {
        total: count || 0,
        page,
        limit,
        totalPages: count ? Math.ceil(count / limit) : 1,
      },
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return notAuthenticatedResponse();
    if (error.message === 'FORBIDDEN') {
      return unauthorizedResponse('Anda tidak memiliki akses ke data perubahan kepengurusan');
    }
    console.error('Error in GET /api/anggota-kepengurusan:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan pada server' }, { status: 500 });
  }
}

/**
 * POST /api/anggota-kepengurusan
 *
 * Membuat pengajuan perubahan kepengurusan (angkat/pindah/berhentikan).
 *
 * - Non-admin (PC/petugas) → status 'menunggu' (menunggu verifikasi PC → keputusan PP).
 * - Admin (isAdminActor) → jalur cepat: langsung disetujui + diterapkan
 *   (tutup jabatan lama + sinkron posisi_kepengurusan) dengan jejak self-approved.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAnyPermission([...KEPENGURUSAN_MANAGE_PERMISSIONS]);

    const body = await request.json();
    const errors = validateKepengurusanInput(body);

    if (errors.length > 0) {
      return NextResponse.json(
        { error: formatKepengurusanValidationErrors(errors), errors },
        { status: 422 },
      );
    }

    const client = getClient();

    // Resolve & validasi eligibilitas anggota.
    const { data: anggota, error: anggotaError } = await client
      .from('anggota')
      .select('id, nik, nama_anggota, nama_cabang, kode_cabang, posisi_kepengurusan, status_anggota, status_keanggotaan')
      .eq('id', String(body.anggota_id).trim())
      .is('deleted_at', null)
      .maybeSingle();

    if (anggotaError || !anggota) {
      return NextResponse.json({ error: 'Anggota tidak ditemukan' }, { status: 404 });
    }

    if (anggota.status_anggota === 'meninggal') {
      return NextResponse.json(
        {
          error: 'Anggota sudah tercatat meninggal dunia dan tidak dapat diangkat/diberhentikan jabatannya.',
          code: 'ANGGOTA_MENINGGAL',
        },
        { status: 409 },
      );
    }

    // Jenis ditentukan lebih awal karena memengaruhi guard berikutnya.
    const jenis = String(body.jenis).trim();

    // Keanggotaan berakhir → pengangkatan/pindah ditolak. Pemberhentian jabatan
    // tetap diizinkan sebagai penutupan administratif (audit §13-Q8).
    if (anggota.status_keanggotaan === 'berhenti' && jenis !== 'berhentikan') {
      return NextResponse.json(
        {
          error: 'Keanggotaan anggota sudah berakhir — tidak dapat diubah kepengurusannya.',
          code: 'ANGGOTA_BERHENTI',
        },
        { status: 409 },
      );
    }

    // Satu lifecycle per anggota: blokir bila pengakhiran keanggotaan berjalan.
    if (await hasActivePengakhiranPengajuan(anggota.id)) {
      return NextResponse.json(
        {
          error:
            'Anggota sedang memiliki pengajuan Pengakhiran Keanggotaan yang berjalan. Selesaikan atau batalkan pengajuan tersebut terlebih dahulu.',
          code: 'ACTIVE_PENGAKHIRAN',
        },
        { status: 409 },
      );
    }

    // Tentukan jabatan tujuan: 'berhentikan' selalu kembali ke posisi netral.
    const jabatan = jenis === 'berhentikan' ? POSISI_NETRAL : String(body.jabatan).trim();
    const posisiSaatIni = (anggota.posisi_kepengurusan || POSISI_NETRAL).trim();

    // Tidak ada perubahan efektif → tolak.
    if (jabatan === posisiSaatIni) {
      return NextResponse.json(
        {
          error:
            jenis === 'berhentikan'
              ? `Anggota sudah berstatus "${POSISI_NETRAL}" — tidak ada jabatan yang perlu diberhentikan.`
              : `Jabatan tujuan sama dengan posisi saat ini ("${posisiSaatIni}").`,
          code: 'NO_CHANGE',
        },
        { status: 400 },
      );
    }

    // Satu pengajuan aktif per anggota.
    if (await hasActiveKepengurusanPengajuan(anggota.id)) {
      return NextResponse.json(
        {
          error: 'Anggota ini masih memiliki pengajuan kepengurusan yang sedang berjalan.',
          code: 'DUPLICATE_ACTIVE',
        },
        { status: 409 },
      );
    }

    const nomorSk = String(body.nomor_sk).trim();

    // Tanggal efektif pemberhentian tidak boleh mendahului mulai jabatan aktif.
    if (jenis === 'berhentikan') {
      const aktif = await getActiveJabatan(anggota.id);
      const tanggalEfektif = String(body.tanggal_mulai).trim().slice(0, 10);
      const mulaiAktif = aktif?.tanggal_mulai ? String(aktif.tanggal_mulai).slice(0, 10) : null;

      if (mulaiAktif && tanggalEfektif < mulaiAktif) {
        return NextResponse.json(
          {
            error: `Tanggal efektif pemberhentian tidak boleh lebih awal dari tanggal mulai jabatan aktif (${mulaiAktif}).`,
            code: 'INVALID_TANGGAL_EFEKTIF',
          },
          { status: 400 },
        );
      }
    }

    // Nomor SK tidak boleh dipakai pengajuan lain yang belum ditolak/dibatalkan.
    if (await isNomorSkUsed(nomorSk)) {
      return NextResponse.json(
        {
          error: `Nomor SK "${nomorSk}" sudah digunakan pada pengajuan lain.`,
          code: 'DOCUMENT_NUMBER_USED',
        },
        { status: 409 },
      );
    }

    const nowIso = new Date().toISOString();
    const isAdmin = isAdminActor(user);

    // Insert pengajuan (status awal 'menunggu'; admin menyetujui sekaligus di bawah).
    const insertPayload: Record<string, unknown> = {
      anggota_id: anggota.id,
      diajukan_oleh: user.id,
      nik: anggota.nik ?? null,
      nama_anggota: anggota.nama_anggota ?? null,
      nama_cabang: anggota.nama_cabang ?? null,
      kode_cabang: anggota.kode_cabang ?? null,
      jenis,
      jabatan,
      jabatan_sebelumnya: posisiSaatIni,
      periode: body.periode ? String(body.periode).trim().slice(0, 50) : null,
      tanggal_mulai: String(body.tanggal_mulai).trim().slice(0, 10),
      tanggal_selesai: body.tanggal_selesai ? String(body.tanggal_selesai).trim().slice(0, 10) : null,
      nomor_sk: nomorSk,
      tanggal_sk: String(body.tanggal_sk).trim().slice(0, 10),
      file_sk: body.file_sk ? String(body.file_sk).trim() : null,
      keterangan: body.keterangan ? String(body.keterangan).trim() : null,
      catatan_pengaju: body.catatan_pengaju ? String(body.catatan_pengaju).trim() : null,
      // Alasan terstruktur — hanya bermakna/disimpan untuk jenis 'berhentikan' (migration 034).
      alasan_pemberhentian:
        jenis === 'berhentikan' && body.alasan_pemberhentian
          ? String(body.alasan_pemberhentian).trim()
          : null,
      keterangan_alasan:
        jenis === 'berhentikan' && body.keterangan_alasan
          ? String(body.keterangan_alasan).trim()
          : null,
      status: 'menunggu',
    };

    if (isAdmin) {
      // Jalur cepat admin: tercatat self-verified saat insert.
      insertPayload.diverifikasi_oleh = actorName(user);
      insertPayload.diverifikasi_pada = nowIso;
      insertPayload.catatan_verifikasi = 'Jalur cepat admin (self-verified).';
    }

    const { data: inserted, error: insertError } = await client
      .from('anggota_kepengurusan')
      .insert(insertPayload)
      .select(KEPENGURUSAN_WITH_ANGGOTA_SELECT)
      .single();

    if (insertError) {
      console.error('Error creating anggota_kepengurusan:', insertError);

      if (insertError.code === '23505') {
        const message = String(insertError.message || '');
        if (message.includes('uq_kepengurusan_aktif_pengajuan_per_anggota')) {
          return NextResponse.json(
            {
              error: 'Anggota ini masih memiliki pengajuan kepengurusan yang sedang berjalan.',
              code: 'DUPLICATE_ACTIVE',
            },
            { status: 409 },
          );
        }
        if (message.includes('uq_kepengurusan_nomor_aktif')) {
          return NextResponse.json(
            {
              error: `Nomor SK "${nomorSk}" sudah digunakan pada pengajuan lain.`,
              code: 'DOCUMENT_NUMBER_USED',
            },
            { status: 409 },
          );
        }
      }

      return NextResponse.json(
        { error: 'Gagal menyimpan pengajuan perubahan kepengurusan', details: insertError.message },
        { status: 500 },
      );
    }

    // Jalur cepat admin: setujui + terapkan sekaligus.
    if (isAdmin) {
      const applied = await applyKepengurusanApproval({
        id: inserted.id,
        anggotaId: anggota.id,
        jabatan,
        tanggalMulai: inserted.tanggal_mulai,
        decidedBy: actorName(user),
        catatanKeputusan: 'Perubahan kepengurusan ditetapkan langsung oleh admin.',
      });

      if (!applied.ok) {
        // Tandai gagal agar tidak menggantung sebagai pengajuan aktif.
        await client
          .from('anggota_kepengurusan')
          .update({
            status: 'ditolak',
            diputuskan_oleh: actorName(user),
            diputuskan_pada: new Date().toISOString(),
            alasan_keputusan: `Gagal menerapkan perubahan secara otomatis: ${applied.error || 'unknown'}`,
            updated_at: new Date().toISOString(),
          })
          .eq('id', inserted.id);

        return NextResponse.json(
          {
            error:
              'Pengajuan gagal diterapkan otomatis dan ditandai ditolak. Silakan periksa data / coba lagi.',
            details: applied.error,
            code: applied.code || 'APPLY_FAILED',
          },
          { status: 502 },
        );
      }

      const { data: appliedRecord } = await client
        .from('anggota_kepengurusan')
        .select(KEPENGURUSAN_WITH_ANGGOTA_SELECT)
        .eq('id', inserted.id)
        .maybeSingle();

      return NextResponse.json(
        {
          data: appliedRecord ?? inserted,
          status: 'tersimpan',
          message: 'Perubahan kepengurusan berhasil ditetapkan (jalur cepat admin).',
        },
        { status: 201 },
      );
    }

    return NextResponse.json(
      {
        data: inserted,
        status: 'menunggu',
        message: 'Pengajuan perubahan kepengurusan berhasil dikirim dan menunggu verifikasi PC.',
      },
      { status: 201 },
    );
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return notAuthenticatedResponse();
    if (error.message === 'FORBIDDEN') {
      return unauthorizedResponse('Anda tidak memiliki akses untuk mengajukan perubahan kepengurusan');
    }
    console.error('Error in POST /api/anggota-kepengurusan:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan pada server' }, { status: 500 });
  }
}
