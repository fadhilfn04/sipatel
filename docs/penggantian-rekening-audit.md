# Audit & Rekomendasi Desain — Penggantian Rekening (Keanggotaan)

> Dokumen ini adalah hasil **audit/analisis tahap pertama** — **belum ada perubahan kode**.
> Tujuan: memetakan kondisi existing pengelolaan rekening anggota, lalu memberi rekomendasi
> desain menu **Penggantian Rekening** (struktur halaman, matriks field, validasi, workflow,
> approval & verifikasi dokumen, penyimpanan rekening lama/baru, struktur database, dampak ke
> modul lain, dan strategi reuse) **tanpa menduplikasi mekanisme existing**.
>
> Pola & gaya dokumen mengikuti `docs/perubahan-data-pribadi-audit.md`,
> `docs/pengakhiran-keanggotaan-audit.md`, dan `docs/entry-meninggal-dunia-audit.md`.
> Tanggal audit: 7 November 2026.

---

## 1. Ringkasan Eksekutif

**Temuan kunci: penggantian rekening SUDAH dimungkinkan lewat mekanisme existing**, tetapi belum
sepenuhnya memenuhi kebutuhan bisnis. Berikut kondisinya:

1. **Rekening anggota** tersimpan pada `anggota.nama_bank` (teks bebas) + `anggota.norek_bank`
   (teks bebas). **Belum ada** kolom `nama_pemilik_rekening`, **belum ada** `kode_bank` FK,
   **belum ada** tabel histori rekening yang dedicated.
2. **`nama_bank` & `norek_bank` sudah termasuk allowlist** menu **Perubahan Data Pribadi**
   (`lib/anggota-perubahan.ts` baris 60–61). Artinya: perubahan rekening *sudah bisa* dilakukan
   lewat menu tersebut (admin → langsung; non-admin → usulan `anggota_perubahan`).
   Yang **belum ada**: histori rekening khusus, `nama_pemilik_rekening`, unggah buku tabungan,
   tanggal efektif, dan proteksi agar tidak mengganggu pengajuan Dana Kematian aktif.
3. **Dana Kematian TIDAK membaca `anggota.norek_bank`**. Pencairan memakai field sendiri:
   `dana_kematian.rekening_tujuan`/`bank_tujuan` (rekening PC, bukan rekening anggota) dan
   `file_buku_rekening` (bukti buku rekening ahli waris). Lihat §3.3.
4. **Master bank** (`master_bank`, migration 018) **sudah ada** + API `/api/master-bank`,
   tetapi **belum dipakai** oleh form anggota (form masih `TextField` teks bebas). FK `kode_bank`
   ke `anggota` yang direncanakan di migration 018 **tidak pernah dibuat**.
5. **Audit trail** aktor/alasan yang otoritatif = `anggota_perubahan` (migration 027). Trigger
   `anggota_history` menyimpan snapshot JSONB tetapi `changed_by` tidak terisi untuk request API
   dan `changed_fields` tidak mencakup kolom bank. Pola **append-only** `anggota_mutasi` adalah
   model terbaik untuk tabel histori rekening.

**Rekomendasi utama (Opsi B — hybrid, konsisten dengan pola Perubahan Data Pribadi):**

> Bangun menu **Penggantian Rekening** sebagai **workflow khusus di atas mekanisme existing**
> (`anggota_perubahan` untuk approval, `MemberSearchModal` untuk cari anggota, `FileUpload` untuk
> dokumen, `FieldDiffTable` untuk diff), lalu **tambahkan**:
> 1. Tabel **`anggota_rekening`** (append-only) untuk melestarikan rekening lama sebagai histori
>    + menandai rekening aktif.
> 2. Kolom **`nama_pemilik_rekening`** pada `anggota` (mirror rekening aktif) agar nama pemilik
>    tervalidasi & tercatat.
> 3. Endpoint khusus **`POST /api/anggota/[id]/penggantian-rekening`** yang enforce allowlist
>    sempit (bank/rekening/pemilik) + dokumen + tanggal efektif, dan pada saat apply/disetujui
>    **menulis snapshot rekening lama ke `anggota_rekening`**.
> 4. Opsional fase 2: dropdown bank dari `master_bank` (perbaikan kualitas data P1).

**TIDAK direkomendasikan** membuat tabel approval PC/PP baru atau state machine baru — gunakan
`anggota_perubahan` + pola admin/non-admin yang sudah teruji (kecuali business rules
menghendaki approval 2 tingkat, lihat §4.4).

