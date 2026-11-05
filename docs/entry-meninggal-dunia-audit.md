# Audit & Rekomendasi Desain — Entry Data Karyawan Meninggal Dunia

> Dokumen ini adalah hasil **audit/analisis tahap pertama** (belum ada perubahan kode).
> Tujuan: memberi rekomendasi desain fitur, struktur data, alur proses, dan integrasi
> dengan modul Dana Kematian, **tanpa merusak data historis maupun workflow existing**.

---

## 1. Ringkasan Eksekutif

**Rekomendasi utama:** gunakan **tabel baru `anggota_kematian`** sebagai *single source of truth*
fakta kematian di level anggota (satu baris per anggota), lalu **integrasikan satu arah**
ke modul Dana Kematian:

1. Entry kematian → menyimpan fakta kematian + meng-update `anggota.status_anggota = 'meninggal'`.
2. Pengajuan Dana Kematian → **membaca ulang** data kematian yang sudah tercatat
   (prefill `tanggal_meninggal`, `penyebab_meninggal`, dan reuse `file_surat_kematian`).
3. Entry kematian **TIDAK pernah** membuat baris `dana_kematian` (tidak otomatis menjadi pengajuan).
4. Struktur & workflow Dana Kematian existing **tetap utuh** (status, klaim, verifikasi, SLA, dokumen).

**Keputusan kunci:**

- **TIDAK** mengubah enum `status_anggota_enum` (nilai `meninggal` sudah ada dan *shared* dengan `dana_kematian`).
- **TIDAK** menghapus kolom denormalisasi yang sudah ada di `dana_kematian`
  (`tanggal_meninggal`, `file_surat_kematian`, `nama_anggota`, `status_anggota`, `status_mps`) —
  kolom tersebut adalah *snapshot per pengajuan* (pola existing).
- Menambah struktur baru bersifat **additive & idempotent** (`IF NOT EXISTS`).

---

## 2. Cakupan Audit

| Area | File |
|---|---|
| Skema anggota | `supabase/migrations/001_create_anggota_table.sql` |
| Skema dana kematian | `supabase/migrations/002_create_dana_kematian_table.sql` |
| Workflow dakem | `006_enhance_dana_kematian_workflow.sql`, `011_enhance_dana_kematian_complete_workflow.sql`, `023_add_dakem_workflow_statuses.sql` |
| Klarifikasi status | `023_clarify_anggota_status_fields.sql` |
| Dokumen dakem | `026_formalize_dakem_document_columns.sql` |
| Claim/config/approval | `027_dakem_claim_config_anggota_approval.sql` |
| Audit trail anggota | `003_create_anggota_history_table.sql` |
| API anggota | `app/api/anggota/route.ts`, `app/api/anggota/[id]/route.ts`, `app/api/anggota/approvals/[id]/route.ts` |
| Service anggota | `lib/server/anggota-service.ts` |
| API dakem | `app/api/dana-kematian/route.ts` |
| Form anggota | `components/anggota/MemberFormModal.tsx`, `MemberFormModalTabbed.tsx` |
| Form dakem | `components/dana-kematian/DanaKematianFormModal.tsx`, `MemberSearchModal.tsx` |
| Status/workflow dakem | `lib/workflow/dana-kematian-status.ts` |
| Konfigurasi | `lib/config/dana-kematian-config.ts`, `lib/config/dana-kematian-berkas.ts` |
| Storage | `lib/supabase-storage.ts`, `app/api/upload/route.ts` |
| Menu & RBAC | `config/menu.config.tsx`, `lib/rbac.ts` |
| Tipe | `lib/supabase.ts` |

---

## 3. Temuan Audit

### 3.1 Keanggotaan → Pengelolaan Data (mekanisme perubahan status saat ini)

- Status anggota disimpan di `anggota.status_anggota` dengan enum:
  `pegawai | istri | suami | anak | meninggal`.
- Perubahan ke `meninggal` saat ini dilakukan lewat **Edit Data Anggota**
  (`components/anggota/MemberFormModal.tsx` baris 245 → dropdown `Status Anggota` → `Meninggal`)
  → `PUT /api/anggota/[id]`.
