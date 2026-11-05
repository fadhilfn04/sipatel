# Audit & Rekomendasi Desain — Pengakhiran Keanggotaan

> Dokumen ini adalah hasil **audit/analisis tahap pertama** (belum ada perubahan kode).
> Tujuan: memberi rekomendasi desain fitur **Pengakhiran Keanggotaan** (anggota berhenti
> menjadi anggota) beserta struktur data, alur proses, dan dampaknya ke modul lain,
> **tanpa merusak data historis maupun workflow existing**.
>
> Pola & gaya dokumen mengikuti `docs/entry-meninggal-dunia-audit.md`.

---

## 1. Ringkasan Eksekutif

**Rekomendasi utama:** tambahkan **satu penanda siklus hidup keanggotaan** di `anggota`
(`status_keanggotaan`) + **satu tabel fakta pengakhiran** (`pengakhiran_keanggotaan`, 1 baris per anggota)
yang menyimpan alasan, tanggal efektif, dokumen, dan riwayat keputusan.

Alur ringkas yang direkomendasikan:

1. Petugas (PC/cabang) membuat **pengajuan pengakhiran** → tabel `pengakhiran_keanggotaan`
   (`status = 'menunggu'`). `anggota.status_keanggotaan` **BELUM** berubah.
2. Verifikasi PC → `diverifikasi_pc`.
3. Keputusan PP/pusat → `disetujui_pp` → **dalam transaksi yang sama** set
   `anggota.status_keanggotaan = 'berhenti'`. Atau `ditolak` / `dibatalkan` (terminal, status anggota tidak berubah).
4. Data anggota **tidak dihapus** (tidak memakai soft delete) — historis tetap utuh dan terlihat.
5. Modul lain (Dana Kematian, Mutasi Cabang, Pengelolaan Data, Dashboard) **membaca**
   `status_keanggotaan` untuk memblokir proses baru, tanpa mengubah struktur/workflow-nya.

**Keputusan kunci:**

- **TIDAK** mengubah `status_anggota_enum` (`pegawai/istri/suami/anak/meninggal`).
  Enum itu adalah **peran keluarga**, bukan status keanggotaan, dan **dipakai bersama**
  oleh `dana_kematian` → audit sebelumnya menandainya **"DO NOT MODIFY"** (`ANGGOTA_AUDIT_SUMMARY.md`,
  `supabase/migrations/014_add_anggota_enhancements.sql`).
- **TIDAK** memakai soft delete (`anggota.deleted_at`) sebagai penanda berhenti — berhenti ≠ dihapus.
- **TIDAK** memakai `status_kepesertaan` (VARCHAR free text) sebagai sumber otoritatif —
  kolom itu tidak tervalidasi dan sudah dipakai import/export.

---

## 2. Cakupan Audit

| Area | File yang diperiksa |
|---|---|
| Skema anggota | `supabase/migrations/001_create_anggota_table.sql` |
| Klarifikasi field status | `supabase/migrations/023_clarify_anggota_status_fields.sql` |
| Enum & kolom tambahan anggota | `supabase/migrations/014_add_anggota_enhancements.sql` |
| Approval create/edit/hapus | `supabase/migrations/027_dakem_claim_config_anggota_approval.sql` (bagian `anggota_perubahan`), `028_anggota_create_approval.sql` |
| Riwayat mutasi (append-only) | `027_...` (tabel `anggota_mutasi`), `lib/server/anggota-kematian-service.ts` — lihat `lib/server/anggota-service.ts` (`recordMutasiIfCabangChanged`) |
| Modul Data Meninggal Dunia | `supabase/migrations/031_create_anggota_kematian.sql`, `lib/server/anggota-kematian-service.ts`, `app/api/anggota-kematian/*`, `app/(protected)/keanggotaan/entry-meninggal-dunia/page.tsx`, `docs/entry-meninggal-dunia-audit.md` |
| Modul Mutasi Cabang | `supabase/migrations/029_create_pengajuan_mutasi_cabang.sql`, `030_add_cabang_tujuan_pengajuan_mutasi.sql`, `lib/workflow/mutasi-cabang-status.ts`, `app/api/mutasi-cabang/*`, `app/(protected)/mutasi-cabang/page.tsx` |
| Pendaftaran anggota baru | `app/api/anggota/route.ts`, `app/api/anggota/approvals/*`, `config/menu.config.tsx` |
| Perubahan data anggota | `app/api/anggota/[id]/route.ts`, `lib/server/anggota-service.ts` |
| RBAC | `lib/rbac.ts`, `lib/rbac-server.ts`, `prisma/data/permissions.js`, `supabase/migrations/013_create_dana_kematian_roles_permissions.sql`, `016_standardize_role_slugs.sql` |
| Menu | `config/menu.config.tsx` |
| Dana Kematian | `supabase/migrations/002_create_dana_kematian_table.sql`, `components/dana-kematian/MemberSearchModal.tsx`, `components/dana-kematian/DanaKematianFormModal.tsx`, `lib/server/dakem-claim-rules.ts`, `lib/config/dana-kematian-berkas.ts` |
| Pewarisan NIK | `supabase/migrations/008_create_nik_inheritance_tables.sql`, `lib/supabase.ts` (`StatusKepemilikanEnum`) |
| Storage | `lib/supabase-storage.ts`, `app/api/upload/route.ts` |
| Tipe | `lib/supabase.ts` |
| Dokumentasi keputusan bisnis | `docs/PROPOSAL_KEPUTUSAN_BISNIS_SIPATEL.md` |

---

## 3. Temuan Audit

### 3.1 Struktur `anggota` — banyak field "status" dengan makna berbeda

`anggota` punya **lima** field yang tampak seperti "status", dan semuanya **bukan** status keanggotaan:

| Kolom | Tipe | Makna (per `023_clarify_anggota_status_fields.sql`) | Nilai |
|---|---|---|---|
| `status_anggota` | `status_anggota_enum` | **PERAN KELUARGA** (family role) | `pegawai, istri, suami, anak, meninggal` |
| `kategori_anggota` | `kategori_anggota_enum` | **TIER KEANGGOTAAN** (dasar jasa/pensiun) | `biasa, luar_biasa, kehormatan` |
| `status_mps` | `status_mps_enum` | **JENIS MANFAAT PENSIUN** | `mps, non_mps` |
| `status_iuran` | `status_iuran_enum` | **STATUS IURAN** | `iuran, tidak_iuran` |
| `status_kepesertaan` | `VARCHAR(50)` | **FIELD BEBAS (tambahan)** — tidak tervalidasi | free text (mis. `Aktif` dari import) |

**Temuan penting:**

- **Tidak ada** representasi "anggota berhenti / non-aktif" di `anggota`. Tidak ada enum value,
  tidak ada kolom terotorisasi. Soft delete (`deleted_at`) dipakai untuk **hapus**, bukan berhenti.