**Workflow:** non-admin (PC/pengurus) → **usulan** (`anggota_perubahan`, `status='menunggu'`);
admin → **langsung** + jejak audit self-approved. Karena rekening adalah **field sensitif**
(sudah ditandai di `perubahan-data-pribadi-audit.md` §7.5), **rekomendasi fase lanjut**: wajib
approval untuk semua peran (termasuk admin) + verifikasi dokumen sebelum rekening aktif.

---

## 2. Cakupan Audit

| Area | File yang diperiksa |
|---|---|
| Skema anggota & bank | `supabase/migrations/001_create_anggota_table.sql`, `018_create_master_bank.sql`, `014_add_anggota_enhancements.sql`, `023_clarify_anggota_status_fields.sql` |
| Form anggota | `components/anggota/MemberForm.tsx`, `MemberFormModal.tsx`, `MemberFormModalTabbed.tsx` (dead code), `PerubahanDataPribadiForm.tsx` |
| API anggota | `app/api/anggota/route.ts`, `app/api/anggota/[id]/route.ts`, `app/api/anggota/[id]/perubahan-data/route.ts`, `lib/server/anggota-service.ts`, `lib/anggota-perubahan.ts` |
| Approval & audit | `supabase/migrations/027_dakem_claim_config_anggota_approval.sql`, `028_anggota_create_approval.sql`, `003_create_anggota_history_table.sql`, `app/api/anggota/approvals/*`, `components/anggota/AnggotaApprovalsModal.tsx` |
| Dana Kematian (penggunaan rekening) | `supabase/migrations/002_create_dana_kematian_table.sql`, `006_enhance_dana_kematian_workflow.sql`, `011_enhance_dana_kematian_complete_workflow.sql`, `023_add_dakem_workflow_statuses.sql`, `components/dana-kematian/DanaKematianFormModal.tsx`, `PPVerificationPanel.tsx` |
| Dana Sosial (penggunaan rekening) | `supabase/migrations/003_create_dana_sosial_table.sql`, `components/dana-sosial/DanaSosialFormModal.tsx` |
| RBAC & menu | `lib/rbac.ts`, `lib/rbac-server.ts`, `lib/server/anggota-service.ts`, `config/menu.config.tsx`, `prisma/data/permissions.js` |
| Upload | `components/ui/FileUpload.tsx`, `app/api/upload/route.ts`, `lib/supabase-storage.ts` |
| Halaman pola | `app/(protected)/keanggotaan/perubahan-data-pribadi/page.tsx`, `components/anggota/MemberSearchModal.tsx` |


---

## 3. Temuan Existing (Kondisi Nyata)

### 3.1 Field rekening pada `anggota`

```sql
-- 001_create_anggota_table.sql (BANK section)
nama_bank VARCHAR(100),   -- teks bebas, nullable — TIDAK FK ke master_bank
norek_bank VARCHAR(50),   -- teks bebas, nullable
```

- Form **Edit Data Anggota** (`MemberForm.tsx` baris 879–884) & **Perubahan Data Pribadi**
  (`PerubahanDataPribadiForm.tsx` baris 537–548): dua `Input` teks bebas ("Nama Bank",
  "Nomor Rekening") — **bukan dropdown** `master_bank`.
- Import/Export (`ImportExcelModal`, `ExportExcelModal`, `batch-import`) memetakan kedua kolom ini
  apa adanya (teks bebas).
- **Tidak ada** `nama_pemilik_rekening`, **tidak ada** tanggal efektif, **tidak ada** histori
  rekening — perubahan hanya terlihat sebagai snapshot JSONB di `anggota_history`.
- Validasi `norek_bank` yang ada saat ini: regex zod `^\d{8,16}$` pada schema Perubahan Data
  Pribadi (`lib/anggota-perubahan.ts` baris 302–308). PUT/Edit anggota lama **tidak**
  memvalidasi format ini.

### 3.2 Master bank — ada, tapi "terabaikan"

- `master_bank` (migration 018): `kode_bank UNIQUE`, `nama_bank`, `is_active` + seed ±30 bank.
  API `app/api/master-bank/route.ts`: `GET` (butuh `VIEW_KEANGGOTAAN`), tulis butuh `MANAGE_SYSTEM`.
- **Tidak ada UI manajemen master bank** dan **tidak ada form yang memakainya** (pencarian
  `master-bank` di halaman/components tidak menemukan konsumen).
- FK `kode_bank` → `anggota` yang direncanakan ("Next migration 019: Add kode_bank FK to anggota")
  **tidak pernah dibuat** — migration 19 realnya menghubungkan dakem ke `master_cabang`.