- Untuk non-admin, perubahan dikirim sebagai usulan approval (`anggota_perubahan`, jenis `edit`)
  dan baru diterapkan setelah disetujui admin (`app/api/anggota/approvals/[id]/route.ts`).
- Perubahan dicatat otomatis di `anggota_history` (trigger `track_anggota_changes`).

**Kesenjangan (gap):**

- Saat status diubah ke `meninggal`, sistem **tidak menyimpan** `tanggal_meninggal`
  maupun dokumen `surat_kematian` di level anggota.
- Tidak ada tanggal meninggal yang bisa dibaca oleh modul lain (kecuali pengajuan
  Dana Kematian kebetulan sudah dibuat).

### 3.2 Dana Kematian (field tanggal meninggal & surat kematian)

Tabel `dana_kematian` **sudah memiliki** field yang dibutuhkan:

- `tanggal_meninggal DATE NOT NULL`
- `penyebab_meninggal TEXT`
- `file_surat_kematian TEXT` (+ `dokumen_surat_kematian_verified BOOLEAN`)
- `document_metadata JSONB` (metadata dokumen: sumber akte, keterangan, dll.)
- Deretan waktu `waktu_0..waktu_7`, `status_proses`, flag claim, dst.

Namun data tersebut **per pengajuan**, bukan fakta kematian di level anggota.
Artinya: `tanggal_meninggal` dan `file_surat_kematian` terikat pada satu *claim*,
bukan pada *anggota*.

### 3.3 Database — di mana data meninggal tersimpan?

| Tabel | `status_anggota='meninggal'` | `tanggal_meninggal` | `file_surat_kematian` |
|---|---|---|---|
| `anggota` | ✅ (enum) | ❌ | ❌ |
| `dana_kematian` | ✅ (kolom denormalisasi) | ✅ | ✅ |
| `nik_kepemilikan` | ✅ (`status` enum kepemilikan) | ❌ | ❌ |
| `anggota_history` | ✅ (audit perubahan) | ❌ | ❌ |

**Kesimpulan:** fakta kematian (tanggal + dokumen) saat ini hanya hidup di `dana_kematian`.
Belum ada entitas di level anggota untuk menyimpan "anggota ini meninggal pada tanggal X
dengan surat kematian Y".

### 3.4 Workflow — keterkaitan dengan pengajuan Dana Kematian

- Saat ini pencatatan meninggal (ubah status) dan pengajuan Dana Kematian **terpisah/tidak terhubung**.
- Form pengajuan memilih anggota lewat `MemberSearchModal` lalu mengisi `tanggal_meninggal` **manual**.
- Pencegahan duplikasi pengajuan: `existingAnggotaIds` (satu pengajuan aktif per anggota;
  status `batal`/`ditolak` tidak memblokir pengajuan ulang).
- Batas waktu pengajuan: **4 tahun** sejak `tanggal_meninggal`
  (`MAX_DEATH_CLAIM_PERIOD_YEARS` di `lib/config/dana-kematian-config.ts`).
- `hasActiveDakemTransactions()` mencegah penghapusan anggota yang punya pengajuan aktif.
- Status anggota `meninggal` mengaktifkan tombol **"Wariskan NIK"** (`components/anggota/DetailModal.tsx`).
- Bucket storage: `dana-kematian` (folder `surat-kematian`) dan `anggota`
  (folder `gambar-kondisi-tempat-tinggal`, `e-ktp`, `kartu-keluarga`, `npwp`, `dokumen-lainnya`).

---

## 4. Analisis Kesenjangan (Gap Analysis)

