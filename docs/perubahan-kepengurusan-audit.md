# Audit & Rekomendasi Desain — Perubahan Kepengurusan (Keanggotaan)

> Dokumen ini adalah hasil **audit/analisis tahap pertama** — **belum ada perubahan kode**.
> Tujuan: memetakan kondisi existing field **Posisi Kepengurusan** pada form Edit Anggota,
> lalu memberi rekomendasi desain menu **Perubahan Kepengurusan** (struktur halaman, matriks
> field, validasi, workflow, approval, struktur database + histori jabatan, dan strategi reuse)
> agar mudah ditemukan petugas tanpa mengambil alih proses bisnis menu lain.
>
> Pola & gaya dokumen mengikuti `docs/pengakhiran-keanggotaan-audit.md`,
> `docs/entry-meninggal-dunia-audit.md`, dan `docs/perubahan-data-pribadi-audit.md`.
> Tanggal audit: 6 November 2026.

---

## 1. Ringkasan Eksekutif

**Rekomendasi utama: jangan sekadar memindahkan form Edit** (Opsi A), karena form existing
memuat field milik modul lain (NIK, cabang, status kematian/keanggotaan, iuran, dsb.) dan
`posisi_kepengurusan`-nya hanya punya 2 nilai hardcoded (`anggota`/`pengurus`). Sebaliknya,
bangun **halaman khusus** yang **menggunakan ulang** komponen & business logic existing
(`MemberSearchModal`, pola allowlist/validasi `lib/anggota-perubahan.ts`, mekanisme approval
`anggota_perubahan` atau workflow PC/PP `pengakhiran_keanggotaan`), lalu tambahkan **enhancement**:

1. **Kanonikalisasi daftar posisi/jabatan** (satu sumber kebenaran) — saat ini form hanya
   `anggota`/`pengurus`, sedangkan tampilan tabel sudah mengenal `Ketua`/`Wakil Ketua`/
   `Sekretaris`/`Bendahara`/`Anggota` → **mismatch**.
2. **Tabel riwayat jabatan** (append-only) untuk menyimpan posisi, periode/masa jabatan,
   tanggal mulai–selesai, nomor/tanggal SK, dan file SK pengangkatan.
3. **Sinkronisasi idempotent** ke `anggota.posisi_kepengurusan` saat jabatan disetujui,
   sehingga tabel/badge existing tetap bekerja tanpa merusak data lama.
4. **Workflow approval** (langsung oleh admin / usulan non-admin, atau 2 tahap PC→PP) yang
   konsisten dengan modul tetangga.

**TIDAK direkomendasikan** mengubah `status_anggota` (peran keluarga), `status_keanggotaan`
(siklus hidup), atau `kategori_anggota` ketika seseorang diangkat menjadi pengurus — ketiga
field itu punya pemilik proses bisnis sendiri (lihat §3.4 dan §12).

**Keputusan kunci yang perlu disetujui klien** (lihat §13): daftar jabatan kanonik, apakah
satu anggota boleh >1 jabatan aktif, apakah perlu periode/masa jabatan, dan apakah perubahan
wajib melalui persetujuan PC/PP.

---

## 2. Cakupan Audit

| Area | File yang diperiksa |
|---|---|
| Skema anggota & enum | `supabase/migrations/001_create_anggota_table.sql` |
| Histori anggota | `supabase/migrations/003_create_anggota_history_table.sql` |
| Approval anggota (edit/hapus/create) | `supabase/migrations/027_dakem_claim_config_anggota_approval.sql`, `028_anggota_create_approval.sql` |
| Workflow PC/PP (referensi) | `supabase/migrations/029_create_pengajuan_mutasi_cabang.sql`, `032_create_pengakhiran_keanggotaan.sql` |
| Form edit anggota | `components/anggota/MemberForm.tsx`, `components/anggota/MemberFormModal.tsx`, `components/anggota/MemberFormModalTabbed.tsx` |
| Halaman pemanggil | `app/(protected)/keanggotaan/pengelolaan-data/page.tsx` |
| API anggota | `app/api/anggota/route.ts`, `app/api/anggota/[id]/route.ts`, `lib/server/anggota-service.ts` |
| Modul Perubahan Data Pribadi (pola reuse) | `app/api/anggota/[id]/perubahan-data/route.ts`, `lib/anggota-perubahan.ts`, `components/anggota/PerubahanDataPribadiForm.tsx`, `app/(protected)/keanggotaan/perubahan-data-pribadi/page.tsx` |
| Pencarian anggota reusable | `components/anggota/MemberSearchModal.tsx` |
| Upload dokumen | `app/api/upload/route.ts`, `lib/supabase-storage.ts` |
| RBAC & menu | `lib/rbac.ts`, `lib/rbac-server.ts`, `prisma/data/roles.js`, `prisma/data/permissions.js`, `config/menu.config.tsx` |
| Workflow status config | `lib/workflow/pengakhiran-keanggotaan-status.ts`, `lib/workflow/mutasi-cabang-status.ts` |

---

## 3. Temuan Audit (Kondisi Existing)

### 3.1 Field Posisi Kepengurusan di database

`supabase/migrations/001_create_anggota_table.sql`:

- Baris 47–50 mendefinisikan `posisi_kepengurusan_enum` (`'anggota'`, `'pengurus'`) —
  **tipe enum ini TIDAK dipakai kolom mana pun** (dead type).
- Baris 107: kolom aktual adalah `posisi_kepengurusan VARCHAR(120) DEFAULT 'Anggota'` —
  **free text**, tanpa CHECK constraint, tanpa relasi, tanpa histori.

Konsekuensi:

- Nilai di produksi bisa campur aduk: `'Anggota'` (default DB & `buildAnggotaCreatePayload`),
  `'anggota'` (default `ImportExcelModal`), `'pengurus'`, `'Ketua'`, `'Wakil Ketua'`, dst.
  (import Excel free-text, `ImportExcelModal.tsx` baris 78; `batch-import` baris 143).
- Tidak ada tabel master posisi/jabatan (`master_posisi`/`master_jabatan` **tidak ada** —
  diverifikasi lewat pencarian menyeluruh).
- Tidak ada kolom periode/masa jabatan, tanggal mulai/selesai jabatan, nomor/tanggal SK
  pengangkatan, atau file SK — **tidak ada sama sekali** di seluruh skema.

### 3.2 Field di form & tampilan (mismatch)