- `SIPATEL_ARCHITECTURAL_AUDIT.md` menandai `nama_bank` free-text sebagai masalah kualitas data
  prioritas **P1** ("BCA" vs "Bank BCA" vs "Bank Central Asia" pecah di laporan).

### 3.3 Penggunaan rekening pada Dana Kematian — rekening ANGGOTA tidak dipakai untuk pencairan

| Field dakem | Migration | Fungsi | Sumber |
|---|---|---|---|
| `rekening_tujuan`, `bank_tujuan` | 006 | Rekening tujuan transfer **PP → PC** (rekening cabang, bukan rekening anggota/ahli waris) | `docs/dana-kematian-workflow.md` §Database Fields |
| `file_buku_rekening` | 006/011 | **Bukti buku rekening ahli waris** (upload, wajib) | form dakem + `PPVerificationPanel` |
| `dokumen_buku_rekening_verified` | 011 | Hasil verifikasi PP atas buku rekening ahli waris | `PPVerificationPanel.tsx` |
| `nama_ahli_waris`, `penerima_dana` | 002/011 | Nama penerima dana | form dakem |
| `metode_penyaluran_actual` | 011 | `cash` / `transfer` ke ahli waris | form dakem |

- `grep norek|nama_bank` pada `components/dana-kematian/DanaKematianFormModal.tsx` → **kosong**.
  Form dakem **tidak** menarik/menyimpan `anggota.norek_bank`.
- Kesimpulan: **`anggota.norek_bank` saat ini murni data profil anggota**, bukan sumber pencairan.
  Mengubahnya **tidak mengubah** data pengajuan dakem yang sudah berjalan (dakem menyimpan
  snapshot-nya sendiri). Namun demikian arsitektur docs mengisyaratkan rekening anggota adalah
  kandidat sumber untuk pencairan non-dakem di masa depan (lihat §4.7).

### 3.4 Penggunaan rekening pada modul lain

- **Dana Sosial** (migration 003): `metode_penyaluran`, `nama_penerima_dana`, `rekening_tujuan`,
  `bukti_penyaluran` — snapshot penyaluran per klaim, **tidak** membaca `anggota.norek_bank`.
- **Pembayaran Sumbangan / Keuangan**: tidak menyentuh rekening anggota.
- Jadi satu-satunya penyimpanan kanonik rekening anggota = tabel `anggota`. **Tidak ada
  duplikasi penyimpanan rekening anggota lintas modul saat ini** — ini yang harus dipertahankan.

### 3.5 Audit trail / histori perubahan

| Mekanisme | Isi | Keterbatasan |
|---|---|---|
| `anggota_history` (trigger, migration 003) | snapshot JSONB penuh sebelum/sesudah per UPDATE | `changed_by` = `auth.uid()` → **kosong** untuk request API; `changed_fields` hanya 9 kolom — **tanpa** `nama_bank`/`norek_bank` |
| `anggota_perubahan` (migration 027) | usulan/keputusan: `data_sebelum`, `data_usulan`, `alasan`, `diajukan_oleh`, `diputuskan_oleh/pada`, `alasan_keputusan` | **otoritatif** untuk aktor & alasan; dipakai Perubahan Data Pribadi & Edit/Hapus/Create anggota |
| `anggota_mutasi` (migration 027) | histori mutasi cabang **append-only** | pola ideal untuk tabel histori rekening |
| `audit_dana_kematian` (migration 006/011) | audit trigger dakem | khusus dakem |

### 3.6 Role & permission

- Menu gating keanggotaan: `ACCESS_KEANGGOTAAN`; halaman/form: `MANAGE_KEANGGOTAAN`
  (`ProtectedRoute`, `requirePermission`).
- Model approval existing keanggotaan: **1 tingkat** — `isAdminActor()` (slug `admin`,
  `administrator`, `owner`) → langsung; non-admin → usulan `menunggu` (lihat
  `lib/server/anggota-service.ts` baris 15–21).
- Workflow **2 tingkat PC → PP** sudah ada di modul *Pengakhiran Keanggotaan* & *Perubahan
  Kepengurusan* (tabel dedicated + status `menunggu_verifikasi`/`disetujui`/`ditolak`), dan
  kapabilitas Dakem PC/PP = permission `dana_kematian.manage_pc` / `dana_kematian.verify_pp`.
- Belum ada permission khusus "penggantian rekening".

### 3.7 Overlap dengan menu Perubahan Data Pribadi (paling penting)

`PERSONAL_DATA_EDITABLE_FIELDS` **sudah memuat** `nama_bank` & `norek_bank`
(`lib/anggota-perubahan.ts` baris 60–61). Artinya menu **Perubahan Data Pribadi** hari ini sudah
dapat dipakai untuk mengganti rekening (dengan alasan wajib + diff + approval non-admin).