| # | Kebutuhan klien | Kondisi existing | Gap |
|---|---|---|---|
| 1 | Menu khusus Entry Meninggal Dunia | Belum ada (hanya edit status di Pengelolaan Data) | Perlu menu + halaman/form baru |
| 2 | Pilih Nama/NIK dari data anggota | Sudah ada pola `MemberSearchModal` | Reuse |
| 3 | Tanggal Meninggal Dunia | Ada di `dana_kematian`, tidak di level anggota | Perlu penyimpanan di level anggota |
| 4 | Upload Surat Kematian | Ada di bucket `dana-kematian` (`surat-kematian`), tidak di level anggota | Perlu lokasi penyimpanan level anggota |
| 5 | Status anggota konsisten `meninggal` | Sudah ada enum + mekanisme update | Perlu dipicu otomatis oleh entry kematian |
| 6 | Tidak duplikasi data dengan Dana Kematian | — | Perlu strategi *single source of truth* |
| 7 | Data entry dapat dipakai ulang saat ajukan Dana Kematian | Tidak ada mekanisme prefill | Perlu integrasi prefill |
| 8 | Entry kematian ≠ pengajuan Dana Kematian | — | Harus dipastikan tidak menulis `dana_kematian` |
| 9 | Workflow & rules Dana Kematian tidak rusak | Workflow kompleks existing | Perubahan harus aditif |

---

## 5. Opsi Desain & Rekomendasi

### Opsi A — Tabel baru `anggota_kematian` (REKOMENDASI ✅)

Buat tabel `anggota_kematian` dengan `anggota_id UNIQUE` (satu fakta kematian per anggota).

**Kelebihan:**

- Menjadi *single source of truth* fakta kematian di level anggota.
- Tidak menambah kolom pada tabel `anggota` yang sudah sangat lebar.
- Tidak menyentuh enum `status_anggota_enum` yang *shared* & sensitif.
- `dana_kematian` tetap punya snapshot per pengajuan (konsisten dengan pola denormalisasi existing).
- Mudah menambah field masa depan (tempat meninggal, verifikasi dokumen, dsb.) tanpa migrasi `anggota`.

**Kekurangan:**

- Satu tabel + satu relasi baru.
- Perlu aturan sinkronisasi antara `anggota_kematian` dan `dana_kematian`.

### Opsi B — Tambah kolom di `anggota` (`tanggal_meninggal`, `file_surat_kematian`)

**Kelebihan:** data menyatu dengan master anggota; query sederhana.

**Kekurangan:**

- Tabel `anggota` makin lebar; mencampur "fakta kematian + dokumen" dengan master data.
- `file_surat_kematian` di bucket `anggota` berbeda domain dengan bucket `dana-kematian`
  (duplikasi konsep folder).
- Audit existing mencatat `status_anggota_enum` *shared* dengan `dana_kematian` dan menyatakan
  "DO NOT MODIFY" — menambah kolom kematian di `anggota` berisiko menambah *coupling* semantik.

### Opsi C — Pakai `dana_kematian` saja (tanpa entitas baru)

**Ditolak** karena:

- `dana_kematian` adalah **pengajuan/claim**, bukan registrasi fakta kematian.
- Melanggar kebutuhan #8: entry kematian **tidak boleh** otomatis membuat pengajuan.
- Tidak bisa menyimpan fakta kematian untuk anggota yang belum/tidak mengajukan dana.

### Matriks perbandingan

| Kriteria | A (tabel baru) | B (kolom anggota) | C (dana_kematian) |
|---|---|---|---|
| Single source of truth fakta kematian | ✅ | ✅ | ❌ |
| Tidak merusak enum shared | ✅ | ✅ | ✅ |
| Tidak mencampur master vs dokumen | ✅ | ❌ | — |
| Tidak otomatis buat pengajuan | ✅ | ✅ | ❌ |
| Reuse data saat pengajuan | ✅ (prefill) | ✅ (prefill) | n/a |
| Extensibility | ✅ | ⚠️ | ❌ |
| Risiko regresi workflow dakem | Rendah | Rendah | Tinggi |

**Rekomendasi final: Opsi A.**

---

## 6. Usulan Struktur Data (migration `031` — draft)

Migration bersifat **idempotent & additive**, tidak mengubah data lama:

```sql
-- 031_create_anggota_kematian.sql
CREATE TABLE IF NOT EXISTS anggota_kematian (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relasi 1:1 ke anggota (satu fakta kematian per anggota)
  anggota_id UUID NOT NULL UNIQUE REFERENCES anggota(id) ON DELETE CASCADE,

  -- Fakta kematian
  tanggal_meninggal DATE NOT NULL,
  penyebab_meninggal TEXT,           -- opsional, dapat dipakai ulang oleh dakem
  tempat_meninggal VARCHAR(255),     -- opsional (usulan tambahan untuk kebutuhan bisnis)
  file_surat_kematian TEXT,          -- URL dokumen (bucket anggota / folder surat-kematian)

  -- Keterangan & metadata (opsional, JSONB untuk fleksibilitas)
  keterangan TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Audit
  dicatat_oleh VARCHAR(255),         -- Prisma User.id
  dicatat_pada TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_anggota_kematian_tanggal
  ON anggota_kematian(tanggal_meninggal DESC);
CREATE INDEX IF NOT EXISTS idx_anggota_kematian_dicatat
  ON anggota_kematian(dicatat_oleh);
```

**Catatan desain:**

- `anggota_id UNIQUE` memastikan **tidak ada duplikasi** fakta kematian per anggota.
- `deleted_at` mengikuti pola soft-delete aplikasi (data historis dipertahankan).
- `dicatat_oleh`/`dicatat_pada` untuk audit siapa & kapan mencatat.

### Tipe TypeScript (tambahan di `lib/supabase.ts`)

```ts
export interface AnggotaKematian {
  id: string;
  anggota_id: string;
  tanggal_meninggal: string;
  penyebab_meninggal: string | null;
  tempat_meninggal: string | null;
  file_surat_kematian: string | null;
  keterangan: string | null;
  metadata: Record<string, any> | null;
  dicatat_oleh: string | null;
  dicatat_pada: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface CreateAnggotaKematianInput {
  anggota_id: string;
  tanggal_meninggal: string;
  penyebab_meninggal?: string;
  tempat_meninggal?: string;
  file_surat_kematian?: string;
  keterangan?: string;
}
```

### Storage (tambahan folder)

- Tambah folder `surat-kematian` pada bucket `anggota`:
  - `lib/supabase-storage.ts` → tambah ke union `AnggotaFolder`.
  - `app/api/upload/route.ts` → tambah ke `validFolders` untuk bucket `anggota`.
- Dokumen di-upload **sekali** di level anggota; saat pengajuan Dakem, URL yang sama
  di-*copy* ke `dana_kematian.file_surat_kematian` (tanpa upload ulang, tanpa duplikasi objek storage).

---

## 7. Desain Alur Proses

### 7.1 Form Entry Meninggal Dunia

Komponen baru (mengikuti pola `DanaKematianFormModal` / `MemberFormModal`):

| Field | Sumber | Wajib | Catatan |
|---|---|---|---|
| Nama/NIK Anggota | `MemberSearchModal` (reuse) | ✅ | Tidak input manual; pilih dari anggota terdaftar |
| Tanggal Meninggal | date input | ✅ | Validasi tidak di masa depan |
| Penyebab Meninggal | textarea | ❌ | Opsional, dipakai ulang oleh Dakem |
| Tempat Meninggal | input | ❌ | Usulan tambahan (perlu konfirmasi klien) |
| Upload Surat Kematian | `FileUpload`/upload API | ⚠️ | Wajib bila tersedia; boleh simpan draft tanpa dokumen (mengikuti pola draft Dakem) |
| Keterangan | textarea | ❌ | — |

**Validasi/aturan:**

- Anggota yang sudah tercatat meninggal (`status_anggota='meninggal'` atau sudah ada baris
  `anggota_kematian`) → blokir duplikasi / arahkan ke mode edit.
- Setelah entry tersimpan → update `anggota.status_anggota = 'meninggal'` (jika belum).

### 7.2 API (usulan)