- `status_anggota_enum` **shared** dengan `dana_kematian.status_anggota`
  (terkonfirmasi di `002_create_dana_kematian_table.sql`: `status_anggota status_anggota_enum NOT NULL`).
  Menambah nilai `berhenti` ke enum ini **berisiko** ke modul Dana Kematian & UI yang me-map enum tersebut.
- `status_kepesertaan` sudah ditandai di `SIPATEL_ARCHITECTURAL_AUDIT.md` sebagai
  *"Free text, no validation — likely should be derived"*. Kolom ini dipakai di
  `DetailModal`, `ExportExcelModal`, `ImportExcelModal`, `MemberFormModalTabbed`, dan `batch-import`,
  sehingga **tidak aman** dijadikan penentu tunggal status keanggotaan (rawan typo & data lama kosong).
- Enum `status_kepemilikan_enum` pada `nik_kepemilikan` **sudah** punya `aktif / non_aktif / meninggal / dicabut`.
  Artinya domain sudah mengenal konsep "non-aktif" & "dicabut", tetapi **hanya untuk kepemilikan NIK**,
  bukan untuk keanggotaan.

### 3.2 Mekanisme perubahan status anggota yang sudah ada

| Jalur | Perilaku | File |
|---|---|---|
| **Edit Data Anggota** | Admin → langsung `PUT /api/anggota/[id]`. Non-admin → insert `anggota_perubahan` (`jenis='edit'`, `status='menunggu'`), data utama **tidak** berubah sampai admin menyetujui. | `app/api/anggota/[id]/route.ts`, `app/api/anggota/approvals/[id]/route.ts` |
| **Hapus Anggota** | Admin → soft delete (`deleted_at`). Non-admin → usulan `jenis='hapus'`. Diblokir bila ada pengajuan Dana Kematian aktif (`hasActiveDakemTransactions`). | idem |
| **Tambah/Create Anggota** | Admin → langsung. Non-admin → `anggota_perubahan` `jenis='create'` (migration 028). | `app/api/anggota/route.ts` |
| **Entry Meninggal Dunia** | **Langsung tanpa approval** → insert `anggota_kematian` + sinkron `status_anggota='meninggal'` (idempotent). | `app/api/anggota-kematian/*`, `lib/server/anggota-kematian-service.ts` |
| **Mutasi Cabang** | Pengajuan `menunggu → diverifikasi_pc → disetujui_pp` / `ditolak` / `dibatalkan`. | `app/api/mutasi-cabang/*`, `lib/workflow/mutasi-cabang-status.ts` |

**Audit trail:** perubahan baris `anggota` otomatis tercatat di `anggota_history`
(trigger `track_anggota_changes`, migration `003_create_anggota_history_table.sql`).
Perubahan cabang juga dicatat append-only ke `anggota_mutasi` oleh `recordMutasiIfCabangChanged`.

### 3.3 Pola Modul Data Meninggal Dunia (referensi terdekat — "fakta level anggota")

- Tabel `anggota_kematian` dengan `anggota_id UUID NOT NULL UNIQUE` → **satu fakta per anggota**.
- Field: `tanggal_meninggal`, `file_surat_kematian`, `metadata JSONB`, `dicatat_oleh`, `dicatat_pada`,
  `updated_at`, `deleted_at` (soft delete).
- **Tanpa approval** (keputusan klien: `docs/entry-meninggal-dunia-audit.md` §14).
- Service menyediakan `markAnggotaMeninggal()` (idempotent, `.neq('status_anggota','meninggal')`)
  dan `hasActiveAnggotaKematian()` (cegah duplikasi).
- API: `GET/POST /api/anggota-kematian`, `GET/PUT/DELETE /api/anggota-kematian/[id]`,
  `GET /api/anggota/[id]/kematian` (lookup prefill).
- Permission granular `manage_kematian_anggota` + grup `ENTRY_KEMATIAN_MANAGE_PERMISSIONS`.
- Menu: **"Data Meninggal Dunia"** → `/keanggotaan/entry-meninggal-dunia`.
- Upload ke bucket `anggota`, folder `surat-kematian` (whitelist di `app/api/upload/route.ts` & `AnggotaFolder`).

**Pola yang layak diadopsi:** tabel fakta 1:1 + snapshot kolom identitas, service guard duplikasi,
permission granular, folder storage khusus, halaman `keanggotaan/*` dengan form + riwayat.

### 3.4 Pola Modul Mutasi Cabang (referensi terdekat — "pengajuan + approval")

- Tabel `pengajuan_mutasi_cabang` (migration 029, ditambah kolom tujuan di 030).
- **Snapshot identitas** disimpan di baris pengajuan (`nik`, `nama_anggota`, `cabang_asal`, `kode_cabang_asal`)
  agar tahan terhadap perubahan data induk.
- Kolom dokumen: `nomor_dokumen_mutasi`, `tanggal_dokumen_mutasi`, `tanggal_mulai_mutasi`.
- **Constraint DB yang bisa direplikasi:**
  - `CHECK (tanggal_dokumen_mutasi <= tanggal_mulai_mutasi)` — urutan tanggal.
  - `CHECK (length(btrim(nomor_dokumen_mutasi)) >= 3)` — nomor tidak kosong.
  - Partial unique index **satu pengajuan aktif per anggota**
    (`WHERE status IN ('menunggu','diverifikasi_pc')`).
  - Partial unique index **nomor dokumen unik** untuk status `menunggu/diverifikasi_pc/disetujui_pp`.
- Workflow terpusat di `lib/workflow/mutasi-cabang-status.ts`
  (`MUTASI_CABANG_STATUSES`, `..._TRANSITIONS`, `isValidMutasiCabangTransition`, `isMutasiCabangActive`).
- API: `GET/POST /api/mutasi-cabang`, `GET/PATCH /api/mutasi-cabang/[id]`; PATCH memvalidasi transisi.
- Permission: `manage_keanggotaan` (submit & verifikasi).

**⚠️ Catatan gap existing (jangan diulang di fitur baru):**
`PATCH /api/mutasi-cabang/[id]` saat `disetujui_pp` **hanya** mengubah `status` baris pengajuan.
Ia **tidak** meng-update `anggota.nama_cabang`/`kode_cabang` dan **tidak** memanggil
`recordMutasiIfCabangChanged`. Artinya persetujuan mutasi belum otomatis mengubah cabang anggota.
Untuk Pengakhiran Keanggotaan, langkah "apply status" **wajib** dijalankan **atomik** saat
`disetujui_pp` (lihat §7.3).

### 3.5 Pola Pendaftaran Anggota Baru