> Konsekuensi desain: menu Penggantian Rekening **tidak boleh** membuat jalur tulis kedua yang
> tumpang-tindih tanpa koordinasi — ia harus menjadi **specialisasi** dari mekanisme yang sama,
> atau field bank harus dikeluarkan dari menu Perubahan Data Pribadi (lihat opsi di §4.3).

---

## 4. Rekomendasi

### 4.1 Struktur halaman & form

Ikuti **pola 3 langkah** halaman `perubahan-data-pribadi` (terbukti & konsisten UI/UX):

`app/(protected)/keanggotaan/penggantian-rekening/page.tsx`

| Langkah | Isi | Komponen reuse |
|---|---|---|
| **1. Cari & Pilih Anggota** | tombol "Cari Anggota" → modal cari NIK/nama | `MemberSearchModal` (components/anggota) |
| **2. Info Rekening & Form Baru** | panel read-only rekening aktif (Bank, No. Rekening, Pemilik) + riwayat perubahan terakhir; form rekening baru | `Card`, `Input`, `Select`, `FileUpload`, riwayat dari tabel `anggota_rekening` |
| **3. Tinjau & Simpan** | tabel diff lama→baru + alasan wajib + unggah dokumen (jika belum) + tombol Simpan/Ajukan | `FieldDiffTable`, `Textarea`, `ToastNotification` |

- Bungkus dengan `<ProtectedRoute permission={PERMISSIONS.MANAGE_KEANGGOTAAN}>` (konsisten).
- Tambah entri menu di `config/menu.config.tsx` **di bawah "Perubahan Data Pribadi"**, permission
  `[PERMISSIONS.MANAGE_KEANGGOTAAN]` (fase 1) — atau permission baru jika dibutuhkan segregasi
  tugas (§4.4, opsional).
- Header halaman: `Toolbar`/`ToolbarHeading` + ikon `Wallet`/`CreditCard` (lucide), mengikuti
  halaman existing.

### 4.2 Field & validasi

Form **sengaja dibatasi** pada data rekening (bukan seluruh data pribadi):

| Field | Sumber | Wajib | Validasi |
|---|---|---|---|
| Anggota (NIK + Nama) | dipilih dari `MemberSearchModal` | ✅ | read-only setelah dipilih |
| **Bank** | **dropdown `master_bank`** (GET `/api/master-bank`) | ✅ | harus `kode_bank`/`nama_bank` aktif; simpan `nama_bank` (mirror) + opsional `kode_bank` |
| **Nomor Rekening Lama** | otomatis dari `anggota.norek_bank` | — | read-only, boleh kosong ("—") |
| **Nomor Rekening Baru** | input | ✅ | regex `^\d{8,16}$` (reuse zod existing); **≠** rekening lama |
| **Nama Pemilik Rekening** | input | ✅ | min 3 char, ≤255; **aturan kesamaan nama** → §4.4 (business decision) |
| **Alasan Penggantian** | textarea | ✅ | min 10 char, ≤1000 (reuse aturan `alasan`) |
| **Tanggal Efektif** | date | ✅ | `>=` hari ini (atau konfirmasi bila backdate) |
| **Dokumen Pendukung** | `FileUpload` (bucket `anggota`, folder baru `dokumen-rekening`) | sesuai §4.4 | PDF/JPG/PNG ≤5MB (whitelist `validateFile` existing) |

Catatan:
- **Gunakan `master_bank` (dropdown)** di menu baru → sekaligus memperbaiki kualitas data
  (P1 di `SIPATEL_ARCHITECTURAL_AUDIT.md`) untuk rekening yang diganti lewat menu ini, tanpa
  memaksa migrasi data lama (teks bebas lama tetap tampil apa adanya).
- Jangan menambah field di luar rekening (mis. status, cabang) — itu milik modul lain.

### 4.3 Workflow penggantian rekening (alur)

```
Petugas buka menu → cari & pilih anggota
   → sistem tampilkan rekening aktif + riwayat
   → isi rekening baru + pemilik + alasan + tanggal efektif + unggah dokumen
   → Tinjau (diff lama→baru)
   → Simpan/Ajukan:
        • Admin  → langsung terapkan (rekening baru aktif) + jejak audit
        • Non-admin → usulan `anggota_perubahan` status 'menunggu' (data utama TIDAK berubah)
   → (bila usulan) Admin menyetujui/menolak di Approvals
        • Setujui → rekening baru aktif + snapshot rekening lama ke `anggota_rekening`
        • Tolak   → data utama tetap
```