| Endpoint | Metode | Fungsi |
|---|---|---|
| `/api/anggota-kematian` | GET | Daftar entry kematian (filter/pagination) |
| `/api/anggota-kematian` | POST | Simpan entry baru (insert `anggota_kematian` + update `status_anggota`) |
| `/api/anggota-kematian/[id]` | GET/PUT/DELETE | Detail/ubah/hapus (soft delete) |
| `/api/anggota/[id]/kematian` | GET | Cek apakah anggota sudah punya data kematian (untuk prefill Dakem) |

**POST `/api/anggota-kematian` — alur (draft):**

1. Cek permission (`manage_keanggotaan` atau permission khusus baru).
2. Validasi `anggota_id` ada & `tanggal_meninggal` terisi.
3. Cegah duplikasi (`anggota_id` sudah ada di `anggota_kematian` → 409).
4. Insert `anggota_kematian`.
5. Update `anggota.status_anggota = 'meninggal'` (jika belum).
6. Fire notifikasi (non-blocking, mengikuti pola `notifyDanaKematianCreated`).

**Approval (opsional, mengikuti pola existing):**

- MVP bisa menulis langsung dengan permission `manage_kematian_anggota` (setara alur PC
  membuat pengajuan Dakem langsung).
- Untuk konsistensi penuh, non-admin dapat mengirim usulan `anggota_perubahan`
  (jenis `edit`, `data_usulan` berisi `status_anggota:'meninggal'` + marker `_action:'kematian'`
  + field kematian). Saat disetujui, handler approval juga meng-insert `anggota_kematian`.
  → Keputusan final setelah konfirmasi klien (lihat §11).

### 7.3 Menu & RBAC

- Menu baru di bawah **Keanggotaan** (setelah "Pengelolaan Data"):

```tsx
{
  title: 'Entry Meninggal Dunia',
  path: '/keanggotaan/entry-meninggal-dunia',
  permissions: [PERMISSIONS.MANAGE_KEANGGOTAAN],
},
```

- Disarankan menambah permission granular di `lib/rbac.ts`:
  - `MANAGE_KEMATIAN_ANGGOTA: 'manage_kematian_anggota'` (create/update)
  - `VIEW_KEMATIAN_ANGGOTA: 'view_kematian_anggota'` (list/detail)
  - Seed permission mengikuti pola migration `013_create_dana_kematian_roles_permissions.sql`.
  - Role `administrator`/`owner` tetap punya akses penuh (pola `SUPERUSER_ROLE_SLUGS`).

---

## 8. Integrasi dengan Dana Kematian (penting)

### 8.1 Prinsip anti-duplikasi

- **`anggota_kematian`** = fakta kematian di level anggota (1 baris/anggota).
- **`dana_kematian.tanggal_meninggal` / `file_surat_kematian`** = *snapshot* per pengajuan
  (tetap dipertahankan, karena sudah jadi pola existing: `nama_anggota`, `status_anggota`,
  `status_mps` juga di-denormalisasi di `dana_kematian`).
- Tidak ada kolom baru di `dana_kematian` yang "menunjuk" balik ke `anggota_kematian`;
  integrasi dilakukan lewat `anggota_id`.

### 8.2 Alur reuse saat pengajuan Dana Kematian

Saat `DanaKematianFormModal` memilih anggota (`handleMemberSelect`):

1. Panggil `GET /api/anggota/[id]/kematian`.
2. Jika data kematian ada → **prefill**:
   - `tanggal_meninggal` (tetap bisa diedit bila pengajuan butuh penyesuaian).
   - `penyebab_meninggal`.
   - `file_surat_kematian` (copy URL yang sama).
3. Tampilkan badge "Data kematian tercatat" agar user tahu data berasal dari entry kematian.

### 8.3 Aturan sinkronisasi (menjaga konsistensi & historis)

