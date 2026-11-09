import { NextRequest, NextResponse } from 'next/server';
import {
  getCurrentUser,
  notAuthenticatedResponse,
} from '@/lib/rbac-server';
import {
  PERMISSIONS,
  ROLES,
  hasAnyPermission,
  KEPENGURUSAN_VIEW_PERMISSIONS,
  PENGAKHIRAN_VIEW_PERMISSIONS,
} from '@/lib/rbac';
import { supabaseAdmin } from '@/lib/supabase-storage';

/**
 * GET /api/dashboard/overview?period=7d|30d|3m|6m|1y
 *
 * Endpoint agregat tunggal untuk Dashboard SIPATEL: summary cards, data chart,
 * monitoring pengajuan, dan aktivitas terbaru (audit_log).
 *
 * Prinsip:
 *  - Semua angka berasal dari database aktual (COUNT / agregasi kolom minimal).
 *  - Setiap seksi digerbangi permission server-side — seksi tanpa hak akses
 *    tidak diquery sama sekali (mengembalikan null).
 *  - Non-admin di-scope ke cabang sesuai record anggota miliknya (pola yang
 *    sama dengan GET /api/anggota).
 */

// ── Konfigurasi periode ──────────────────────────────────────────────
const PERIOD_DAYS: Record<string, number> = {
  '7d': 7,
  '30d': 30,
  '3m': 90,
  '6m': 180,
  '1y': 365,
};

const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
];

// Status dakem yang terminal (tidak lagi dihitung sebagai pending)
const DAKEM_TERMINAL = ['selesai', 'batal', 'ditolak'];

// Status workflow standar (mutasi / pengakhiran / kepengurusan)
const WORKFLOW_PENDING = ['menunggu', 'diverifikasi_pc'];
const WORKFLOW_DONE = 'disetujui_pp';
const WORKFLOW_REJECTED = 'ditolak';

function resolvePeriod(periodParam: string | null): { key: string; from: Date } {
  const key = periodParam && PERIOD_DAYS[periodParam] ? periodParam : '30d';
  const from = new Date();
  from.setDate(from.getDate() - PERIOD_DAYS[key]);
  from.setHours(0, 0, 0, 0);
  return { key, from };
}

function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7); // YYYY-MM
}