**Prinsip anti-duplikasi (penting):**
- Rekening aktif tetap **single source of truth** di `anggota` (`nama_bank`, `norek_bank`,
  `nama_pemilik_rekening`).
- Rekening lama **tidak ditimpa hilang** → disalin ke `anggota_rekening` (append-only) setiap kali
  penggantian diterapkan (baik admin langsung maupun approval).
- Approval memakai **`anggota_perubahan` existing** (jangan tabel approval baru). Untuk memisahkan
  di riwayat, tambah nilai enum `jenis='rekening'` (additive, aman seperti migration 027 menambah
  `'hapus'`) **atau** tetap `jenis='edit'` dengan penanda kategori di `alasan`/`data_usulan`.
  Rekomendasi: **enum `'rekening'`** agar mudah difilter & dilaporkan.

**Koordinasi dengan menu Perubahan Data Pribadi (pilih salah satu, keputusan bisnis):**
- **Opsi A (direkomendasikan):** keluarkan `nama_bank` & `norek_bank` dari
  `PERSONAL_DATA_EDITABLE_FIELDS`, sehingga **satu-satunya jalur** ganti rekening = menu
  Penggantian Rekening (lebih ketat: dokumen + tanggal efektif + histori). Perubahan Data Pribadi
  tetap untuk field lain.
- **Opsi B:** biarkan keduanya; menu Penggantian Rekening menjadi jalur "lengkap" (dengan dokumen
  & histori), Perubahan Data Pribadi tetap jalur cepat. **Risiko:** dua jalur tulis untuk field
  yang sama → tidak direkomendasikan tanpa aturan yang jelas.

### 4.4 Kebutuhan approval & verifikasi dokumen

- **Tingkat approval (fase 1):** ikuti model existing — `isAdminActor` → langsung; non-admin →
  usulan 1 tingkat (admin). **Tidak** membuat PC→PP baru kecuali diminta (hindari duplikasi).
- **Field sensitif:** rekening tercatat sebagai field sensitif di
  `perubahan-data-pribadi-audit.md` §7.5. **Rekomendasi fase 2:** untuk rekening, **wajibkan
  approval untuk semua peran** (termasuk admin) + **verifikasi dokumen** sebelum rekening aktif
  (`status='menunggu_verifikasi'` → `aktif`), meniru kapabilitas `dana_kematian.verify_pp`.
- **Verifikasi dokumen kepemilikan rekening:** dokumen (buku tabungan / rekening koran / surat
  keterangan bank) **wajib** diunggah (§ keputusan bisnis). Alur verifikasi:
  petugas unggah → (opsional) verifikator PP/atas menandai `dokumen_verified` sebelum aktif.
- **Aturan nama pemilik rekening (harus diputuskan bisnis):**
  - **Default aman:** `nama_pemilik_rekening` **wajib sama** dengan `nama_anggota`
    (case-insensitive, trim) — validasi di server.
  - **Pengecualian (jika diizinkan):** boleh pihak lain (ahli waris/kuasa) → wajib alasan +
    dokumen tambahan (surat kuasa). Simpan `hubungan_pemilik` bila opsi ini diambil.
- **Permission:** fase 1 pakai `MANAGE_KEANGGOTAAN`. Bila perlu segregasi tugas, tambah permission
  `manage_penggantian_rekening` (seed di `prisma/data/permissions.js` + `lib/rbac.ts`) — opsional.

### 4.5 Mekanisme penyimpanan rekening lama & baru

**Prinsip:** rekening **lama tidak dihapus**, rekening **baru menjadi aktif**. Dua lapisan:

1. **`anggota`** — tetap menyimpan **rekening aktif** (single source of truth):
   - `nama_bank` (tetap, mirror teks) — opsional tambah `kode_bank` FK di fase lanjut.
   - `norek_bank` (tetap).
   - **`nama_pemilik_rekening` (BARU, nullable)** — mirror pemilik rekening aktif.
2. **`anggota_rekening`** (BARU, append-only) — **histori semua perubahan**:
   - Setiap penggantian **disetujui/diterapkan** → insert 1 baris berisi snapshot
     **rekening lama** (`nama_bank_lama`, `norek_bank_lama`, `nama_pemilik_rekening_lama`) +
     **rekening baru** + `tanggal_efektif` + `alasan` + `dokumen_pendukung` + aktor
     (`diajukan_oleh`, `disetujui_oleh`, `diputuskan_pada`).
   - Karena append-only, rekening lama selalu bisa direkonstruksi & dilacak.