| Lokasi | Perilaku |
|---|---|
| `components/anggota/MemberForm.tsx` (baris 434–452) | Select wajib dengan **hanya 2 opsi**: `anggota` → "Anggota", `pengurus` → "Pengurus". Dipakai form Edit & Tambah pada Pengelolaan Data. |
| `components/anggota/MemberFormModalTabbed.tsx` (baris 632–645) | Select yang sama — komponen ini **dead code** (ditandai di `docs/perubahan-data-pribadi-audit.md` §"Belum dikerjakan"). |
| `app/(protected)/keanggotaan/pengelolaan-data/page.tsx` (baris 213–223, 565–577) | Badge `POSISI KEPENGURUSAN` dengan map: **Ketua / Wakil Ketua / Sekretaris / Bendahara / Anggota** (fallback: tampilkan nilai apa adanya). |
| `components/anggota/DetailModal.tsx` (baris 268–270) | Menampilkan nilai mentah `posisi_kepengurusan`. |

**Mismatch yang sudah terdokumentasi**: `docs/perubahan-data-pribadi-audit.md` §3.2 —
"nilai form hanya `anggota`/`pengurus`; tabel menampilkan `Ketua`/`Wakil Ketua`/dst → **mismatch**".
Artinya kebutuhan bisnis nyata mengenal jabatan struktural (Ketua, Sekretaris, Bendahara, …),
tetapi form existing tidak pernah mampu menginput nilai tersebut secara terkontrol.

### 3.3 Mekanisme perubahan posisi saat ini

Jalur satu-satunya: **Keanggotaan → Pengelolaan Data → Edit** → `PUT /api/anggota/[id]`
(`app/api/anggota/[id]/route.ts`):

1. `requirePermission(MANAGE_KEANGGOTAAN)`.
2. Cek eksistensi (`deleted_at IS NULL`) + duplikasi NIK.
3. **Non-admin** → insert `anggota_perubahan` (`jenis='edit'`, `status='menunggu'`,
   `data_sebelum`, `data_usulan` JSONB, `alasan`, `diajukan_oleh`) → data utama **tidak berubah**
   sampai admin memutuskan lewat `POST /api/anggota/approvals/[id]`.
4. **Admin** (`isAdminActor`, slug `admin`/`administrator`/`owner`) → langsung
   `buildAnggotaUpdatePayload` (full-payload UPDATE) + `recordMutasiIfCabangChanged`.

Perubahan posisi kepengurusan **tidak punya validasi khusus** — hanya ikut terbawa sebagai
satu field di antara puluhan field; tidak ada pencatatan "siapa mengangkat, berdasarkan SK apa,
periode berapa".

### 3.4 Pemilikan field & perlindungan antar-modul

`lib/anggota-perubahan.ts` menempatkan `posisi_kepengurusan` di **`PROTECTED_FIELDS`** (baris 104)
— artinya menu **Perubahan Data Pribadi secara eksplisit tidak boleh** mengubahnya, dan
komentar kepala file menyebutnya "data organisasi (admin-only via Pengelolaan Data)".
Field ini juga muncul di `FIELD_LABELS` (baris 131).

Pemilik proses bisnis field terkait:

| Field | Pemilik proses |
|---|---|
| `posisi_kepengurusan` | Pengelolaan Data (saat ini) → calon pemilik baru: **Perubahan Kepengurusan** |
| `status_anggota` (pegawai/istri/suami/anak/meninggal) | **Peran keluarga** — enum shared dengan `dana_kematian`, DO NOT MODIFY |
| `status_keanggotaan` (aktif/non_aktif/berhenti) | Pengakhiran Keanggotaan (migration 032) |
| `kategori_anggota`, `status_mps`, `status_iuran` | Business rule inti (migration 023) |
| `kode_cabang`, `nama_cabang`, `cabang_*` | Mutasi Cabang (denormalisasi `master_cabang`) |

### 3.5 Histori / audit trail

- `anggota_history` (migration 003): trigger menyimpan snapshot JSONB penuh
  (`changed_data`/`previous_data`) — perubahan `posisi_kepengurusan` **ter-snapshot**, tetapi
  `changed_fields` hanya mendeteksi 9 kolom (nik, nama, kategori, status_anggota, nama_cabang,
  kode_cabang, alamat, nomor_handphone, email) → posisi **tidak terdeteksi** di daftar field;
  `changed_by` bergantung `auth.uid()` yang **tidak terisi** untuk request API aplikasi ini.
- `anggota_perubahan` (migration 027/028): usulan + keputusan (aktor, alasan, waktu) — dipakai
  Pengelolaan Data & Perubahan Data Pribadi. Inilah jejak "siapa/kenapa/kapan" yang otoritatif.
- `anggota_mutasi` (migration 027): pola **riwayat append-only** yang tepat untuk ditiru
  oleh histori jabatan.
- `SIPATEL_ARCHITECTURAL_AUDIT.md` (§field-classification) menyatakan posisi kepengurusan
  sebagai "Binary, rarely changes — remain enum" (berdasar nilai form `anggota`/`pengurus`);
  temuan §3.2 di atas menunjukkan kebutuhan nyata lebih kaya dari itu.

### 3.6 RBAC, role, dan menu

- Permission keanggotaan: `access_keanggotaan`, `view_keanggotaan`, `manage_keanggotaan`,
  `history_anggota_view/manage`, `manage_kematian_anggota`, `manage_pengakhiran_keanggotaan`
  (`lib/rbac.ts`). Pola permission khusus per fitur: `manage_pengakhiran_keanggotaan` +
  grup `PENGAKHIRAN_MANAGE_PERMISSIONS` (termasuk kapabilitas Dakem `dana_kematian.manage_pc` /
  `dana_kematian.verify_pp` agar PC/PP bisa masuk).
- Role aplikasi: `admin`, `pc_staff`, `pc_kepala`, `pp_staff`, `pp_kepala`, `keuangan`, dst.
  (`prisma/data/roles.js`). `isAdminActor()` = slug `admin`/`administrator`/`owner`.
- Menu Keanggotaan (`config/menu.config.tsx` baris 278–331): Pendaftaran Anggota Baru,
  Pengelolaan Data, Perubahan Data Pribadi, Mutasi Cabang, Data Meninggal Dunia,
  Pengakhiran Keanggotaan (+ History Anggota dikomentari).

### 3.7 Pencarian anggota & upload (komponen siap pakai)