- Menu `/keanggotaan/pendaftaran-anggota-baru` **memakai ulang** fitur Tambah Anggota
  (`POST /api/anggota`) — validasi wajib, cek duplikasi NIK, dan **alur approval yang sama**
  (`anggota_perubahan` jenis `create` untuk non-admin).
- Tidak ada tabel/logika khusus "pendaftaran" → **prinsip: jangan buat mekanisme duplikat**.

### 3.6 Role & permission

- Permission berbasis slug di `lib/rbac.ts` (`PERMISSIONS`), grouping di `PERMISSION_GROUPS`
  (`KEANGGAOTAAN` sudah memuat `access_keanggotaan`, `view_keanggotaan`, `manage_keanggotaan`,
  `history_anggota_view/manage`, `manage_kematian_anggota`).
- Role: `ROLES = { administrator, user, ketua-1 }`; `ADMIN_ROLE_SLUGS = ['admin','administrator','owner']`
  (`lib/server/anggota-service.ts`). Administrator selalu lolos (`hasPermission`/`hasAnyPermission`).
- Kapabilitas **PC/PP** saat ini berupa permission Dana Kematian:
  `dana_kematian.manage_pc` (PC/cabang) & `dana_kematian.verify_pp` (PP/pusat) — dipakai sebagai
  alias akses fitur keanggotaan (lihat `ENTRY_KEMATIAN_MANAGE_PERMISSIONS`).
- Server-side: `requirePermission()` / `requireAnyPermission()` → throw `UNAUTHORIZED`/`FORBIDDEN`
  (`lib/rbac-server.ts`). **Tidak ada** pembatasan data per-cabang di level helper (semua berbasis permission).
- `DEFAULT_ROLE_PERMISSIONS`: `ketua-1` = manage keanggotaan + pelayanan + keuangan.

### 3.7 Kondisi "berhenti" saat ini — TIDAK ADA

| Aspek | Kondisi existing |
|---|---|
| Status anggota berhenti/non-aktif | ❌ Tidak ada (hanya `meninggal` di `status_anggota_enum`) |
| Alasan berhenti | ❌ Tidak ada |
| Tanggal efektif berhenti | ❌ Tidak ada (ada `tanggal_mutasi` untuk mutasi) |
| Nomor/tanggal dokumen berhenti | ❌ Tidak ada |
| Upload dokumen pendukung | ❌ Tidak ada (folder khusus belum ada) |
| Riwayat keputusan | ❌ Tidak ada |
| Pencegahan duplikasi | ❌ Tidak ada |
| Soft delete sebagai alternatif | ⚠️ Ada, tetapi maknanya "hapus", bukan "berhenti" |

**Kesimpulan:** fitur ini benar-benar baru; tidak ada mekanisme existing yang bisa dipakai ulang
selain **pola** (member picker, upload, RBAC, workflow) dari modul Meninggal Dunia & Mutasi Cabang.

---

## 4. Analisis Kesenjangan (Gap Analysis)

| # | Kebutuhan klien | Kondisi existing | Gap |
|---|---|---|---|
| 1 | Menu khusus Pengakhiran Keanggotaan | Belum ada (hanya edit `status_anggota` di Pengelolaan Data) | Perlu menu + halaman/form baru |
| 2 | Pilih Anggota dari data existing | Pola combobox/`MemberSearchModal` sudah ada | Reuse |
| 3 | NIK & Nama terisi otomatis | `anggota.nik`, `anggota.nama_anggota` | Reuse (read-only) |
| 4 | Cabang/PC terisi otomatis | `anggota.nama_cabang`, `kode_cabang` | Reuse (read-only + snapshot) |
| 5 | Alasan berhenti (enum) | Belum ada | Perlu enum `alasan_pengakhiran_enum` |
| 6 | Tanggal efektif berhenti | Belum ada | Perlu kolom + validasi |
| 7 | Nomor & tanggal dokumen | Ada pola di `pengajuan_mutasi_cabang` | Reuse pola (constraint yang sama) |
| 8 | Keterangan | — | Kolom `keterangan` |
| 9 | Upload dokumen pendukung | Pola upload + folder bucket `anggota` | Perlu folder baru di whitelist |
| 10 | Anggota berhenti tidak diproses aktif | Semua modul memakai `anggota` tanpa status lifecycle | Perlu kolom penanda + guard di modul terkait |
| 11 | Data historis tidak hilang | Pola append-only & soft delete | Tabel baru **tanpa** hapus data anggota |
| 12 | Riwayat & alasan jelas | `anggota_history` hanya mencatat perubahan baris | Tabel `pengakhiran_keanggotaan` menyimpan alasan + keputusan |
| 13 | Keputusan: langsung vs approval | Ada dua pola existing (langsung vs 2 tahap) | **Perlu keputusan bisnis** (§7) |
| 14 | Cegah pengajuan ganda | Ada pola partial unique index (mutasi) | Replikasi index |
| 15 | Dampak ke modul lain | Dana Kematian belum memfilter status lifecycle | Perlu guard baca `status_keanggotaan` |

---

## 5. Opsi Desain & Rekomendasi

### 5.1 Penanda status keanggotaan — pilihan

#### Opsi A — Kolom baru `anggota.status_keanggotaan` (enum baru) — **REKOMENDASI ✅**

```sql
CREATE TYPE status_keanggotaan_enum AS ENUM ('aktif', 'berhenti');
ALTER TABLE anggota
  ADD COLUMN IF NOT EXISTS status_keanggotaan status_keanggotaan_enum
  NOT NULL DEFAULT 'aktif';
```

**Kelebihan**

- Semantik jelas: *siklus hidup keanggotaan*, terpisah dari 5 field status existing.
- **Tidak menyentuh** `status_anggota_enum` yang *shared* dengan `dana_kematian`.
- Backward compatible: baris lama otomatis `'aktif'` lewat `DEFAULT`, tanpa backfill manual.
- Guard lintas modul murah & sederhana: `.eq('status_keanggotaan','aktif')` tanpa join.
- Extensible: bisa menambah `'non_aktif'` (skorsing) di masa depan tanpa mengubah modul lain.

**Kekurangan**

- Satu kolom + satu enum baru di `anggota` (tabel sudah lebar).
- Perlu disiplin: modul-modul yang menampilkan/memilih anggota harus mulai memperhitungkan field ini
  (bertahap, lihat §8).

#### Opsi B — Tambah nilai ke `status_anggota_enum` (`'berhenti'` / `'non_aktif'`) — ❌ DITOLAK

- `status_anggota` adalah **peran keluarga** (family role), bukan status keanggotaan.
- Enum **dipakai bersama** `dana_kematian.status_anggota` → seluruh map label/`Badge`/validasi
  Dana Kematian ikut terdampak.
- Berpotensi memengaruhi logika **pewarisan NIK** (yang bergantung pada `status_anggota='meninggal'`).
- Audit sebelumnya eksplisit: *"Do NOT modify the enum."*