**Alur tulis (di endpoint/apply):**

```
1. baca anggota existing (snapshot rekening lama)
2. update anggota (nama_bank, norek_bank, nama_pemilik_rekening) → rekening baru aktif
3. insert anggota_rekening (lama → baru) — best-effort (jejak histori)
4. (bila usulan) update anggota_perubahan status disetujui + alasan keputusan
```

Langkah 3 mengikuti pola best-effort `recordMutasiIfCabangChanged` (log error, jangan
menggagalkan update utama), atau gunakan RPC Supabase bila ingin transaksional penuh.

### 4.6 Struktur database yang direkomendasikan

Migration baru (mis. **`035_create_penggantian_rekening.sql`**), **additive & idempotent**:

```sql
-- 1) Kolom pemilik rekening pada anggota (mirror rekening aktif)
ALTER TABLE anggota
  ADD COLUMN IF NOT EXISTS nama_pemilik_rekening VARCHAR(255);

-- 2) Tabel histori rekening (append-only)
CREATE TYPE anggota_rekening_status_enum AS ENUM ('aktif', 'non_aktif');

CREATE TABLE IF NOT EXISTS anggota_rekening (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anggota_id UUID NOT NULL REFERENCES anggota(id) ON DELETE CASCADE,

  -- rekening lama (snapshot saat diganti)
  nama_bank_lama VARCHAR(100),
  norek_bank_lama VARCHAR(50),
  nama_pemilik_rekening_lama VARCHAR(255),

  -- rekening baru
  kode_bank VARCHAR(10) REFERENCES master_bank(kode_bank) ON DELETE SET NULL, -- opsional
  nama_bank VARCHAR(100) NOT NULL,
  norek_bank VARCHAR(50) NOT NULL,
  nama_pemilik_rekening VARCHAR(255) NOT NULL,
  status anggota_rekening_status_enum NOT NULL DEFAULT 'aktif',

  tanggal_efektif DATE NOT NULL,
  dokumen_pendukung TEXT,          -- URL Supabase Storage (buku tabungan)
  alasan TEXT,

  diajukan_oleh VARCHAR(255),
  disetujui_oleh VARCHAR(255),
  diputuskan_pada TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_anggota_rekening_anggota
  ON anggota_rekening(anggota_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_anggota_rekening_status
  ON anggota_rekening(status);

-- Satu rekening aktif per anggota (kunci integritas)
CREATE UNIQUE INDEX IF NOT EXISTS uq_anggota_rekening_aktif
  ON anggota_rekening(anggota_id) WHERE status = 'aktif';
```

Catatan:
- `anggota` = **rekening aktif**; `anggota_rekening` = **histori + audit**. Satu kanonik + satu
  histori — bukan dua penyimpanan kanonik.
- Kolom `kode_bank` opsional; jika dipakai, simpan juga `nama_bank` (denormalisasi) agar tampilan
  tidak bergantung join — konsisten dengan pola `master_cabang` vs `anggota.nama_cabang`.
- `anggota_perubahan` **tidak** diubah struktur intinya; cukup tambah nilai enum `jenis` baru
  `'rekening'` (additive) bila ingin memisahkan jenis usulan di daftar approval.

### 4.7 Dampak terhadap Dana Kematian & modul lain

| Aspek | Dampak | Mitigasi |
|---|---|---|
| Pengajuan dakem **berjalan** | **Nol/rendah** — dakem tidak membaca `anggota.norek_bank`; menyimpan snapshot `rekening_tujuan`/`bank_tujuan`/`file_buku_rekening` sendiri | Tidak ada perubahan data dakem; tetap pertahankan snapshot di form dakem (jangan baca live) |
| Data histori dakem | Aman — `anggota_rekening` terpisah, tidak mengubah `dana_kematian` | — |
| Anggota punya dakem aktif | Tampilkan **peringatan** bila `hasActiveDakemTransactions(anggotaId)` true (reuse fungsi existing) | Rekomendasi: peringatan lembut + alasan, bukan blokir (rekening anggota ≠ rekening pencairan saat ini) |
| Dana Sosial / Keuangan | Tidak terpengaruh (snapshot sendiri) | — |
| Import/Export/Detail anggota | **Ringan** — tambah `nama_pemilik_rekening` (kolom baru) agar konsisten | Update `ExportExcelModal`/`ImportExcelModal`/`DetailModal` + tipe `lib/supabase.ts` (opsional, fase 3) |
| Edit/Pendaftaran anggota | Tidak berubah | — |