- `components/anggota/MemberSearchModal.tsx` — modal pencarian reusable by **NIK** (exact→contains)
  dan **nama**; `GET /api/anggota?search=` sudah di-guard `MANAGE_KEANGGOTAAN`/`VIEW_KEANGGOTAAN`.
  Catatan: di sistem ini **NIK = Nomor Induk Anggota** (komentar kolom migration 001) — tidak ada
  konsep "nomor anggota" terpisah, jadi kebutuhan klien "NIK/nama/nomor anggota" terpenuhi oleh
  NIK + nama.
- Upload: `lib/supabase-storage.ts` + `app/api/upload/route.ts` dengan whitelist folder bucket
  `anggota` (pola: `surat-kematian`, `surat-pengakhiran`) — tinggal tambah folder mis. `sk-pengangkatan`.

### 3.8 Pola modul tetangga yang bisa ditiru

| Pola | Contoh implementasi | Cocok untuk |
|---|---|---|
| Halaman 3 langkah (cari → ubah → tinjau) | `app/(protected)/keanggotaan/perubahan-data-pribadi/page.tsx` | form fokus 1 entitas |
| Allowlist + zod + diff + partial payload | `lib/anggota-perubahan.ts`, `app/api/anggota/[id]/perubahan-data/route.ts` | validasi & audit |
| Workflow 2 tahap PC→PP + status config terpusat | migration 032, `lib/workflow/pengakhiran-keanggotaan-status.ts`, `lib/server/pengakhiran-keanggotaan-service.ts` | approval formal |
| Riwayat append-only | `anggota_mutasi` (migration 027) | histori jabatan |
| Sinkronisasi idempotent saat disetujui | `markAnggotaBerhenti()` (`pengakhiran-keanggotaan-service.ts`) | sync `posisi_kepengurusan` |

---

## 4. Evaluasi Opsi & Brainstorming

### 4.1 Opsi implementasi

| Opsi | Deskripsi | Verdict |
|---|---|---|
| **A. Pindahkan form Edit apa adanya** | Menu baru = shortcut ke form `MemberForm` yang sama. | ❌ Form memuat field milik modul lain & select posisi cuma 2 nilai; tidak memberi value tambahan. |
| **B. Halaman khusus, form fokus, reuse mekanisme existing** | Cari anggota → form fokus (posisi/jabatan + SK) → simpan via `anggota.posisi_kepengurusan` + approval `anggota_perubahan`. | ✅ Cepat, aman, konsisten; cocok sebagai MVP. |
| **C. B + tabel riwayat jabatan (histori + periode + SK)** | Tambah tabel append-only `anggota_kepengurusan` untuk menyimpan tiap peristiwa jabatan; sync `posisi_kepengurusan` saat disetujui. | ✅✅ **Rekomendasi utama** — memenuhi kebutuhan periode/SK/histori di brief. |

**Rekomendasi: Opsi C (hybrid)** — bangun halaman khusus yang **menggunakan ulang** `MemberSearchModal`,
pola allowlist/zod/diff `lib/anggota-perubahan.ts`, dan workflow approval existing, lalu **tambahkan
tabel histori jabatan** (lihat §10). Ini memenuhi seluruh butir kebutuhan brief (periode, SK, upload,
riwayat, pemberhentian) tanpa membangun ulang mekanisme yang sudah ada.

### 4.2 Hal yang harus dipertahankan (constraint dari brief)

- **Tidak membuat master baru jika sudah ada** → master posisi/jabatan **tidak ada**, jadi boleh
  dibuat; tetapi karena himpunannya kecil & stabil, rekomendasi awal adalah **enum/konstanta**
  (bukan tabel CRUD), kecuali klien butuh kelola posisi per cabang/level (lihat §13-Q1).
- **Tidak mengubah `status_anggota`/`status_keanggotaan`/`kategori_anggota`** saat pengangkatan —
  modul ini **hanya** menulis `anggota.posisi_kepengurusan` + tabel histori. (Catatan: "pengurus"
  adalah peran organisasi, bukan tier anggota dan bukan siklus hidup.)
- **Pertahankan histori** — tabel baru append-only; `anggota_history` & `anggota_perubahan`
  tetap berjalan sebagaimana adanya.
- **Tidak mengganggu** Perubahan Data Pribadi (yang sudah mengunci `posisi_kepengurusan`) dan
  Pengelolaan Data (yang tetap bisa edit penuh via admin).

### 4.3 Multi-jabatan vs jabatan tunggal (butuh keputusan)

Data existing `anggota.posisi_kepengurusan` bersifat **tunggal** (satu nilai per anggota), dan
badge tabel menampilkan satu posisi. Namun organisasi nyata memungkinkan satu orang merangkap
(mis. Sekretaris + Ketua Bidang). Dua model:

- **Model tunggal (rekomendasi awal):** satu jabatan aktif per anggota pada satu waktu; riwayat
  menyimpan jabatan lampau. Sederhana, sesuai data existing.
- **Model banyak:** satu anggota boleh >1 jabatan aktif; `posisi_kepengurusan` hanya menyimpan
  jabatan "utama". Lebih kaya, tapi perlu aturan jabatan utama & dampak ke badge/filter.

Rekomendasikan **mulai dari model tunggal**, dengan skema yang tidak menutup kemungkinan
upgrade ke multi-jabatan (partial unique index dapat diubah dari `(anggota_id)` menjadi
`(anggota_id, jabatan)` tanpa migrasi destruktif) — lihat §10.3.

---

## 5. Rekomendasi Nama Menu

| Opsi | Penilaian |
|---|---|
| **"Perubahan Kepengurusan"** ✅ | Sesuai istilah klien; paralel dengan menu existing "Perubahan Data Pribadi"; netral — mencakup pengangkatan, perpindahan jabatan, DAN pemberhentian. |
| "Pengangkatan Pengurus" | Hanya mencakup penunjukan; tidak mencakup pemberhentian/perpindahan jabatan. |
| "Manajemen Kepengurusan" | Cukup baik, tetapi kurang selaras dengan pola penamaan "Perubahan …" di grup menu ini. |
| "Data Pengurus" / "Kepengurusan" | Terdengar seperti modul master data, bukan transaksi perubahan. |
| "Ubah Posisi Pengurus" | Mengacu nama kolom teknis; kurang formal untuk menu. |