#### Opsi C — Pakai `status_kepesertaan` (VARCHAR free text) — ❌ DITOLAK

- Tidak tervalidasi (rawan typo: `Aktif`, `aktif`, `AKTIF`, `Non Aktif`).
- Sudah dipakai import/export & form edit → data lama campur, tidak bisa dijadikan penentu tunggal.
- Ditandai di audit arsitektur sebagai *"likely should be derived"*, bukan sumber otoritatif.

#### Opsi D — Pakai soft delete (`anggota.deleted_at`) — ❌ DITOLAK

- Berhenti ≠ dihapus. Anggota berhenti harus tetap tampil (dengan status), bukan hilang dari daftar.
- Merusak laporan historis & relasi (mis. `dana_kematian.anggota_id` → `ON DELETE SET NULL`).
- Tidak menyimpan alasan/tanggal/dokumen.

### 5.2 Penyimpanan fakta pengakhiran — pilihan

#### Opsi A — Tabel baru `pengakhiran_keanggotaan` (1:1 per anggota) — **REKOMENDASI ✅**

Mengikuti pola `anggota_kematian`: satu baris fakta per anggota, snapshot identitas, dokumen,
audit pelaku. Ditambah kolom workflow (mengikuti pola `pengajuan_mutasi_cabang`).

#### Opsi B — Tambah kolom langsung di `anggota` (alasan, tanggal, nomor dokumen, dst.)

- Menambah **6–10 kolom** ke tabel `anggota` yang sudah lebar; mencampur master data dengan data proses.
- Sulit menyimpan riwayat keputusan (pengaju/verifikator/penyetuju/waktu) tanpa kolom audit berulang.
- Tidak extensible bila kelak butuh multi-dokumen atau pembatalan.

#### Opsi C — Pakai `anggota_perubahan` (approval existing) dengan `data_usulan` khusus

- Menumpangkan "pengakhiran" ke mekanisme approval edit generik.
- **Ditolak** karena: (a) `anggota_perubahan` tidak punya kolom dokumen/alasan terstruktur,
  (b) mencampur dua konsep (edit data vs proses pengakhiran) → query & audit jadi kabur,
  (c) tidak bisa menyimpan nomor/tanggal dokumen secara ter-indeks/tervalidasi.

### Matriks perbandingan

| Kriteria | A (kolom + tabel baru) | B (status_anggota_enum) | C (status_kepesertaan) | D (soft delete) |
|---|---|---|---|---|
| Tidak merusak enum shared | ✅ | ❌ | ✅ | ✅ |
| Semantik benar (lifecycle vs family role) | ✅ | ❌ | ⚠️ | ❌ |
| Data historis tetap tampil | ✅ | ✅ | ✅ | ❌ |
| Menyimpan alasan + dokumen + approval | ✅ | ❌ | ❌ | ❌ |
| Guard lintas modul murah | ✅ | ⚠️ | ❌ | ❌ |
| Extensible (skorsing, reaktivasi) | ✅ | ⚠️ | ❌ | ❌ |
| Risiko regresi modul existing | Rendah | **Tinggi** | Sedang | Sedang |

**Rekomendasi final: kombinasi Opsi A (kolom `status_keanggotaan`) + Opsi A (tabel `pengakhiran_keanggotaan`).**

---

## 6. Usulan Struktur Data (migration `032` — draft)

Migration bersifat **idempotent & additive** (pola migration 029/031). Tidak mengubah data lama.

```sql
-- 032_create_pengakhiran_keanggotaan.sql

-- 1) Enum siklus hidup keanggotaan + kolom di anggota (baris lama otomatis 'aktif')
DO $$ BEGIN
  CREATE TYPE status_keanggotaan_enum AS ENUM ('aktif', 'berhenti');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE anggota
  ADD COLUMN IF NOT EXISTS status_keanggotaan status_keanggotaan_enum
  NOT NULL DEFAULT 'aktif';

-- 2) Enum alasan & status pengakhiran
DO $$ BEGIN
  CREATE TYPE alasan_pengakhiran_enum AS ENUM
    ('mengundurkan_diri', 'pensiun', 'diberhentikan', 'lainnya');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE pengakhiran_status_enum AS ENUM
    ('menunggu', 'diverifikasi_pc', 'disetujui_pp', 'ditolak', 'dibatalkan');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3) Tabel fakta pengakhiran (1 baris aktif/anggota)
CREATE TABLE IF NOT EXISTS pengakhiran_keanggotaan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  anggota_id UUID NOT NULL REFERENCES anggota(id) ON DELETE CASCADE,

  -- Snapshot identitas (tahan perubahan data induk) + pelaku
  diajukan_oleh VARCHAR(255) NOT NULL,
  nik VARCHAR(25),
  nama_anggota VARCHAR(255),
  nama_cabang VARCHAR(120),
  kode_cabang VARCHAR(20),

  -- Fakta pengakhiran
  alasan alasan_pengakhiran_enum NOT NULL,
  keterangan_alasan TEXT,            -- wajib bila alasan = 'lainnya' (divalidasi API)
  tanggal_efektif_berhenti DATE NOT NULL,
  nomor_dokumen VARCHAR(255) NOT NULL,
  tanggal_dokumen DATE NOT NULL,
  keterangan TEXT,
  file_dokumen_pendukung TEXT,       -- URL (bucket anggota / folder surat-pengakhiran)
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Workflow (pola pengajuan_mutasi_cabang)
  status pengakhiran_status_enum NOT NULL DEFAULT 'menunggu',
  catatan_pengaju TEXT,
  diverifikasi_oleh VARCHAR(255),
  diverifikasi_pada TIMESTAMPTZ,
  catatan_verifikasi TEXT,
  diputuskan_oleh VARCHAR(255),
  diputuskan_pada TIMESTAMPTZ,
  alasan_keputusan TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  deleted_at TIMESTAMPTZ
);

-- 4) Constraint urutan & kelengkapan
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pengakhiran_tanggal_order') THEN
    ALTER TABLE pengakhiran_keanggotaan
      ADD CONSTRAINT pengakhiran_tanggal_order
      CHECK (tanggal_dokumen <= tanggal_efektif_berhenti);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pengakhiran_nomor_tidak_kosong') THEN
    ALTER TABLE pengakhiran_keanggotaan
      ADD CONSTRAINT pengakhiran_nomor_tidak_kosong
      CHECK (length(btrim(nomor_dokumen)) >= 3);
  END IF;
END $$;

-- 5) Index
CREATE INDEX IF NOT EXISTS idx_pengakhiran_anggota
  ON pengakhiran_keanggotaan(anggota_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pengakhiran_status
  ON pengakhiran_keanggotaan(status);
CREATE INDEX IF NOT EXISTS idx_pengakhiran_not_deleted
  ON pengakhiran_keanggotaan(id) WHERE deleted_at IS NULL;

-- 6) Pencegahan duplikasi (pola partial unique index mutasi)
--    a) Hanya satu pengajuan aktif (menunggu / diverifikasi_pc) per anggota.
CREATE UNIQUE INDEX IF NOT EXISTS uq_pengakhiran_aktif_per_anggota
  ON pengakhiran_keanggotaan(anggota_id)
  WHERE status IN ('menunggu', 'diverifikasi_pc');

--    b) Hanya satu pengakhiran final (disetujui) per anggota.
CREATE UNIQUE INDEX IF NOT EXISTS uq_pengakhiran_final_per_anggota
  ON pengakhiran_keanggotaan(anggota_id)
  WHERE status = 'disetujui_pp' AND deleted_at IS NULL;

--    c) Nomor dokumen unik untuk pengajuan yang belum ditolak/dibatalkan.
CREATE UNIQUE INDEX IF NOT EXISTS uq_pengakhiran_nomor_aktif
  ON pengakhiran_keanggotaan(lower(btrim(nomor_dokumen)))
  WHERE status IN ('menunggu', 'diverifikasi_pc', 'disetujui_pp');

-- 7) Trigger updated_at + RLS (pola migration 029/031)
DROP TRIGGER IF EXISTS trg_pengakhiran_updated_at ON pengakhiran_keanggotaan;
CREATE TRIGGER trg_pengakhiran_updated_at
  BEFORE UPDATE ON pengakhiran_keanggotaan
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE pengakhiran_keanggotaan ENABLE ROW LEVEL SECURITY;
```