**Jangka panjang (bila dakem kelak membaca rekening anggota):** tangkap nomor rekening ke field
dakem **saat submit** (snapshot), jangan baca live dari `anggota` — agar perubahan rekening di
kemudian hari tidak mengubah pengajuan yang sudah diproses.

### 4.8 Strategi reuse komponen & business logic existing

| Kebutuhan | Reuse (file) | Sifat |
|---|---|---|
| Cari & pilih anggota | `components/anggota/MemberSearchModal.tsx` | reuse langsung |
| Diff lama→baru | `components/anggota/FieldDiffTable.tsx` + `lib/anggota-perubahan.ts` (`computeFieldDiff`, `getFieldLabel`, `formatFieldValue`) | reuse + label `nama_pemilik_rekening` |
| Validasi | pola zod `lib/anggota-perubahan.ts` (reuse regex `norek_bank`, aturan `alasan`) | ekstrak ke modul baru |
| Upload dokumen | `components/ui/FileUpload.tsx` + `app/api/upload/route.ts`; tambah folder `dokumen-rekening` ke `AnggotaFolder` + whitelist | reuse + whitelist kecil |
| Approval | `anggota_perubahan` + `app/api/anggota/approvals/*` + `isAdminActor()` | reuse (tanpa tabel approval baru) |
| Payload update partial-safe | `buildAnggotaPartialUpdatePayload` | reuse |
| Cek dakem aktif | `hasActiveDakemTransactions` (`lib/server/anggota-service.ts`) | reuse |
| Toast | `components/anggota/ToastNotification.tsx` | reuse |
| Halaman 3 langkah | pola `app/(protected)/keanggotaan/perubahan-data-pribadi/page.tsx` | acuan |
| **Baru** | `lib/anggota-rekening.ts` (allowlist `nama_bank`,`norek_bank`,`nama_pemilik_rekening`, schema zod, diff, builder); `app/api/anggota/[id]/penggantian-rekening/route.ts`; `components/anggota/PenggantianRekeningForm.tsx`; `app/(protected)/keanggotaan/penggantian-rekening/page.tsx` | baru (fase implementasi) |

**Yang TIDAK boleh diduplikasi:** tabel approval PC/PP, state machine dakem, penyimpanan rekening
kanonik kedua. Semua pakai mekanisme existing.

---

## 5. Keputusan Bisnis yang Perlu Disetujui (sebelum implementasi)

1. **Nama pemilik rekening** — wajib sama dengan `nama_anggota`, atau boleh pihak lain
   (ahli waris/kuasa)? Jika boleh, butuh `hubungan_pemilik` + dokumen surat kuasa?
2. **Tingkat approval** — cukup 1 tingkat (admin), wajib approval semua peran (field sensitif),
   atau PC → PP (2 tingkat)?
3. **Dokumen pendukung** — wajib selalu atau hanya untuk kasus tertentu (pemilik beda nama,
   perubahan besar)? Siapa yang **memverifikasi** dokumen?
4. **Koordinasi menu** — keluarkan `nama_bank`/`norek_bank` dari Perubahan Data Pribadi (Opsi A)
   atau biarkan dua jalur (Opsi B)? (§4.3)
5. **Tanggal efektif** — boleh backdate, atau selalu `>=` hari ini?
6. **Bank** — wajib dropdown `master_bank` (+ `kode_bank` FK), atau cukup teks bebas?
7. **Peringatan dakem aktif** — blokir ganti rekening bila ada dakem aktif, atau peringatan saja?
8. **Permission** — pakai `MANAGE_KEANGGOTAAN` yang ada, atau tambah `manage_penggantian_rekening`?

---

## 6. Estimasi Implementasi (setelah business rules disetujui)

| Fase | Lingkup | Deliverables |
|---|---|---|
| **1 (MVP)** | menu + endpoint + histori + approval admin/non-admin + unggah dokumen (tanpa verifikasi) | migration 035, `lib/anggota-rekening.ts`, endpoint `penggantian-rekening`, form, halaman, menu config, kolom `nama_pemilik_rekening` |
| **2** | verifikasi dokumen + approval sensitif (opsional semua peran) + dropdown `master_bank` + `kode_bank` FK + riwayat gabungan | endpoint verifikasi, UI approvals, `master_bank` dropdown |
| **3** | notifikasi pengaju + integrasi export/import/detail `nama_pemilik_rekening` | notifikasi + kolom export/import |

---

> **Status: FASE 1 (MVP) TELAH DIIMPLEMENTASIKAN** — lihat §7. Fase 2/3 menunggu
> keputusan lanjutan. Migration `035_create_penggantian_rekening.sql` **wajib
> dijalankan** di Supabase sebelum fitur dipakai.