**Rekomendasi: "Perubahan Kepengurusan"**, path `/keanggotaan/perubahan-kepengurusan`
(konsisten dengan pola path `entry-meninggal-dunia`, `pengakhiran-keanggotaan`), ditempatkan
**setelah "Perubahan Data Pribadi"** (berdampingan dengan menu "perubahan" lain, sebelum
"Mutasi Cabang").

```tsx
{
  // Perubahan posisi/jabatan kepengurusan anggota (angkat, pindah, berhenti jabatan)
  // — satu-satunya jalur terkontrol untuk mengubah posisi_kepengurusan beserta
  // periode jabatan, SK pengangkatan, dan riwayatnya.
  title: 'Perubahan Kepengurusan',
  path: '/keanggotaan/perubahan-kepengurusan',
  permissions: [PERMISSIONS.MANAGE_KEANGGOTAAN],
}
```

Ikon wajar: `UserCheck` atau `Award` (keduanya sudah di-import di `config/menu.config.tsx`).

---

## 6. Rekomendasi Struktur Halaman & Form

**Model halaman: 1 halaman dengan 3 langkah (stepper) + panel riwayat**, meniru
`app/(protected)/keanggotaan/perubahan-data-pribadi/page.tsx`:

```
┌───────────────────────────────────────────────────────────────────┐
│ Toolbar: "Perubahan Kepengurusan"                     [Riwayat ⟳]  │
├───────────────────────────────────────────────────────────────────┤
│ Stepper:  ① Cari Anggota  →  ② Pilih Jabatan & SK  →  ③ Tinjau & Kirim │
├───────────────────────────────────────────────────────────────────┤
│ Langkah 1  [Cari NIK / Nama]  → MemberSearchModal (reuse)          │
│            Kartu ringkas anggota: Nama, NIK, Cabang,              │
│            Posisi saat ini (badge), Status keanggotaan            │
│            ⚠ blokir jika status_keanggotaan='berhenti' /          │
│              status_anggota='meninggal'                           │
├───────────────────────────────────────────────────────────────────┤
│ Langkah 2  Form fokus:                                            │
│            - Jenis perubahan: Angkat / Pindah / Berhentikan       │
│            - Jabatan (select kanonik)   *wajib                    │
│            - Periode (opsional)                                   │
│            - Tanggal mulai jabatan      *wajib                    │
│            - Tanggal selesai jabatan    (opsional; kosong=aktif)  │
│            - Nomor SK pengangkatan      *wajib (min 3)            │
│            - Tanggal SK                 *wajib                    │
│            - Upload SK (opsional)                                 │
│            - Keterangan / alasan       *alasan wajib (≥10 char)   │
├───────────────────────────────────────────────────────────────────┤
│ Langkah 3  Ringkasan: diff "posisi lama → posisi baru" + periode  │
│            + SK + file; tombol Simpan / Ajukan                     │
├───────────────────────────────────────────────────────────────────┤
│ Panel Riwayat Kepengurusan anggota (tabel append-only, di bawah    │
│ atau tab terpisah): Jabatan | Periode | Mulai | Selesai | No SK |  │
│ Tanggal SK | Status | File | Aktor                                 │
└───────────────────────────────────────────────────────────────────┘
```

Catatan desain halaman:

- **Hanya anggota eligible** yang bisa dipilih: `deleted_at IS NULL`, `status_keanggotaan <> 'berhenti'`,
  `status_anggota <> 'meninggal'` (selaras guard `pengakhiran`/`entry-meninggal-dunia`).
- **Mode "Berhentikan jabatan"** memakai form yang sama dengan field tambahan: tanggal
  berhenti jabatan + nomor SK pemberhentian; pada persetujuan, `anggota.posisi_kepengurusan`
  di-set `'Anggota'` dan record jabatan aktif ditutup (`tanggal_selesai`).
- **Riwayat** bisa dirender dengan `HistoryTimeline`/`Table` pattern yang sudah ada.

---

## 7. Rekomendasi Field + Validasi

### 7.1 Matriks field form

| Field | Sumber | Wajib | Aturan validasi |
|---|---|---|---|
| Anggota | `MemberSearchModal` (NIK/nama) | ✅ | Resolve `anggota_id` server-side; `deleted_at IS NULL`; tolak bila `status_keanggotaan='berhenti'` atau `status_anggota='meninggal'` |
| NIK / Nama / Cabang | read-only dari anggota | — | Ditampilkan sebagai snapshot |
| Posisi saat ini | read-only | — | Nilai `anggota.posisi_kepengurusan` |
| Jenis perubahan | select | ✅ | `angkat` / `pindah` / `berhentikan` |
| Jabatan / Posisi | select kanonik (§13-Q1) | ✅ | Harus salah satu nilai kanonik; tidak boleh sama dengan posisi aktif saat ini untuk jenis `angkat`/`pindah` |
| Periode | input teks/select | ❌ | Opsional, mis. "2025–2030" (lihat §13-Q3) |
| Tanggal mulai jabatan | date | ✅ | Tidak boleh > hari ini + toleransi (lihat §13-Q4); untuk `berhentikan` = tanggal efektif berhenti jabatan |
| Tanggal selesai jabatan | date | ❌ | Bila diisi: harus `> tanggal_mulai`; kosong = jabatan masih aktif |
| Nomor SK | input | ✅ | min 3 karakter; unik antar jabatan aktif (mirip guard `nomor_dokumen` pengakhiran) |
| Tanggal SK | date | ✅ | `tanggal_sk <= tanggal_mulai_jabatan` (pola `pengakhiran_tanggal_order`) |
| Upload SK | upload API | ❌ (rekomendasi wajib untuk `angkat`) | Whitelist tipe file & folder bucket (lihat §11) |
| Alasan / Keterangan | textarea | ✅ (alasan) | min 10 karakter (pola `perubahan-data-pribadi`) — menjadi `alasan` di `anggota_perubahan` |

### 7.2 Validasi server-side (sebelum insert)

- Anggota tidak ditemukan / sudah dihapus → 404.
- Anggota `berhenti`/`meninggal` → 409 (tidak layak diangkat).
- Sudah ada jabatan **aktif** (`status` aktif & `tanggal_selesai IS NULL`) untuk anggota →
  409 (model tunggal) atau 409 hanya bila jabatan sama (model multi).