**Catatan desain:**

- **`keterangan_alasan` vs `keterangan`:** `keterangan_alasan` wajib diisi hanya bila
  `alasan='lainnya'` (divalidasi di API, bukan constraint DB, agar pesan error jelas —
  pola `MPS rule` di migration 023). `keterangan` = catatan umum opsional.
- **`status_keanggotaan` default `'aktif'`:** seluruh baris anggota lama langsung valid tanpa migrasi data.
- **UNIQUE final per anggota (`disetujui_pp`)** mencegah dua pengakhiran yang sama-sama final;
  bila anggota diaktifkan kembali lalu berhenti lagi, record lama harus di-*soft-delete* dulu
  sebelum pengajuan baru — lihat §11 (pertanyaan reaktivasi).
- **RLS:** akses selalu lewat API (service role), sama seperti migration 027/029/031.

---

## 7. Desain Menu, Form, RBAC, dan Workflow

### 7.1 Nama menu (rekomendasi)

| Opsi | Penilaian |
|---|---|
| **"Pengakhiran Keanggotaan"** ✅ | Formal, sesuai bahasa klien, selaras dengan "Pendaftaran Anggota Baru". |
| "Pemberhentian Anggota" | Kurang netral; "diberhentikan" hanyalah salah satu alasan. |
| "Data Berhenti" | Paralel dengan "Data Meninggal Dunia", tetapi kurang formal. |
| "Keanggotaan Berakhir" | Ambigu dengan kematian. |

**Rekomendasi: "Pengakhiran Keanggotaan"**, path `/keanggotaan/pengakhiran-keanggotaan`
(konsisten dengan `entry-meninggal-dunia`), ditempatkan setelah "Data Meninggal Dunia".

```tsx
{
  title: 'Pengakhiran Keanggotaan',
  path: '/keanggotaan/pengakhiran-keanggotaan',
  permissions: [...PENGAKHIRAN_MANAGE_PERMISSIONS],
}
```

### 7.2 Field form + aturan validasi

| Field | Sumber | Wajib | Aturan validasi |
|---|---|---|---|
| Pilih Anggota | combobox `anggota` (reuse pola `entry-meninggal-dunia`) | ✅ | Server-side resolve `anggota_id`; hanya `status_keanggotaan='aktif'` (atau NULL), `deleted_at IS NULL`, dan `status_anggota <> 'meninggal'` |
| NIK | read-only dari anggota | — | Auto |
| Nama Anggota | read-only | — | Auto |
| Cabang/PC | read-only | — | Auto (tampil `nama_cabang` + `kode_cabang`) |
| Alasan Berhenti | select enum | ✅ | `mengundurkan_diri / pensiun / diberhentikan / lainnya` |
| Keterangan Alasan | textarea | ⚠️ | Wajib bila `alasan='lainnya'` (min. 1 kata) |
| Tanggal Efektif Berhenti | date | ✅ | Tidak boleh di masa depan (konsisten validasi `tanggal_meninggal`) — **konfirmasi §11** |
| Nomor Dokumen | input | ✅ | min. 3 karakter; unik antar pengajuan aktif/final |
| Tanggal Dokumen | date | ✅ | `tanggal_dokumen <= tanggal_efektif_berhenti` |
| Keterangan | textarea | ❌ | — |
| Upload Dokumen Pendukung | upload API | ⚠️ | Opsional (default); **rekomendasi:** wajib bila `alasan='diberhentikan'` (SK pemberhentian) — **konfirmasi §11** |

**Pencegahan duplikasi / konflik (server-side, sebelum insert):**

- Sudah ada pengakhiran **aktif** (`menunggu`/`diverifikasi_pc`) → `409 DUPLICATE_ACTIVE`.
- Sudah `status_keanggotaan='berhenti'` → blokir / arahkan ke tampilan data berhenti.
- `status_anggota='meninggal'` → tolak (gunakan modul Data Meninggal Dunia, bukan pengakhiran).
- Ada pengajuan **Mutasi Cabang** aktif → blokir (satu proses lifecycle per anggota) — **konfirmasi §11**.
- Ada pengajuan **Dana Kematian** berjalan (belum `selesai`/`batal`) → blokir — **konfirmasi §11**.
- Nomor dokumen sudah dipakai pengajuan aktif/final → `409 DOCUMENT_NUMBER_USED`.

### 7.3 Workflow pengajuan & persetujuan (rekomendasi)

Dua opsi existing; **rekomendasi Opsi A** (selaras dengan Mutasi Cabang, karena pengakhiran
melibatkan dokumen & dampak signifikan):

#### Opsi A — 2 tahap (PC verifikasi → PP setujui) ✅ REKOMENDASI

```
menunggu ─────┬→ diverifikasi_pc ──┬→ disetujui_pp  (apply status_keanggotaan='berhenti')
              │                    ├→ ditolak       (terminal)
              │                    └→ dibatalkan    (terminal)
              └→ ditolak / dibatalkan
```