---

## 7. Catatan Implementasi Fase 1 (MVP)

> Status dokumen: rekomendasi disetujui → Fase 1 (MVP) diimplementasikan.
> Keputusan bisnis yang dipakai (belum dibantah klien): pemilik rekening wajib
> sama dengan nama anggota (`WAJIB_PEMILIK_SAMA_DENGAN_ANGGOTA`), approval
> 1 tingkat (admin), dokumen pendukung wajib, tanggal efektif ≥ hari ini,
> Opsi A (rekening dikeluarkan dari Perubahan Data Pribadi), bank dari
> `master_bank`.

### File baru

| File | Peran |
|---|---|
| `supabase/migrations/035_create_penggantian_rekening.sql` | Kolom `anggota.nama_pemilik_rekening`, tabel `anggota_rekening` (append-only + unique "satu aktif per anggota"), enum `jenis='rekening'` |
| `lib/anggota-rekening.ts` | Allowlist `REKENING_EDITABLE_FIELDS`, tipe, aturan nama pemilik, schema zod (form & request), diff, payload builder |
| `lib/anggota-rekening.test.ts` | 13 unit test (validasi, aturan pemilik, diff, payload) |
| `lib/server/anggota-rekening-service.ts` | `applyPenggantianRekening` — update rekening aktif + nonaktifkan histori lama + insert histori (dipakai admin langsung & approval) |
| `app/api/anggota/[id]/penggantian-rekening/route.ts` | `GET` (rekening aktif + riwayat + indikasi dakem aktif), `POST` (validasi, usulan non-admin / apply admin) |
| `components/anggota/PenggantianRekeningForm.tsx` | Form rekening baru (dropdown `master_bank`, norek, pemilik, tanggal efektif, `FileUpload` folder `dokumen-rekening`) |
| `app/(protected)/keanggotaan/penggantian-rekening/page.tsx` | Halaman 3 langkah (cari → isi → tinjau & simpan) + peringatan dakem aktif + riwayat |

### File diubah

| File | Perubahan |
|---|---|
| `lib/anggota-perubahan.ts` | `nama_bank`/`norek_bank`/`nama_pemilik_rekening` pindah ke `PROTECTED_FIELDS`; keluar dari allowlist & schema; label pemilik ditambah |
| `lib/anggota-perubahan.test.ts` | +2 test (field rekening terproteksi; `nama_bank` ditolak di Perubahan Data Pribadi) |
| `components/anggota/PerubahanDataPribadiForm.tsx` | Field bank dihapus (seksi jadi BPJS + arahan ke menu Penggantian Rekening) |
| `app/(protected)/keanggotaan/perubahan-data-pribadi/page.tsx` | `initialValues` tanpa field bank + teks info diperbarui |
| `app/api/anggota/approvals/[id]/route.ts` | Handle usulan `jenis='rekening'` (apply + histori + revert bila gagal) |
| `components/anggota/AnggotaApprovalsModal.tsx` | Jenis usulan 'Ganti Rekening' + filter diff |
| `app/api/master-bank/route.ts` | `GET` juga mengizinkan `MANAGE_KEANGGOTAAN` (dropdown bank) |
| `app/api/upload/route.ts`, `lib/supabase-storage.ts` | Whitelist folder `dokumen-rekening` (bucket `anggota`) |
| `lib/hooks/use-anggota-api.ts` | `useRekeningInfo` (GET) + `usePenggantianRekening` (POST) |
| `lib/supabase.ts` | Tipe `nama_pemilik_rekening` pada `Anggota`/input |
| `components/anggota/DetailModal.tsx` | Tampilkan Pemilik Rekening |
| `components/anggota/index.ts`, `config/menu.config.tsx` | Export komponen + menu "Penggantian Rekening" |

### Hasil validasi

- `npx tsc --noEmit` → bersih (tanpa error).
- `npm test` → **168/168 lulus** (termasuk 15 test baru).
- `npm run build` → **Compiled successfully**; route `/keanggotaan/penggantian-rekening`
  (static) dan `/api/anggota/[id]/penggantian-rekening` (dynamic) terdaftar.

### Belum dikerjakan (Fase 2/3 — lihat §6)

- Verifikasi dokumen oleh verifikator + approval wajib semua peran (field sensitif).
- `kode_bank` FK pada `anggota` + migrasi data `nama_bank` bebas → master.
- Riwayat perubahan gabungan (`anggota_perubahan` + `anggota_history` + `anggota_rekening`).
- Notifikasi ke pengaju saat usulan diputuskan.
- `nama_pemilik_rekening` di Import/Export Excel.