- `tanggal_sk > tanggal_mulai_jabatan` → 422.
- `tanggal_selesai <= tanggal_mulai_jabatan` (bila diisi) → 422.
- Nomor SK sudah dipakai jabatan aktif lain → 409 `DOCUMENT_NUMBER_USED`.
- Tidak ada field berubah (diff kosong) → 400 (pola `perubahan-data`).
- Validasi **zod strict** + allowlist field (tolak field di luar skema) — pola `lib/anggota-perubahan.ts`.

### 7.3 Kanonikalisasi daftar jabatan

Karena enum existing hanya `anggota`/`pengurus`, tetapi tampilan butuh `Ketua`/`Wakil Ketua`/
`Sekretaris`/`Bendahara`, rekomendasi: **satu konstanta kanonik** (mirip `PENGAKHIRAN_STATUSES`)
mis. `POSISI_KEPENGURUSAN_OPTIONS` di `lib/anggota-kepengurusan.ts`, berisi minimal:

```
'Anggota', 'Pengurus', 'Ketua', 'Wakil Ketua', 'Sekretaris', 'Bendahara'
```

Beserta label + badge variant, sehingga **form, tabel, detail, dan export memakai map yang sama**
(menghapus drift `getPosisiKepengurusanProps`). Nilai final daftar jabatan dikonfirmasi klien (§13-Q1).

---

## 8. Rekomendasi Workflow Perubahan Kepengurusan

### 8.1 Dua kandidat workflow (pola yang sudah ada di sistem)

| Aspek | Workflow 1: Approval admin (pola Edit/Perubahan Data Pribadi) | Workflow 2: PC → PP (pola Mutasi/Pengakhiran) |
|---|---|---|
| Alur | Petugas submit → `anggota_perubahan` (`menunggu`) → **admin** memutuskan | Petugas (PC) submit → `menunggu` → verifikasi **PC** → `diverifikasi_pc` → keputusan **PP** → `disetujui_pp` / `ditolak` / `dibatalkan` |
| Apply data utama | Saat admin menyetujui (atau langsung bila aktor = admin) | Saat `disetujui_pp` |
| Peran | Non-admin mengusulkan; admin menyetujui | PC mengusulkan/verifikasi; PP memutuskan |
| Kompleksitas | Rendah — infrastruktur `anggota_perubahan` + `AnggotaApprovalsModal` sudah ada | Sedang — tabel + status config + PATCH transition baru (pola 032) |

### 8.2 Rekomendasi

Karena pengangkatan/pemberhentian pengurus adalah **keputusan organisasi formal yang
berbasis SK** (umumnya ditetapkan PP/pusat), rekomendasi: **Workflow 2 (PC → PP)** untuk
perubahan yang mengubah `posisi_kepengurusan`, dengan **jalur cepat admin**:
aktor admin (`isAdminActor`) boleh langsung menetapkan (self-approved + jejak audit),
pola yang juga dipakai modul Perubahan Data Pribadi.

Alur lengkap (jenis `angkat` / `pindah`):

1. Petugas mencari anggota → mengisi jabatan + SK + periode → kirim.
2. Sistem membuat record `anggota_kepengurusan` (`status='menunggu'`).
   `anggota.posisi_kepengurusan` **belum** berubah.
3. Verifikator PC → `diverifikasi_pc` (catatan verifikasi).
4. Keputusan PP:
   - `disetujui_pp` → dalam operasi yang sama: (a) tutup jabatan aktif lama
     (`tanggal_selesai = tanggal_mulai - 1 hari` atau tanggal efektif di SK), (b) buka/aktifkan
     jabatan baru, (c) **sinkron idempotent** `anggota.posisi_kepengurusan` = jabatan baru.
   - `ditolak` / `dibatalkan` → terminal, tidak ada perubahan data.
5. Mode `berhentikan`: alur sama; saat disetujui jabatan aktif ditutup dan
   `anggota.posisi_kepengurusan` = `'Anggota'`.
6. Semua langkah tercatat (siapa/kapan/catatan) di record itu sendiri — audit trail
   tidak lagi bergantung pada trigger `anggota_history`.

Bila klien menginginkan kesederhanaan (tidak ada tahap verifikasi PC), fallback: Workflow 1
dengan `anggota_perubahan` + field tambahan di `data_usulan` — tetapi histori jabatan &
periode tetap butuh tabel baru, jadi Opsi C + Workflow 2 tidak jauh lebih mahal.

---

## 9. Rekomendasi Kebutuhan Approval & RBAC

- **Permission baru**: `manage_perubahan_kepengurusan` (slug) — akses menu + submit + verifikasi,
  mengikuti pola `manage_pengakhiran_keanggotaan` (`prisma/data/permissions.js`, `lib/rbac.ts`,
  grup `PERMISSION_GROUPS.KEANGGAOTAAN`).
- **Grup akses menu** (pola `PENGAKHIRAN_MANAGE_PERMISSIONS`):

```ts
export const KEPENGURUSAN_MANAGE_PERMISSIONS = [
  PERMISSIONS.MANAGE_KEANGGOTAAN,
  PERMISSIONS.MANAGE_PERUBAHAN_KEPENGURUSAN,
  PERMISSIONS.DAKEM_MANAGE_PC,   // petugas PC
  PERMISSIONS.DAKEM_VERIFY_PP,   // petugas PP
];
```

- **Keputusan final (PP)**: bisa memakai `DAKEM_VERIFY_PP` (pola pengakhiran: PP = pusat)
  atau permission khusus `approve_perubahan_kepengurusan` bila klien ingin pemisah tegas
  penentu vs pengaju (lihat §13-Q6).
- **Administrator** selalu lolos (`hasAnyPermission`) dan bisa jalur cepat (langsung efektif,
  dengan jejak self-approved).
- Menu & halaman dibungkus `<ProtectedRoute permission={...}>` + `useHasAnyPermission`
  untuk tombol aksi (pola halaman pengakhiran).
- Guard API: `requireAnyPermission([...KEPENGURUSAN_MANAGE_PERMISSIONS])` untuk GET/POST,
  dan cek `isAdminActor`/permission keputusan untuk PATCH transisi.

---

## 10. Rekomendasi Struktur Database & Histori Jabatan

### 10.1 Ringkasan keputusan skema