- Submit: PC/cabang (`manage_keanggotaan` atau `dana_kematian.manage_pc`).
- Verifikasi: PC (`manage_keanggotaan`).
- Keputusan akhir: PP/pusat (`manage_keanggotaan` atau `dana_kematian.verify_pp`).
- **Kunci:** saat transisi ke `disetujui_pp`, handler **harus** meng-update
  `anggota.status_keanggotaan = 'berhenti'` bersamaan dengan update baris pengajuan.
  Karena Supabase client tidak punya transaksi lintas-tabel, lakukan berurutan: update anggota
  **dulu** → bila gagal, hentikan (status pengajuan tetap `diverifikasi_pc`, bisa diulang);
  bila berhasil → update pengajuan ke `disetujui_pp`. Log kegagalan dicatat (pola fail-safe
  `markAnggotaMeninggal`). Inilah pelajaran dari gap Mutasi Cabang (§3.4).

#### Opsi B — Langsung dicatat (seperti Data Meninggal Dunia)

- Petugas dengan permission `manage_pengakhiran_keanggotaan` mencatat langsung;
  `status_keanggotaan` langsung `'berhenti'`. Tidak ada tahap verifikasi.
- Lebih sederhana, cocok bila klien menilai approval berlebihan. Struktur tabel yang sama tetap
  dipakai (kolom workflow diisi langsung `disetujui_pp` + `dicatat_oleh`).

**Keputusan bisnis (Opsi A vs B) dibutuhkan sebelum implementasi — lihat §11.**

### 7.4 RBAC (usulan permission baru)

- `MANAGE_PENGAKHIRAN_KEANGGOTAAN: 'manage_pengakhiran_keanggotaan'` — akses menu + submit + verifikasi.
- `APPROVE_PENGAKHIRAN_KEANGGOTAAN: 'approve_pengakhiran_keanggotaan'` — keputusan final (PP) —
  opsional; bila ingin sederhana (pola mutasi), cukup pakai `manage_keanggotaan`.
- Grup untuk menu/daftar akses (pola `ENTRY_KEMATIAN_MANAGE_PERMISSIONS`):

```ts
export const PENGAKHIRAN_MANAGE_PERMISSIONS = [
  PERMISSIONS.MANAGE_KEANGGOTAAN,
  PERMISSIONS.MANAGE_PENGAKHIRAN_KEANGGOTAAN,
  PERMISSIONS.DAKEM_MANAGE_PC,
  PERMISSIONS.DAKEM_VERIFY_PP,
];
```

- Seed permission mengikuti `prisma/data/permissions.js` & pola migration 013.
- Administrator selalu lolos (`hasAnyPermission`).

### 7.5 API (usulan)

| Endpoint | Metode | Fungsi |
|---|---|---|
| `/api/pengakhiran-keanggotaan` | GET | Daftar pengakhiran (filter status/pencarian/pagination) |
| `/api/pengakhiran-keanggotaan` | POST | Ajukan pengakhiran (validasi §7.2, cegah duplikasi) |
| `/api/pengakhiran-keanggotaan/[id]` | GET | Detail |
| `/api/pengakhiran-keanggotaan/[id]` | PATCH | Verifikasi (`diverifikasi_pc`) / keputusan (`disetujui_pp`/`ditolak`/`dibatalkan`) — validasi transisi + **apply status saat disetujui** |
| `/api/anggota/[id]/pengakhiran` | GET | Lookup status pengakhiran anggota (guard/prefill modul lain) |

---

## 8. Dampak terhadap Modul SIPATEL Lainnya

### 8.1 Dana Kematian

| Aspek | Dampak / Tindakan |
|---|---|
| Pengajuan **baru** untuk anggota berhenti | **Blokir** di `MemberSearchModal`/`handleMemberSelect` dan di `POST /api/dana-kematian` (guard `status_keanggotaan <> 'berhenti'`). Anggota berhenti bukan peserta aktif. |
| Pengajuan **lama** (historis) | **Tidak berubah.** `dana_kematian` menyimpan snapshot (`nama_anggota`, `status_anggota`, `status_mps`, `tanggal_meninggal`, dokumen) — tetap tampil & dapat diproses sesuai workflow. |
| Pengakhiran saat Dakem **berjalan** | Rekomendasi: blokir (belum `selesai`/`batal`) agar tidak ada anggota berstatus berhenti dengan klaim aktif. Perlu keputusan §11. |
| Enum & workflow Dakem | **Tidak disentuh** (tidak ada perubahan `status_anggota_enum`, `status_proses_dakem_enum`, state machine, claim, SLA). |
| Pewarisan NIK | Tetap hanya untuk `status_anggota='meninggal'`. `status_keanggotaan='berhenti'` **tidak** membuka menu "Wariskan NIK". |

### 8.2 Mutasi Cabang

| Aspek | Dampak / Tindakan |
|---|---|
| Pengajuan mutasi untuk anggota berhenti | **Blokir** (anggota tidak aktif tidak dapat dimutasikan). |
| Pengakhiran saat mutasi **aktif** | Rekomendasi: blokir; minta batalkan pengajuan mutasi dulu (satu proses lifecycle per anggota). |
| Data `anggota_mutasi` | Tidak berubah. Riwayat mutasi tetap append-only. |
| Gap existing | Persetujuan mutasi belum meng-apply cabang (lihat §3.4). Pengakhiran **tidak** boleh mengikuti pola gap ini. |

### 8.3 Pendaftaran Anggota Baru & Pengelolaan Data

- Tambah anggota baru → default `status_keanggotaan='aktif'` (otomatis via DB default; tidak perlu field baru di form create).
- Tampilkan **badge status keanggotaan** di `MemberFormModal`/`DetailModal`/tabel pengelolaan data
  (mis. `Aktif` / `Berhenti`) agar petugas melihat status tanpa membuka menu lain.
- Field `status_keanggotaan` **tidak** boleh diubah manual lewat form Edit (protected, seperti
  `status_anggota`/`kategori_anggota`) — perubahan hanya lewat modul Pengakhiran atau proses reaktivasi resmi (§11).
- Edit data umum anggota berhenti: sebaiknya **read-only** atau dibatasi (hanya perbaikan data
  historis oleh admin) agar tidak "menghidupkan" kembali proses aktif.

### 8.4 Keuangan / Iuran

- `mekanisme-iuran` & laporan keuangan sebaiknya **mengecualikan** anggota berhenti dari tagihan iuran aktif
  (penagihan baru), tanpa menghapus riwayat iuran lama.
- Perlu filter `status_keanggotaan='aktif'` pada query penagihan/pelaporan iuran (fase lanjutan).

### 8.5 Dashboard, Laporan & Export

- Statistik "Anggota Aktif" harus memakai `status_keanggotaan='aktif'` (bukan hanya `deleted_at IS NULL`).
- Export Excel: tambahkan kolom `status_keanggotaan` (dan `alasan`/`tanggal_efektif` bila perlu) di
  `components/anggota/ExportExcelModal.tsx` — opsional fase lanjutan.