- **Entry kematian tidak pernah membuat baris `dana_kematian`.** ✅ (kebutuhan #8)
- **Pengajuan Dakem tidak mengubah/overwrite `anggota_kematian`.** Data Dakem adalah snapshot.
- Jika keduanya ada dan `tanggal_meninggal` berbeda → tampilkan **warning**, jangan
  auto-overwrite; catat selisihnya (opsional: di `metadata`).
- **Rekomendasi sinkronisasi status (opsional, aman):** saat pengajuan Dakem dibuat dengan
  `tanggal_meninggal` terisi dan anggota belum punya `anggota_kematian` + belum `meninggal`,
  sistem dapat membuat `anggota_kematian` dari data pengajuan dan meng-update
  `status_anggota='meninggal'`. Ini **bukan** membuat pengajuan baru, melainkan menyamakan
  fakta status — memenuhi kebutuhan "status anggota diperbarui secara konsisten".
  (Default: non-aktif / dikonfigurasi; tidak wajib untuk MVP.)

### 8.4 Yang tetap tidak berubah

- Workflow status Dakem (`draft → proses_pusat → ... → selesai`).
- Klaim antar-cabang (`claim_status`, `cabang_pemilik_kode`).
- Pencegahan satu pengajuan aktif per anggota.
- Batas 4 tahun pengajuan sejak `tanggal_meninggal`.
- Verifikasi dokumen PP dan daftar dokumen wajib.

---

## 9. Business Rules (ringkasan rekomendasi)

1. Satu anggota maksimal satu baris `anggota_kematian` (UNIQUE).
2. Entry kematian wajib meng-update `anggota.status_anggota = 'meninggal'`.
3. Entry kematian **tidak** membuat pengajuan Dana Kematian.
4. Pengajuan Dakem boleh membaca/menggunakan ulang data kematian yang sudah tercatat.
5. Data Dakem (snapshot) tidak boleh meng-overwrite fakta di `anggota_kematian`.
6. Selisih tanggal antara entry kematian dan pengajuan Dakem hanya menimbulkan warning,
   bukan kegagalan transaksi.
7. Anggota yang masih punya pengajuan Dakem aktif tidak bisa dihapus (sudah ada).
8. Soft delete diterapkan untuk data kematian (historis dipertahankan).

---

## 10. Risiko & Mitigasi

| Risiko | Level | Mitigasi |
|---|---|---|
| Mengubah enum `status_anggota_enum` yang shared | Tinggi | Tidak menyentuh enum; pakai tabel baru |
| Duplikasi `tanggal_meninggal`/surat kematian | Sedang | Satu sumber fakta (`anggota_kematian`), snapshot di Dakem |
| Entry kematian tidak sengaja membuat pengajuan Dakem | Sedang | API entry hanya menulis `anggota_kematian` + `anggota` |
| Inkonsistensi status (meninggal tidak tersinkron) | Sedang | Update status di transaksi yang sama + sinkronisasi opsional dari Dakem |
| Regresi workflow Dakem | Sedang | Perubahan aditif; tidak menyentuh state machine/verifikasi/claim |
| Data historis rusak | Rendah | Semua migration `IF NOT EXISTS`, soft delete, append-only |

---

## 11. Pertanyaan Terbuka untuk Klien (sebelum implementasi)

1. Apakah `Surat Kematian` **wajib** saat entry, atau boleh disimpan sebagai draft tanpa dokumen?
2. Apakah perlu field tambahan: **Tempat Meninggal**, **Penyebab Meninggal**, atau lainnya?
3. Apakah entry kematian perlu **workflow approval** (admin) seperti Edit Anggota, atau boleh
   langsung dicatat oleh role yang diberi akses?
4. Siapa role yang boleh melakukan entry (Cabang / Pusat / keduanya)?
5. Apakah perlu **notifikasi** saat entry kematian dibuat (misal ke Pusat)?
6. Apakah sinkronisasi balik (pengajuan Dakem → otomatis buat `anggota_kematian` + status
   meninggal) perlu diaktifkan, atau cukup satu arah dari entry kematian saja?

---

## 12. Rencana Implementasi Bertahap (setelah analisis disetujui)

1. **Migration** `031_create_anggota_kematian.sql` (+ tipe TS, folder storage).
2. **API** `anggota-kematian` (GET/POST/[id]) + service `lib/server/anggota-kematian-service.ts`.
3. **RBAC** permission baru + seed + menu.
4. **UI** halaman `keanggotaan/entry-meninggal-dunia` + form + list.
5. **Integrasi Dakem** prefill di `DanaKematianFormModal` + `handleMemberSelect`.
6. **Notifikasi** (opsional).
7. **Test** manual (entry → status meninggal → Wariskan NIK → pengajuan Dakem reuse data).

---

## 13. File yang Akan Terdampak (fase implementasi)

| Jenis | File |
|---|---|
| Migration | `supabase/migrations/031_create_anggota_kematian.sql` (baru) |
| Tipe | `lib/supabase.ts` |
| Storage | `lib/supabase-storage.ts`, `app/api/upload/route.ts` |
| API | `app/api/anggota-kematian/*` (baru), `app/api/anggota/[id]/kematian/route.ts` (baru) |
| Service | `lib/server/anggota-kematian-service.ts` (baru) |
| RBAC | `lib/rbac.ts`, `prisma/data/permissions.js` (seed) |
| Menu | `config/menu.config.tsx` |
| UI | `app/(protected)/keanggotaan/entry-meninggal-dunia/*` (baru), `components/anggota/*` (baru) |
| Integrasi | `components/dana-kematian/DanaKematianFormModal.tsx` |

---

*Dokumen disusun untuk tahap analisis. Belum ada perubahan kode.*

---

## 14. Keputusan Klien & Status Implementasi

Keputusan klien atas pertanyaan terbuka (§11):

1. Surat Kematian → **tidak wajib** (opsional saat entry).
2. Field tambahan (tempat/penyebab meninggal) → **tidak digunakan**.
3. Workflow approval → **tidak ada** (entry dicatat langsung).
4. Akses → **cabang / pusat / admin** boleh entry.
5. Notifikasi & sinkronisasi balik Dakem → **belum diaktifkan** (default off).

### Yang sudah diimplementasikan (fase implementasi)

| Area | Implementasi |
|---|---|
| Database | `supabase/migrations/031_create_anggota_kematian.sql` — tabel `anggota_kematian` (idempotent, additive, RLS, soft-delete, UNIQUE `anggota_id`) |
| Tipe | `lib/supabase.ts` — `AnggotaKematian`, `AnggotaKematianWithAnggota`, `CreateAnggotaKematianInput`, `UpdateAnggotaKematianInput`, `AnggotaKematianFilter` |
| Storage | folder `surat-kematian` pada bucket `anggota` (`lib/supabase-storage.ts`, `app/api/upload/route.ts`) |
| Service | `lib/server/anggota-kematian-service.ts` — `markAnggotaMeninggal`, `hasActiveAnggotaKematian`, select helper |
| API | `app/api/anggota-kematian` (GET/POST), `app/api/anggota-kematian/[id]` (GET/PUT/DELETE), `app/api/anggota/[id]/kematian` (lookup prefill) |
| Hook | `lib/hooks/use-anggota-kematian-api.ts` |
| RBAC | `lib/rbac.ts` — permission `MANAGE_KEMATIAN_ANGGOTA`, alias `DAKEM_MANAGE_PC`/`DAKEM_VERIFY_PP`, daftar akses `ENTRY_KEMATIAN_*` |
| Menu | `config/menu.config.tsx` — menu "Entry Meninggal Dunia" di bawah Keanggotaan |
| UI | `app/(protected)/keanggotaan/entry-meninggal-dunia/page.tsx` (form + riwayat) |
| Integrasi | `components/dana-kematian/DanaKematianFormModal.tsx` — prefill tanggal & surat kematian + badge "Data kematian tercatat" |

### Perilaku penting yang dijaga

- Entry kematian **tidak pernah** membuat baris `dana_kematian`.
- `anggota.status_anggota` disinkronkan ke `meninggal` (idempotent).
- Pengajuan Dana Kematian me-reuse tanggal & dokumen dari `anggota_kematian` (copy URL, tanpa upload ulang).
- Workflow, klaim, verifikasi, dan business rules Dana Kematian tidak berubah.