| Kebutuhan | Solusi | Alasan |
|---|---|---|
| Daftar posisi/jabatan | Konstanta kanonik `POSISI_KEPENGURUSAN_OPTIONS` (+ opsional CHECK) | Himpunan kecil & stabil; menghindari master CRUD yang tidak diminta (§13-Q1) |
| Posisi "saat ini" | tetap `anggota.posisi_kepengurusan` (di-sync) | Tabel/badge/export existing tetap bekerja tanpa perubahan |
| Histori jabatan (periode, SK, mulai/selesai) | **tabel baru** `anggota_kepengurusan` (append-only) | Data existing tidak punya histori |
| Multi-jabatan | partial unique index yang mudah di-upgrade (§10.3) | Mulai sederhana, future-proof |

### 10.2 Skema usulan `anggota_kepengurusan` (migration baru, additive & idempotent)

```sql
-- Migration 033: Perubahan Kepengurusan
DO $$ BEGIN
  CREATE TYPE kepengurusan_jenis_enum   AS ENUM ('angkat', 'pindah', 'berhentikan');
  CREATE TYPE kepengurusan_status_enum  AS ENUM
    ('menunggu', 'diverifikasi_pc', 'disetujui_pp', 'ditolak', 'dibatalkan');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS anggota_kepengurusan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anggota_id UUID NOT NULL REFERENCES anggota(id) ON DELETE CASCADE,

  -- Snapshot identitas (tahan terhadap perubahan data induk)
  nik VARCHAR(25),
  nama_anggota VARCHAR(255),
  nama_cabang VARCHAR(120),
  kode_cabang VARCHAR(20),

  -- Fakta jabatan
  jenis       kepengurusan_jenis_enum NOT NULL,
  jabatan     VARCHAR(120) NOT NULL,          -- nilai kanonik, mis. 'Sekretaris'
  jabatan_sebelumnya VARCHAR(120),            -- untuk 'pindah'/'berhentikan'
  periode     VARCHAR(50),                     -- opsional, mis. '2025-2030'
  tanggal_mulai DATE NOT NULL,
  tanggal_selesai DATE,                        -- NULL = jabatan aktif
  nomor_sk    VARCHAR(255) NOT NULL,
  tanggal_sk  DATE NOT NULL,
  file_sk     TEXT,                            -- URL Supabase Storage (opsional)
  keterangan  TEXT,
  metadata    JSONB DEFAULT '{}'::jsonb,

  -- Workflow (pola migration 032)
  status kepengurusan_status_enum NOT NULL DEFAULT 'menunggu',
  catatan_pengaju TEXT,
  diverifikasi_oleh VARCHAR(255),
  diverifikasi_pada TIMESTAMPTZ,
  catatan_verifikasi TEXT,
  diputuskan_oleh VARCHAR(255),
  diputuskan_pada TIMESTAMPTZ,
  alasan_keputusan TEXT,

  diajukan_oleh VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  deleted_at TIMESTAMPTZ
);
```

**Constraint & index kunci:**

```sql
-- Tanggal SK tidak melewati tanggal mulai jabatan
ALTER TABLE anggota_kepengurusan
  ADD CONSTRAINT kepengurusan_tanggal_order
  CHECK (tanggal_sk <= tanggal_mulai);

-- Bila tanggal selesai diisi, harus setelah tanggal mulai
ALTER TABLE anggota_kepengurusan
  ADD CONSTRAINT kepengurusan_selesai_setelah_mulai
  CHECK (tanggal_selesai IS NULL OR tanggal_selesai > tanggal_mulai);

-- Nomor SK unik antar jabatan aktif/final (pola uq_pengakhiran_nomor_aktif)
CREATE UNIQUE INDEX IF NOT EXISTS uq_kepengurusan_nomor_aktif
  ON anggota_kepengurusan(lower(btrim(nomor_sk)))
  WHERE status IN ('menunggu','diverifikasi_pc','disetujui_pp');

CREATE INDEX IF NOT EXISTS idx_kepengurusan_anggota
  ON anggota_kepengurusan(anggota_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kepengurusan_status
  ON anggota_kepengurusan(status);

ALTER TABLE anggota_kepengurusan ENABLE ROW LEVEL SECURITY;
```

> **Catatan:** karena migration 027/028/032 memakai `gen_random_uuid()`, ikuti pola yang sama.
> `update_updated_at_column()` sudah tersedia (migration 001/032) — tambahkan trigger
> `trg_kepengurusan_updated_at` serupa.

### 10.3 Multi-jabatan & "jabatan aktif"

- **Model tunggal (rekomendasi awal):** tambahkan partial unique index
  `uq_kepengurusan_aktif_per_anggota` pada `(anggota_id)` WHERE `status = 'disetujui_pp'`
  AND `tanggal_selesai IS NULL` — memaksa **satu jabatan aktif per anggota**.
- **Upgrade ke model banyak:** ubah index tersebut menjadi `(anggota_id, jabatan)`; tidak ada
  perubahan kolom, hanya aturan index + aturan sinkronisasi `posisi_kepengurusan` (pilih jabatan
  "utama"). Skema §10.2 sudah mendukung keduanya.
- `anggota.posisi_kepengurusan` selalu menyimpan **satu** nilai untuk kompatibilitas tabel/badge/
  export existing; histori lengkap ada di `anggota_kepengurusan`.

### 10.4 Sinkronisasi & backfill (jaga data lama)

- **Sinkronisasi idempotent** saat `disetujui_pp` (pola `markAnggotaBerhenti`):
  `UPDATE anggota SET posisi_kepengurusan = jabatan_baru WHERE id = ... AND posisi_kepengurusan IS DISTINCT FROM jabatan_baru`.
- **Tidak ada backfill paksa** ke `anggota_kepengurusan` untuk data lama (posisi existing sudah
  terlihat di `anggota.posisi_kepengurusan`; histori jabatan hanya mulai terakumulasi sejak fitur aktif).
  Bila wajib ada "titik awal" histori, seed satu record `disetujui_pp` bertanggal SK lama — keputusan §13-Q7.
- **Tidak menyentuh** `anggota_history` trigger — perubahan `anggota.posisi_kepengurusan` tetap
  otomatis ter-snapshot (walaupun `changed_fields` belum mendaftarnya; lihat §3.5).

---

## 11. Strategi Reuse Komponen & Business Logic