### 8.6 Notifikasi

- Opsional (pola `lib/server/create-notification.ts` & `notification_routing`): notifikasi ke PP saat
  ada pengajuan baru; ke pengaju saat keputusan. Belum wajib untuk MVP — lihat §11.

---

## 9. Business Rules (ringkasan rekomendasi)

1. Anggota hanya dapat berhenti bila `status_keanggotaan = 'aktif'` (atau NULL untuk data lama) dan
   `status_anggota <> 'meninggal'`.
2. Satu anggota maksimal satu pengakhiran **aktif** dan satu pengakhiran **final** (partial unique index).
3. Status `berhenti` hanya diterapkan **setelah disetujui** (Opsi A) atau **saat dicatat** (Opsi B),
   dan **tidak pernah** lewat Edit Data Anggota biasa.
4. Data anggota **tidak dihapus** saat berhenti (tanpa soft delete pada `anggota`); riwayat dipertahankan.
5. Pengakhiran menyimpan alasan, tanggal efektif, nomor & tanggal dokumen, keterangan, dokumen pendukung,
   serta riwayat pengaju/verifikator/penyetuju + waktu + catatan.
6. Nomor dokumen unik untuk pengajuan aktif/final; `tanggal_dokumen <= tanggal_efektif_berhenti`.
7. Anggota berhenti **tidak** dapat: diajukan Dana Kematian baru, diajukan mutasi, atau diproses
   sebagai anggota aktif di proses keanggotaan lain.
8. Pengajuan/pencatatan ganda dicegah di **dua lapis**: API (guard) + partial unique index (DB).
9. `status_anggota_enum` **tidak diubah** (shared dengan `dana_kematian`).
10. Perubahan `status_keanggotaan` tercatat otomatis di `anggota_history` (trigger existing).

---

## 10. Risiko & Mitigasi

| Risiko | Level | Mitigasi |
|---|---|---|
| Mengubah enum shared `status_anggota_enum` | **Tinggi** | Tidak disentuh; pakai kolom/enum baru. |
| Anggota berhenti masih diproses aktif | Sedang | Kolom `status_keanggotaan` + guard di `POST` modul terkait (Dakem, Mutasi). |
| Pengajuan ganda | Sedang | Guard API + partial unique index (aktif & final). |
| Ketidakkonsistenan apply status (seperti gap Mutasi Cabang) | Sedang | Apply `status_keanggotaan='berhenti'` saat `disetujui_pp`, dengan urutan aman & log kegagalan. |
| Data historis rusak/hilang | Rendah | Migration `IF NOT EXISTS`/additive; `DEFAULT 'aktif'`; tanpa soft delete; append-only. |
| Regresi workflow Dana Kematian | Rendah | Tidak ada perubahan schema/workflow Dakem; hanya guard `status_keanggotaan` pada pembuatan baru. |
| `keterangan_alasan='lainnya'` tidak diisi | Rendah | Validasi API (wajib bila `alasan='lainnya'`). |
| Reaktivasi salah catat | Sedang | MVP tanpa reaktivasi otomatis; koreksi via admin + soft delete record pengakhiran (audit tetap ada). |

---

## 11. Pertanyaan Terbuka untuk Klien (sebelum implementasi)

1. **Workflow:** pengakhiran perlu persetujuan 2 tahap (PC → PP, seperti Mutasi Cabang) atau boleh
   langsung dicatat (seperti Data Meninggal Dunia)? *(Rekomendasi: 2 tahap.)*
2. **Daftar alasan:** apakah "Pensiun" relevan untuk organisasi pensiunan (semua anggota pensiunan)?
   Perlu nilai tambahan (mis. "keluar organisasi", "pindah ke organisasi lain")?
3. **Status sementara:** apakah perlu status `non_aktif` (skorsing sementara) selain `berhenti` (permanen)?
4. **Kapan status berlaku:** langsung saat disetujui, atau menunggu `tanggal_efektif_berhenti`
   (scheduled)? *(Rekomendasi MVP: langsung saat disetujui; tanggal efektif hanya data informasi.)*
5. **Dokumen pendukung:** wajib atau opsional? Apakah wajib untuk alasan `diberhentikan`?
   *(Rekomendasi: opsional umum; wajib untuk `diberhentikan`.)*
6. **Blokir konflik:** apakah pengakhiran diblokir bila ada pengajuan Dana Kematian / Mutasi Cabang
   yang sedang berjalan? *(Rekomendasi: ya, blokir.)*
7. **Reaktivasi:** apakah anggota berhenti dapat aktif kembali? Bila ya, mekanismenya (admin, approval, alasan)?
8. **Tanggal efektif masa depan:** apakah `tanggal_efektif_berhenti` boleh lebih dari hari ini?
   *(Rekomendasi: tidak.)*
9. **Notifikasi:** perlukah notifikasi ke PP saat ada pengajuan, dan ke pengaju saat keputusan?
10. **Sinkronisasi dengan meninggal:** apakah anggota `status_anggota='meninggal'` perlu otomatis
    berstatus `berhenti` keanggotaannya, atau dibiarkan terpisah? *(Rekomendasi: biarkan terpisah.)*

---

## 12. Rencana Implementasi Bertahap (setelah keputusan bisnis disetujui)

1. **Migration** `032_create_pengakhiran_keanggotaan.sql` (+ tipe TS `PengakhiranKeanggotaan`,
   `PengakhiranKeanggotaanWithAnggota`, `CreatePengakhiranKeanggotaanInput`, `PengakhiranKeanggotaanFilter`).
2. **Storage** folder `surat-pengakhiran` (atau `dokumen-pengakhiran`) di bucket `anggota`
   (`lib/supabase-storage.ts` tipe `AnggotaFolder`, whitelist `app/api/upload/route.ts`).
3. **Workflow status** `lib/workflow/pengakhiran-keanggotaan-status.ts` (pola `mutasi-cabang-status.ts`).
4. **Service** `lib/server/pengakhiran-keanggotaan-service.ts` (`markAnggotaBerhenti` idempotent,
   `hasActivePengakhiran`, guard konflik Dakem/Mutasi).
5. **API** `app/api/pengakhiran-keanggotaan` (GET/POST), `app/api/pengakhiran-keanggotaan/[id]`
   (GET/PATCH), `app/api/anggota/[id]/pengakhiran` (GET lookup).
6. **RBAC** permission baru + seed + `lib/rbac.ts` (`PENGAKHIRAN_*_PERMISSIONS`) + `prisma/data/permissions.js`.
7. **Menu** `config/menu.config.tsx` — "Pengakhiran Keanggotaan".
8. **UI** `app/(protected)/keanggotaan/pengakhiran-keanggotaan/page.tsx` (form + riwayat, pola
   `entry-meninggal-dunia` + `mutasi-cabang`).