/** Deret bulanan berkelanjutan dari `from` sampai `to` (gap diisi 0). */
function buildMonthlyBuckets(from: Date, to: Date): { key: string; label: string }[] {
  const buckets: { key: string; label: string }[] = [];
  const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
  const end = new Date(to.getFullYear(), to.getMonth(), 1);
  while (cursor <= end) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
    buckets.push({
      key,
      label: `${MONTH_LABELS[cursor.getMonth()]} ${String(cursor.getFullYear()).slice(2)}`,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return buckets;
}

/** Hitung status workflow standar dari baris { status }. */
function countWorkflowStatus(rows: { status: string }[]): Record<string, number> {
  return {
    menunggu: rows.filter((r) => r.status === 'menunggu').length,
    diverifikasi: rows.filter((r) => r.status === 'diverifikasi_pc').length,
    selesai: rows.filter((r) => r.status === WORKFLOW_DONE).length,
    ditolak: rows.filter((r) => r.status === WORKFLOW_REJECTED).length,
    dibatalkan: rows.filter((r) => r.status === 'dibatalkan').length,
  };
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return notAuthenticatedResponse();
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Supabase admin client tidak dikonfigurasi' },
        { status: 503 },
      );
    }

    const { key: periodKey, from } = resolvePeriod(request.nextUrl.searchParams.get('period'));
    const now = new Date();
    // Awal periode sebelumnya (dengan panjang sama) untuk perhitungan tren.
    const prevFrom = new Date(from);
    prevFrom.setDate(prevFrom.getDate() - PERIOD_DAYS[periodKey]);

    // ── Permission per seksi (server-side) ──────────────────────────
    const canKeanggotaan = hasAnyPermission(user, [
      PERMISSIONS.VIEW_KEANGGOTAAN,
      PERMISSIONS.ACCESS_KEANGGOTAAN,
      PERMISSIONS.MANAGE_KEANGGOTAAN,
    ]);
    const canMutasi = hasAnyPermission(user, [PERMISSIONS.MANAGE_KEANGGOTAAN]);
    const canPengakhiran = hasAnyPermission(user, PENGAKHIRAN_VIEW_PERMISSIONS);
    const canKepengurusan = hasAnyPermission(user, KEPENGURUSAN_VIEW_PERMISSIONS);
    const canDakem = hasAnyPermission(user, [
      PERMISSIONS.ACCESS_DANA_KEMATIAN,
      PERMISSIONS.MANAGE_DANA_KEMATIAN,
      PERMISSIONS.DAKEM_MANAGE_PC,
      PERMISSIONS.DAKEM_VERIFY_PP,
    ]);
    const canActivity = hasAnyPermission(user, [PERMISSIONS.AUDIT_TRAIL_VIEW]);
    const canKeuangan = hasAnyPermission(user, [
      PERMISSIONS.ACCESS_KEUANGAN,
      PERMISSIONS.MANAGE_LAPORAN,
      PERMISSIONS.VIEW_IURAN,
      PERMISSIONS.MANAGE_IURAN,
    ]);

    // ── Scope cabang untuk non-admin ────────────────────────────────
    const isAdmin = user.role?.slug === ROLES.ADMINISTRATOR;
    let scopeCabang: string | null = null;
    if (!isAdmin && user.id) {
      const { data: userAnggota } = await supabaseAdmin
        .from('anggota')
        .select('nama_cabang')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .maybeSingle();
      scopeCabang = userAnggota?.nama_cabang || null;
    }

    // Helper filter scope per tabel (kolom cabang berbeda-beda).
    // Dibuat non-generic agar tidak memicu type instantiation yang terlalu
    // dalam pada PostgrestFilterBuilder (TS2589).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scoped = (q: any, col?: string): any =>
      scopeCabang && col ? q.eq(col, scopeCabang) : q;

    // ── Seksi Keanggotaan ───────────────────────────────────────────
    let keanggotaan: Record<string, number> | null = null;
    let pertumbuhanAnggota: { label: string; jumlah: number }[] = [];
    let anggotaPerCabang: { cabang: string; jumlah: number }[] = [];
    let pengurusPerJabatan: { jabatan: string; jumlah: number }[] = [];
    let pendaftaranBaru = 0;
    let pendaftaranBaruPrev = 0;

    // Demografi anggota (kolom sudah ada di tabel anggota — tanpa asumsi).
    let usia: { label: string; jumlah: number }[] = [];
    let kategoriDist: { status: string; jumlah: number }[] = [];
    let peranDist: { status: string; jumlah: number }[] = [];
    let regionalDist: { regional: string; jumlah: number }[] = [];
    const iuran = { iuran: 0, tidakIuran: 0 };

    if (canKeanggotaan) {
      const [totalRes, aktifRes, nonAktifRes, berhentiRes, meninggalRes, growthRes, profileRes, prevGrowthRes] =
        await Promise.all([
          scoped(supabaseAdmin.from('anggota').select('*', { count: 'exact', head: true }), 'nama_cabang')
            .is('deleted_at', null),
          scoped(supabaseAdmin.from('anggota').select('*', { count: 'exact', head: true }), 'nama_cabang')
            .eq('status_keanggotaan', 'aktif').is('deleted_at', null),
          scoped(supabaseAdmin.from('anggota').select('*', { count: 'exact', head: true }), 'nama_cabang')
            .eq('status_keanggotaan', 'non_aktif').is('deleted_at', null),
          scoped(supabaseAdmin.from('anggota').select('*', { count: 'exact', head: true }), 'nama_cabang')
            .eq('status_keanggotaan', 'berhenti').is('deleted_at', null),
          scoped(supabaseAdmin.from('anggota').select('*', { count: 'exact', head: true }), 'nama_cabang')
            .eq('status_anggota', 'meninggal').is('deleted_at', null),
          scoped(supabaseAdmin.from('anggota').select('created_at'), 'nama_cabang')
            .is('deleted_at', null).gte('created_at', from.toISOString()),
          scoped(supabaseAdmin
            .from('anggota')
            .select('nama_cabang, posisi_kepengurusan, tanggal_lahir, kategori_anggota, status_anggota, status_iuran, cabang_area_regional'), 'nama_cabang')
            .is('deleted_at', null),
          // Pendaftaran pada periode sebelumnya (untuk tren %).
          scoped(supabaseAdmin.from('anggota').select('*', { count: 'exact', head: true }), 'nama_cabang')
            .is('deleted_at', null)
            .gte('created_at', prevFrom.toISOString())
            .lt('created_at', from.toISOString()),
        ]);

      const total = totalRes.count || 0;
      const aktif = aktifRes.count || 0;
      const nonAktif = nonAktifRes.count || 0;
      const berhenti = berhentiRes.count || 0;
      const meninggal = meninggalRes.count || 0;

      // Posisi pengurus saat ini: selain 'Anggota' / kosong (snapshot
      // anggota.posisi_kepengurusan — disinkronkan dari anggota_kepengurusan).
      const profileRows = profileRes.data || [];
      const jabatanCount: Record<string, number> = {};
      let pengurusAktif = 0;
      for (const row of profileRows) {
        const p = (row.posisi_kepengurusan || '').trim();
        if (p && p.toLowerCase() !== 'anggota') {
          pengurusAktif += 1;
          jabatanCount[p] = (jabatanCount[p] || 0) + 1;
        }
      }

      keanggotaan = {
        totalAnggota: total,
        anggotaAktif: aktif,
        anggotaNonAktif: nonAktif,
        anggotaBerhenti: berhenti,
        anggotaMeninggal: meninggal,
        pengurusAktif,
      };

      pendaftaranBaru = (growthRes.data || []).length;
      pendaftaranBaruPrev = prevGrowthRes.count || 0;

      // ── Demografi (usia, kategori, peran keluarga, regional, iuran) ──
      const AGE_BUCKETS: { label: string; min: number; max: number }[] = [
        { label: '< 50 thn', min: 0, max: 49 },
        { label: '50–59 thn', min: 50, max: 59 },
        { label: '60–69 thn', min: 60, max: 69 },
        { label: '70–79 thn', min: 70, max: 79 },
        { label: '80+ thn', min: 80, max: 200 },
      ];
      const ageCount = new Map<string, number>(AGE_BUCKETS.map((b) => [b.label, 0]));
      let ageUnknown = 0;
      const kategoriCount: Record<string, number> = {};
      const peranCount: Record<string, number> = {};
      const regionalCount: Record<string, number> = {};

      for (const row of profileRows) {
        // Usia dari tanggal_lahir (kosong → "Tidak diketahui", bukan asumsi)
        if (row.tanggal_lahir) {
          const dob = new Date(row.tanggal_lahir);
          if (!Number.isNaN(dob.getTime())) {
            const age = Math.floor((now.getTime() - dob.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
            const bucket = AGE_BUCKETS.find((b) => age >= b.min && age <= b.max);
            if (bucket) ageCount.set(bucket.label, (ageCount.get(bucket.label) || 0) + 1);
            else ageUnknown += 1;
          } else {
            ageUnknown += 1;
          }
        } else {
          ageUnknown += 1;
        }

        const kat = row.kategori_anggota || 'tidak_diketahui';
        kategoriCount[kat] = (kategoriCount[kat] || 0) + 1;

        const peran = row.status_anggota || 'tidak_diketahui';
        peranCount[peran] = (peranCount[peran] || 0) + 1;

        const reg = (row.cabang_area_regional || '').trim() || 'Tidak terdata';
        regionalCount[reg] = (regionalCount[reg] || 0) + 1;

        if (row.status_iuran === 'iuran') iuran.iuran += 1;
        else if (row.status_iuran === 'tidak_iuran') iuran.tidakIuran += 1;
      }

      usia = [
        ...AGE_BUCKETS.map((b) => ({ label: b.label, jumlah: ageCount.get(b.label) || 0 })),
        { label: 'Tidak diketahui', jumlah: ageUnknown },
      ];
      kategoriDist = Object.entries(kategoriCount)
        .map(([status, jumlah]) => ({ status, jumlah }))
        .sort((a, b) => b.jumlah - a.jumlah);
      peranDist = Object.entries(peranCount)
        .map(([status, jumlah]) => ({ status, jumlah }))
        .sort((a, b) => b.jumlah - a.jumlah);
      regionalDist = Object.entries(regionalCount)
        .map(([regional, jumlah]) => ({ regional, jumlah }))
        .sort((a, b) => b.jumlah - a.jumlah)
        .slice(0, 10);

      const growthBuckets = buildMonthlyBuckets(from, now);
      const growthMap = new Map(growthBuckets.map((b) => [b.key, 0]));
      for (const row of growthRes.data || []) {
        const k = monthKey(row.created_at);
        if (growthMap.has(k)) growthMap.set(k, (growthMap.get(k) || 0) + 1);
      }
      pertumbuhanAnggota = growthBuckets.map((b) => ({ label: b.label, jumlah: growthMap.get(b.key) || 0 }));

      const cabangCount: Record<string, number> = {};
      for (const row of profileRows) {
        const c = (row.nama_cabang || 'Tidak diketahui').trim();
        cabangCount[c] = (cabangCount[c] || 0) + 1;
      }
      anggotaPerCabang = Object.entries(cabangCount)
        .map(([cabang, jumlah]) => ({ cabang, jumlah }))
        .sort((a, b) => b.jumlah - a.jumlah)
        .slice(0, 10);

      pengurusPerJabatan = Object.entries(jabatanCount)
        .map(([jabatan, jumlah]) => ({ jabatan, jumlah }))
        .sort((a, b) => b.jumlah - a.jumlah);
    }

    // ── Seksi Mutasi Cabang ─────────────────────────────────────────
    let mutasiPending = 0;
    let mutasiMonitoring: Record<string, number> | null = null;
    let mutasiPerBulan: {
      label: string;
      menunggu: number;
      diverifikasi: number;
      selesai: number;
      ditolak: number;
    }[] = [];

    if (canMutasi) {
      // Tabel pengajuan_mutasi_cabang tidak punya deleted_at (append-only).
      const { data: mutasiRows } = await scoped(
        supabaseAdmin.from('pengajuan_mutasi_cabang').select('status, created_at'),
        'cabang_asal',
      );
      const rows = (mutasiRows || []) as { status: string; created_at: string }[];

      mutasiPending = rows.filter((r) => WORKFLOW_PENDING.includes(r.status)).length;
      mutasiMonitoring = countWorkflowStatus(rows);

      const buckets = buildMonthlyBuckets(from, now);
      const idx = new Map(buckets.map((b, i) => [b.key, i]));
      mutasiPerBulan = buckets.map((b) => ({
        label: b.label,
        menunggu: 0,
        diverifikasi: 0,
        selesai: 0,
        ditolak: 0,
      }));
      for (const r of rows) {
        const i = idx.get(monthKey(r.created_at));
        if (i === undefined) continue;
        if (r.status === 'menunggu') mutasiPerBulan[i].menunggu += 1;
        else if (r.status === 'diverifikasi_pc') mutasiPerBulan[i].diverifikasi += 1;
        else if (r.status === WORKFLOW_DONE) mutasiPerBulan[i].selesai += 1;
        else if (r.status === WORKFLOW_REJECTED) mutasiPerBulan[i].ditolak += 1;
      }
    }

    // ── Seksi Pengakhiran & Kepengurusan (monitoring) ───────────────
    let pengakhiranMonitoring: Record<string, number> | null = null;
    if (canPengakhiran) {
      const { data: rows } = await scoped(
        supabaseAdmin.from('pengakhiran_keanggotaan').select('status'),
        'nama_cabang',
      ).is('deleted_at', null);
      pengakhiranMonitoring = countWorkflowStatus((rows || []) as { status: string }[]);
    }

    let kepengurusanMonitoring: Record<string, number> | null = null;
    if (canKepengurusan) {
      const { data: rows } = await scoped(
        supabaseAdmin.from('anggota_kepengurusan').select('status'),
        'nama_cabang',
      ).is('deleted_at', null);
      kepengurusanMonitoring = countWorkflowStatus((rows || []) as { status: string }[]);
    }

    // ── Seksi Dana Kematian ─────────────────────────────────────────
    let dakemPending = 0;
    let dakemMonitoring: Record<string, number> | null = null;
    let dakemPerStatus: { status: string; jumlah: number }[] = [];
    let totalDicairkan = 0;
    let dakemKpi = {
      rataRataDurasiHari: null as number | null,
      tertuaMenungguHari: null as number | null,
    };

    if (canDakem) {
      const { data: dakemRows } = await scoped(
        supabaseAdmin
          .from('dana_kematian')
          .select('status_proses, besaran_dana_kematian, waktu_0, waktu_6, created_at'),
        'cabang_asal_melapor',
      ).is('deleted_at', null);
      const rows = (dakemRows || []) as {
        status_proses: string;
        besaran_dana_kematian: number | null;
        waktu_0: string | null;
        waktu_6: string | null;
        created_at: string | null;
      }[];

      const byStatus: Record<string, number> = {};
      for (const r of rows) {
        const s = r.status_proses || 'unknown';
        byStatus[s] = (byStatus[s] || 0) + 1;
        if (s === 'selesai') totalDicairkan += r.besaran_dana_kematian || 0;
      }

      dakemPending = rows.filter((r) => !DAKEM_TERMINAL.includes(r.status_proses)).length;
      dakemMonitoring = {
        menunggu: dakemPending,
        diverifikasi: 0,
        selesai: byStatus['selesai'] || 0,
        ditolak: byStatus['ditolak'] || 0,
        dibatalkan: byStatus['batal'] || 0,
      };
      dakemPerStatus = Object.entries(byStatus)
        .map(([status, jumlah]) => ({ status, jumlah }))
        .sort((a, b) => b.jumlah - a.jumlah);

      // KPI: rata-rata durasi proses klaim selesai (waktu_0 → waktu_6, pola
      // /api/dana-kematian/stats) & umur pengajuan tertua yang masih menunggu.
      let totalDurasi = 0;
      let jumlahDurasi = 0;
      let tertuaMenunggu = 0;
      for (const r of rows) {
        if (r.status_proses === 'selesai' && r.waktu_0 && r.waktu_6) {
          const durasi =
            (new Date(r.waktu_6).getTime() - new Date(r.waktu_0).getTime()) / 86_400_000;
          if (durasi >= 0) {
            totalDurasi += durasi;
            jumlahDurasi += 1;
          }
        }
        if (!DAKEM_TERMINAL.includes(r.status_proses) && r.created_at) {
          const umur = (now.getTime() - new Date(r.created_at).getTime()) / 86_400_000;
          if (umur > tertuaMenunggu) tertuaMenunggu = umur;
        }
      }
      dakemKpi = {
        rataRataDurasiHari: jumlahDurasi > 0 ? Math.round(totalDurasi / jumlahDurasi) : null,
        tertuaMenungguHari: tertuaMenunggu > 0 ? Math.round(tertuaMenunggu) : null,
      };
    }

    // ── Seksi Keuangan (sumbangan/iuran & arus kas) ─────────────────
    let sumbangan: { totalPeriode: number; pendingVerifikasi: number } | null = null;
    let sumbanganPerBulan: { label: string; terbayar: number; pending: number }[] = [];
    let arusKasPerBulan: { label: string; masuk: number; keluar: number }[] = [];

    if (canKeuangan) {
      const fromDate = from.toISOString().split('T')[0];

      const [sumRes, kasRes] = await Promise.all([
        supabaseAdmin
          .from('pembayaran_sumbangan')
          .select('jumlah_pembayaran, tanggal_transaksi, status_pembayaran')
          .is('deleted_at', null),
        supabaseAdmin
          .from('arus_kas')
          .select('jenis_transaksi, jumlah_transaksi, tanggal_transaksi')
          .is('deleted_at', null)
          .gte('tanggal_transaksi', fromDate),
      ]);

      // ── Sumbangan: total terbayar pada periode + jumlah pending verifikasi
      const sumRows = (sumRes.data || []) as {
        jumlah_pembayaran: number | null;
        tanggal_transaksi: string | null;
        status_pembayaran: string | null;
      }[];
      const sumBuckets = buildMonthlyBuckets(from, now);
      const sumIdx = new Map(sumBuckets.map((b, i) => [b.key, i]));
      const sumMonthly = sumBuckets.map((b) => ({ label: b.label, terbayar: 0, pending: 0 }));

      let totalPeriode = 0;
      let pendingVerifikasi = 0;
      for (const r of sumRows) {
        const amount = r.jumlah_pembayaran || 0;
        const k = r.tanggal_transaksi ? monthKey(r.tanggal_transaksi) : null;
        const i = k ? sumIdx.get(k) : undefined;

        if (r.status_pembayaran === 'paid') {
          if (i !== undefined) sumMonthly[i].terbayar += amount;
          if (r.tanggal_transaksi && r.tanggal_transaksi >= fromDate) totalPeriode += amount;
        } else if (r.status_pembayaran === 'pending') {
          pendingVerifikasi += 1;
          if (i !== undefined) sumMonthly[i].pending += amount;
        }
      }

      sumbangan = { totalPeriode, pendingVerifikasi };
      sumbanganPerBulan = sumMonthly;

      // ── Arus kas per bulan (masuk vs keluar)
      const kasRows = (kasRes.data || []) as {
        jenis_transaksi: string | null;
        jumlah_transaksi: number | null;
        tanggal_transaksi: string | null;
      }[];
      const kasBuckets = buildMonthlyBuckets(from, now);
      const kasIdx = new Map(kasBuckets.map((b, i) => [b.key, i]));
      const kasMonthly = kasBuckets.map((b) => ({ label: b.label, masuk: 0, keluar: 0 }));

      for (const r of kasRows) {
        const k = r.tanggal_transaksi ? monthKey(r.tanggal_transaksi) : null;
        const i = k ? kasIdx.get(k) : undefined;
        if (i === undefined) continue;
        if (r.jenis_transaksi === 'masuk') kasMonthly[i].masuk += r.jumlah_transaksi || 0;
        else if (r.jenis_transaksi === 'keluar') kasMonthly[i].keluar += r.jumlah_transaksi || 0;
      }

      arusKasPerBulan = kasMonthly;
    }

    // ── Seksi Aktivitas Terbaru (audit_log) ─────────────────────────
    interface AuditRow {
      id: string;
      occurred_at: string;
      module: string;
      table_name: string;
      entity_id: string | null;
      anggota_id: string | null;
      action: string;
      actor_name: string | null;
      actor_role_slug: string | null;
    }
    interface AnggotaRef {
      id: string;
      nik: string | null;
      nama_anggota: string | null;
      nama_cabang: string | null;
    }
    type ActivityRow = AuditRow & { anggota: AnggotaRef | null };

    let activity: ActivityRow[] = [];
    let auditEnabled = false;
    if (canActivity) {
      const { data: auditData, error: auditError } = await supabaseAdmin
        .from('audit_log')
        .select('id, occurred_at, module, table_name, entity_id, anggota_id, action, actor_name, actor_role_slug')
        .order('occurred_at', { ascending: false })
        .limit(10);

      if (auditError) {
        // Migration 036 belum dijalankan — tandai agar UI menampilkan empty state.
        if (auditError.code === '42P01' || /does not exist/i.test(auditError.message || '')) {
          auditEnabled = false;
        } else {
          throw auditError;
        }
      } else {
        auditEnabled = true;
        const auditRows = (auditData || []) as AuditRow[];

        // Enrich info anggota untuk penelusuran cepat (pola /api/audit-trail).
        const anggotaIds = Array.from(
          new Set(auditRows.map((r) => r.anggota_id).filter((v): v is string => !!v)),
        );
        let anggotaMap = new Map<string, AnggotaRef>();
        if (anggotaIds.length > 0) {
          const { data: anggotaRows } = await supabaseAdmin
            .from('anggota')
            .select('id, nik, nama_anggota, nama_cabang')
            .in('id', anggotaIds);
          anggotaMap = new Map(((anggotaRows || []) as AnggotaRef[]).map((a) => [a.id, a]));
        }

        activity = auditRows.map((r) => ({
          ...r,
          anggota: r.anggota_id ? anggotaMap.get(r.anggota_id) ?? null : null,
        }));
      }
    }

    return NextResponse.json({
      period: { key: periodKey, from: from.toISOString(), to: now.toISOString() },
      scope: { cabang: scopeCabang, isScoped: !!scopeCabang },
      permissions: {
        keanggotaan: canKeanggotaan,
        mutasi: canMutasi,
        pengakhiran: canPengakhiran,
        kepengurusan: canKepengurusan,
        danaKematian: canDakem,
        keuangan: canKeuangan,
        activity: canActivity,
      },
      summary: {
        keanggotaan,
        pendaftaranBaru: canKeanggotaan ? pendaftaranBaru : null,
        mutasiPending: canMutasi ? mutasiPending : null,
        dakemPending: canDakem ? dakemPending : null,
        totalDicairkan: canDakem ? totalDicairkan : null,
        iuran: canKeanggotaan ? iuran : null,
        sumbangan: canKeuangan ? sumbangan : null,
        dakemKpi: canDakem ? dakemKpi : null,
      },
      trends: {
        pendaftaranBaru: canKeanggotaan
          ? { current: pendaftaranBaru, previous: pendaftaranBaruPrev }
          : null,
      },
      charts: {
        pertumbuhanAnggota,
        distribusiStatus: keanggotaan
          ? [
              { status: 'aktif', jumlah: keanggotaan.anggotaAktif },
              { status: 'non_aktif', jumlah: keanggotaan.anggotaNonAktif },
              { status: 'berhenti', jumlah: keanggotaan.anggotaBerhenti },
              { status: 'meninggal', jumlah: keanggotaan.anggotaMeninggal },
            ]
          : [],
        anggotaPerCabang,
        dakemPerStatus,
        mutasiPerBulan,
        pengurusPerJabatan,
        usia,
        kategori: kategoriDist,
        peranKeluarga: peranDist,
        regional: regionalDist,
        sumbanganPerBulan,
        arusKasPerBulan,
      },
      monitoring: {
        mutasi: mutasiMonitoring,
        pengakhiran: pengakhiranMonitoring,
        kepengurusan: kepengurusanMonitoring,
        danaKematian: dakemMonitoring,
      },
      activity,
      auditEnabled,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error in GET /api/dashboard/overview:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan pada server', details: message },
      { status: 500 },
    );
  }
}