| Yang dipakai ulang | Asal | Cara pakai |
|---|---|---|
| `MemberSearchModal` | `components/anggota/MemberSearchModal.tsx` | Langkah 1 (cari NIK/nama), tanpa modifikasi |
| Primitive UI (`Select`, `Input`, `DatePicker`, `Textarea`, `Dialog`, `Table`, `Badge`) | `components/ui/*` | Form langkah 2 + panel riwayat |
| Pola allowlist + zod strict + diff | `lib/anggota-perubahan.ts` | Buat modul kembar `lib/anggota-kepengurusan.ts` (allowlist field kepengurusan, `safeParsePerubahanKepengurusan`, `computeKepengurusanDiff`, payload builder) |
| `isAdminActor`, payload builder | `lib/server/anggota-service.ts` | Jalur cepat admin + sinkronisasi |
| `requireAnyPermission` / `isAdminActor` | `lib/rbac-server.ts`, `lib/server/anggota-service.ts` | Guard API & keputusan |
| Pola status config terpusat | `lib/workflow/pengakhiran-keanggotaan-status.ts` | Buat `lib/workflow/kepengurusan-status.ts` (label, badge, transisi, status aktif/terminal) |
| Pola service + validation module | `lib/server/pengakhiran-keanggotaan-service.ts`, `lib/utils/pengakhiran-keanggotaan-validation.ts` | `lib/server/kepengurusan-service.ts` (guard duplikasi, sync) + `lib/utils/kepengurusan-validation.ts` |
| Pola hook react-query | `lib/hooks/use-pengakhiran-keanggotaan-api.ts`, `use-anggota-api.ts` | `use-anggota-kepengurusan-api.ts` (list/create/update status/lookup) |
| Upload dokumen | `app/api/upload/route.ts`, `lib/supabase-storage.ts` | Tambah folder whitelist `sk-pengangkatan` pada bucket `anggota` |
| Menu & permission group | `config/menu.config.tsx`, `lib/rbac.ts` | Tambah `PERMISSIONS.MANAGE_PERUBAHAN_KEPENGURUSAN` + grup + entri menu |
| Seed permission | `prisma/data/permissions.js` + migration pola 013/016 | Tambah slug permission baru |

**Endpoint yang diusulkan** (pola `pengakhiran-keanggotaan`):

| Endpoint | Metode | Fungsi |
|---|---|---|
| `/api/anggota-kepengurusan` | GET | Daftar riwayat/perubahan kepengurusan (filter status/pencarian/pagination) |
| `/api/anggota-kepengurusan` | POST | Ajukan perubahan (validasi §7, guard duplikasi/eligibilitas) |
| `/api/anggota-kepengurusan/[id]` | GET | Detail |
| `/api/anggota-kepengurusan/[id]` | PATCH | Verifikasi (`diverifikasi_pc`) / keputusan (`disetujui_pp`/`ditolak`/`dibatalkan`) + **apply + sync** saat disetujui |
| `/api/anggota/[id]/kepengurusan` | GET | Lookup jabatan aktif/riwayat per anggota (guard/prefill modul lain) |

**Alternatif lebih ringan (jika klien pilih Workflow 1):** POST ke endpoint khusus
`/api/anggota/[id]/perubahan-kepengurusan` (pola `/api/anggota/[id]/perubahan-data`) yang
menulis `anggota_perubahan` + tabel histori; keputusan lewat `POST /api/anggota/approvals/[id]`.

---

## 12. Dampak terhadap Modul Lain (dijaga seminimal mungkin)

| Modul | Dampak | Tindakan |
|---|---|---|
| **Pengelolaan Data** | Form Edit masih punya select posisi (2 nilai) → risiko dua jalur ubah posisi | **Rekomendasi:** pada form Edit, jadikan field posisi **read-only** dengan tooltip "ubah lewat menu Perubahan Kepengurusan"; atau minimal samakan opsi ke daftar kanonik (§13-Q2). Badge tabel langsung membaik karena nilai jadi kanonik. |
| **Perubahan Data Pribadi** | Tidak berdampak — `posisi_kepengurusan` memang sudah `PROTECTED_FIELDS` | Tidak ada perubahan. |
| **Pendaftaran Anggota Baru** | Posisi default `'Anggota'` tetap wajar | Opsional: batasi opsi form create ke nilai kanonik (pencatat posisi awal). |
| **Mutasi Cabang** | Jabatan tidak terpengaruh mutasi cabang (organisasi ≠ lokasi cabang) | Tidak ada perubahan; snapshot `nama_cabang` di histori menunjukkan konteks saat pengangkatan. |
| **Data Meninggal Dunia / Pengakhiran** | Anggota meninggal/berhenti tidak boleh diangkat | Guard eligibilitas (§7.2); kebalikannya, saat anggota berhenti/meninggal, **jabatan aktifnya perlu ditutup** — rekomendasi: tutup otomatis saat `anggota_kematian`/`pengakhiran` disetujui (fase 2, §13-Q8). |
| **Dana Kematian** | Tidak ada relasi langsung ke `posisi_kepengurusan` | Tidak ada perubahan. |
| **Import/Export Excel** | Nilai posisi free-text bisa masuk di luar daftar kanonik | Opsional (fase 2): validasi/normalisasi nilai import terhadap daftar kanonik + laporan baris gagal. |
| **Dashboard / laporan** | Potensi laporan "susunan pengurus per cabang" | Value-added masa depan; tidak mengubah existing. |

**Constraint yang dipegang (dari brief):** fitur ini **tidak** mengubah `status_anggota`,
`status_keanggotaan`, `kategori_anggota`, atau field iuran ketika mengangkat pengurus —
hanya `posisi_kepengurusan` + histori.

---

## 13. Pertanyaan Terbuka (Perlu Keputusan Bisnis Sebelum Implementasi)