9. **Guard modul lain** — Dana Kematian (block `berhenti`), Mutasi Cabang (block `berhenti`),
   badge di Pengelolaan Data/DetailModal.
10. **Test** manual: ajukan → verifikasi → setujui (status jadi `berhenti`) → cek anggota tidak muncul
    sebagai aktif di Dakem/Mutasi → cek riwayat & badge.

---

## 13. File yang Akan Terdampak (fase implementasi)

| Jenis | File |
|---|---|
| Migration | `supabase/migrations/032_create_pengakhiran_keanggotaan.sql` (baru) |
| Tipe | `lib/supabase.ts` |
| Storage | `lib/supabase-storage.ts`, `app/api/upload/route.ts` |
| Workflow | `lib/workflow/pengakhiran-keanggotaan-status.ts` (baru) |
| Service | `lib/server/pengakhiran-keanggotaan-service.ts` (baru) |
| API | `app/api/pengakhiran-keanggotaan/*` (baru), `app/api/anggota/[id]/pengakhiran/route.ts` (baru) |
| Hook | `lib/hooks/use-pengakhiran-keanggotaan-api.ts` (baru) |
| RBAC | `lib/rbac.ts`, `prisma/data/permissions.js` |
| Menu | `config/menu.config.tsx` |
| UI | `app/(protected)/keanggotaan/pengakhiran-keanggotaan/page.tsx` (baru) |
| Guard Dakem | `components/dana-kematian/MemberSearchModal.tsx`, `app/api/dana-kematian/route.ts` |
| Guard Mutasi | `app/api/mutasi-cabang/route.ts` |
| Tampilan status | `components/anggota/DetailModal.tsx`, `components/anggota/MemberFormModal.tsx` |
| Export/statistik | `components/anggota/ExportExcelModal.tsx`, dashboard (opsional, fase lanjutan) |

---

## 14. Penutup

Dokumen ini adalah **hasil audit tahap pertama** — belum ada perubahan kode/migration. Desain yang
diusulkan bersifat **aditif, konsisten dengan pola existing** (Data Meninggal Dunia untuk "fakta
level anggota", Mutasi Cabang untuk "pengajuan + approval"), dan **tidak menduplikasi** mekanisme
approval generik `anggota_perubahan`.

Langkah berikutnya menunggu keputusan bisnis atas pertanyaan §11 — terutama **workflow approval vs
langsung**, **daftar alasan**, dan **kebijakan reaktivasi** — sebelum implementasi dimulai.

*Dokumen disusun untuk tahap analisis. Belum ada perubahan kode.*

---

## 15. Keputusan Klien & Status Implementasi

Keputusan klien atas pertanyaan terbuka (§11):

1. Workflow → **2 tahap** (`menunggu → diverifikasi_pc → disetujui_pp` / `ditolak` / `dibatalkan`).
2. Alasan "Pensiun" → **tidak dipakai**; daftar alasan: `mengundurkan_diri`, `diberhentikan`, `lainnya`.
3. Status sementara → **perlu `non_aktif`** (tersedia di enum; modul ini hanya menetapkan `berhenti`).
4. Kapan status berlaku → **langsung** saat disetujui (bukan scheduled).
5. Dokumen pendukung → **opsional** (tidak wajib untuk alasan apa pun).
6. Blokir konflik Dakem/Mutasi berjalan → **ya, diblokir**.
7. Reaktivasi → **tidak** (tanpa reaktivasi otomatis).
8. Tanggal efektif masa depan → **tidak diizinkan**.

### Yang sudah diimplementasikan (fase implementasi)

| Area | Implementasi |
|---|---|
| Database | `supabase/migrations/032_create_pengakhiran_keanggotaan.sql` — enum `status_keanggotaan_enum` (`aktif`/`non_aktif`/`berhenti`), kolom `anggota.status_keanggotaan` (default `aktif`), enum `alasan_pengakhiran_enum`, `pengakhiran_status_enum`, tabel `pengakhiran_keanggotaan` (RLS, trigger, partial unique index) |
| Tipe | `lib/supabase.ts` — `StatusKeanggotaanEnum`, `PengakhiranStatus`, `AlasanPengakhiranEnum`, `PengakhiranKeanggotaan`, `PengakhiranKeanggotaanWithAnggota`, `CreatePengakhiranKeanggotaanInput`, `UpdatePengakhiranKeanggotaanStatusInput`, `PengakhiranKeanggotaanFilter` |
| Workflow | `lib/workflow/pengakhiran-keanggotaan-status.ts` (transisi, label, badge) + test |
| Validasi | `lib/utils/pengakhiran-keanggotaan-validation.ts` (dipakai UI & API) + test |
| Service | `lib/server/pengakhiran-keanggotaan-service.ts` — `markAnggotaBerhenti`, `hasActivePengakhiran`, `hasFinalPengakhiran`, `hasActiveMutasiForAnggota`, `hasBlockingDakemForAnggota` |
| API | `app/api/pengakhiran-keanggotaan` (GET/POST), `app/api/pengakhiran-keanggotaan/[id]` (GET/PATCH, apply status saat `disetujui_pp` + rollback), `app/api/anggota/[id]/pengakhiran` (lookup) |
| Hook | `lib/hooks/use-pengakhiran-keanggotaan-api.ts` |
| Storage | folder `surat-pengakhiran` pada bucket `anggota` (`lib/supabase-storage.ts`, `app/api/upload/route.ts`) |
| RBAC | `lib/rbac.ts` — `MANAGE_PENGAKHIRAN_KEANGGOTAAN`, `PENGAKHIRAN_MANAGE_PERMISSIONS`, `PENGAKHIRAN_VIEW_PERMISSIONS`; seed `prisma/data/permissions.js` |
| Menu | `config/menu.config.tsx` — menu "Pengakhiran Keanggotaan" di bawah Keanggotaan |
| UI | `app/(protected)/keanggotaan/pengakhiran-keanggotaan/page.tsx` (form + riwayat + dialog keputusan) |
| Guard | `app/api/dana-kematian/route.ts` & `app/api/mutasi-cabang/route.ts` — blokir anggota `berhenti`/`non_aktif` |

### Perilaku penting yang dijaga

- Data anggota **tidak dihapus** saat berhenti; `status_keanggotaan` berubah menjadi `berhenti`.
- Pengakhiran disetujui **hanya** melalui transisi workflow; status di-apply saat `disetujui_pp`.
- Pengajuan ganda dicegah di API **dan** partial unique index DB.
- `status_anggota_enum` (shared dengan `dana_kematian`) **tidak diubah**.
- Pengajuan Dana Kematian / Mutasi Cabang baru untuk anggota berhenti **diblokir**.