| # | Pertanyaan | Rekomendasi awal |
|---|---|---|
| Q1 | Daftar jabatan kanonik yang final? (`Anggota, Pengurus, Ketua, Wakil Ketua, Sekretaris, Bendahara` — atau lebih rinci: Ketua Umum, Ketua Bidang, dst.?) | Mulai dari 6 nilai di §7.3 (selaras map badge existing); bukan tabel master. |
| Q2 | Apakah form Edit di Pengelolaan Data masih boleh mengubah posisi, atau wajib lewat menu baru? | Jadikan read-only di form Edit (satu sumber kebenaran). |
| Q3 | Apakah periode/masa jabatan (mis. "2025–2030") perlu terstruktur (tabel master periode) atau cukup teks? | Teks sederhana di record jabatan. |
| Q4 | Tanggal mulai jabatan boleh di masa depan (pengangkatan efektif nanti)? | Tidak — konsisten dengan pengakhiran (tidak boleh masa depan) atau toleransi terbatas. |
| Q5 | Workflow: jalur cepat admin saja (Workflow 1) atau formal PC → PP (Workflow 2)? | Workflow 2 + jalur cepat admin (§8.2). |
| Q6 | Siapa penentu final — PP via `dana_kematian.verify_pp` atau permission khusus? | Permission khusus `approve_perubahan_kepengurusan` bila ingin tegas; jika sederhana, pakai pola pengakhiran. |
| Q7 | Perlu "titik awal" histori untuk posisi existing (seed 1 record per pengurus saat ini)? | Ya, seed satu record `disetujui_pp` agar histori tidak kosong. |
| Q8 | Saat anggota meninggal/berhenti keanggotaan, jabatan aktif ditutup otomatis? | Ya (fase 2) — integrasi ke service kematian/pengakhiran. |
| Q9 | Upload SK wajib atau opsional untuk pengangkatan? | Wajib untuk `angkat`/`pindah` bila klien punya SK digital; opsional di MVP. |
| Q10 | Satu jabatan aktif per anggota, atau boleh merangkap? | Tunggal (§4.3). |

---

## 14. Usulan Fase Implementasi (setelah disetujui)

- **Fase 1 (MVP):** migration `anggota_kepengurusan` + konstanta jabatan kanonik; halaman 3 langkah
  (cari → form → tinjau); API create/list; workflow penuh (verifikasi PC → keputusan PP + sync);
  panel riwayat per anggota; menu + permission.
- **Fase 2:** read-only posisi di form Edit; seed histori awal; tutup jabatan otomatis saat
  meninggal/berhenti; normalisasi import/export; laporan susunan pengurus.
- **Fase 3 (opsional):** notifikasi, model multi-jabatan, master periode.

---

> **Status: AUDIT SELESAI — MENUNGGU PERSETUJUAN REKOMENDASI & BUSINESS RULES.**
> Belum ada perubahan kode. Implementasi dimulai setelah §13 (Q1–Q10) diputuskan klien.

---

## 15. Catatan Implementasi — FASE 1 (MVP)

> Keputusan: rekomendasi di atas **disetujui & diimplementasikan** dengan asumsi default §13:
> Q1 daftar jabatan `Anggota/Pengurus/Ketua/Wakil Ketua/Sekretaris/Bendahara`;
> Q3 periode teks bebas; Q4 tanggal mulai tidak boleh masa depan; Q5 workflow PC→PP + jalur cepat
> admin; Q6 pola permission `KEPENGURUSAN_MANAGE_PERMISSIONS` (seperti pengakhiran); Q10 jabatan
> tunggal. Fase 2/3 (§14) belum dikerjakan.

### File baru

| File | Peran |
|---|---|
| `supabase/migrations/033_create_anggota_kepengurusan.sql` | Tabel `anggota_kepengurusan` + enum jenis/status + constraint + index (partial unique) + RLS + trigger |
| `lib/anggota-kepengurusan.ts` | `POSISI_KEPENGURUSAN_OPTIONS` (kanonik) + `getPosisiKepengurusanProps` + helper |
| `lib/workflow/kepengurusan-status.ts` | Status config terpusat (label/badge/transisi) |
| `lib/server/kepengurusan-service.ts` | Guard (aktif/nomor SK), tutup jabatan lama, sync posisi idempotent, `applyKepengurusanApproval` + rollback |
| `lib/utils/kepengurusan-validation.ts` | Validasi form (client + server) |
| `lib/hooks/use-anggota-kepengurusan-api.ts` | Hook list/riwayat/create/update-status |
| `app/api/anggota-kepengurusan/route.ts` | `GET` daftar, `POST` pengajuan (+ jalur cepat admin) |
| `app/api/anggota-kepengurusan/[id]/route.ts` | `GET` detail, `PATCH` verifikasi/keputusan/batal |
| `app/api/anggota/[id]/kepengurusan/route.ts` | `GET` riwayat per anggota |
| `app/(protected)/keanggotaan/perubahan-kepengurusan/page.tsx` | Halaman 3 langkah + panel riwayat + tabel pengajuan & aksi keputusan |
| `lib/workflow/kepengurusan-status.test.ts`, `lib/utils/kepengurusan-validation.test.ts` | Unit test |

### File diubah

| File | Perubahan |
|---|---|
| `lib/supabase.ts` | Tipe `KepengurusanStatus`, `KepengurusanJenis`, `AnggotaKepengurusan(+WithAnggota)`, `CreateKepengurusanInput`, `UpdateKepengurusanStatusInput` |
| `lib/rbac.ts` | Permission `manage_perubahan_kepengurusan` + grup `KEPENGURUSAN_MANAGE/VIEW_PERMISSIONS` + `INITIAL_PERMISSIONS` |
| `prisma/data/permissions.js` | Seed permission baru |
| `config/menu.config.tsx` | Menu "Perubahan Kepengurusan" (setelah "Perubahan Data Pribadi") |
| `lib/supabase-storage.ts`, `app/api/upload/route.ts` | Folder bucket `anggota` → `sk-pengangkatan` |

### Perilaku kunci

- **Non-admin** → pengajuan `menunggu` (verifikasi PC → keputusan PP). Posisi anggota berubah hanya saat `disetujui_pp`.
- **Admin** → jalur cepat: langsung diterapkan (self-approved) + jejak audit; gagal apply → ditandai `ditolak`, HTTP 502.
- Saat `disetujui_pp`: jabatan aktif lama ditutup (`tanggal_selesai`), baris baru menjadi aktif,
  `anggota.posisi_kepengurusan` di-sync. Rollback otomatis bila langkah berikutnya gagal.
- `status_anggota` / `status_keanggotaan` / `kategori_anggota` **tidak** disentuh.

### Hasil validasi

- `npx tsc --noEmit` → bersih.
- `npm test` → **148/148 lulus** (termasuk 19 tes baru kepengurusan).

### Belum dikerjakan (Fase 2/3 — lihat §14)

- Form Edit Pengelolaan Data masih bisa mengubah posisi (Q2) → jadikan read-only.
- Seed histori awal jabatan pengurus existing (Q7); tutup jabatan otomatis saat meninggal/berhenti (Q8).
- Normalisasi import/export terhadap daftar jabatan kanonik; notifikasi; model multi-jabatan; master periode.


