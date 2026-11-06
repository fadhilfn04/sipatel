# Audit & Rekomendasi Desain — Perubahan Data Pribadi (Keanggotaan)

> Dokumen ini adalah hasil **audit/analisis tahap pertama** — **belum ada perubahan kode**.
> Tujuan: memetakan kondisi existing form Edit Anggota, lalu memberi rekomendasi desain menu
> **Perubahan Data Pribadi** (struktur halaman, matriks field, validasi, workflow, approval,
> audit trail, dan strategi reuse) agar tidak mengambil alih proses bisnis menu lain.
>
> Pola & gaya dokumen mengikuti `docs/pengakhiran-keanggotaan-audit.md` dan
> `docs/entry-meninggal-dunia-audit.md`.
> Tanggal audit: 6 November 2026.

---

## 1. Ringkasan Eksekutif

**Rekomendasi utama: Opsi B + C (hybrid)** — buat **halaman khusus** yang **menggunakan ulang
komponen & business logic existing** (`MemberForm`, `MemberSearchModal`, `PUT /api/anggota/[id]`,
`anggota_perubahan`, `anggota_history`), lalu **tambahkan enhancement** berupa:

1. **Matriks field** — hanya field data pribadi yang boleh diubah; field milik modul lain dikunci.
2. **Perbandingan data lama vs baru (diff)** sebelum submit dan pada layar persetujuan.
3. **Alasan perubahan wajib** + validasi terstruktur (zod) di client & server.
4. **Riwayat perubahan** (audit trail) yang menampilkan sebelum/sesudah, aktor, dan waktu.

**TIDAK direkomendasikan** memindahkan form Edit apa adanya (Opsi A): form existing memuat field
yang menjadi milik **Mutasi Cabang**, **Data Meninggal Dunia**, dan **Pengakhiran Keanggotaan**,
sehingga menu baru berisiko mengambil alih proses bisnis modul tersebut (persis yang dilarang
pada brief).

**Workflow:** **tidak perlu** membuat rantai approval PC/PP baru. Gunakan **mekanisme yang sudah
ada**: admin (`admin`/`administrator`/`owner`) → tersimpan langsung; non-admin → **usulan**
(`anggota_perubahan`, status `menunggu`) yang diputuskan admin. Tambahkan **diff + alasan wajib**
agar keputusan admin tidak "buta".

**Audit trail:** `anggota_history` (trigger) sudah ada dan menyimpan snapshot JSONB
sebelum/sesudah, **tetapi** `changed_by` bergantung pada `auth.uid()` yang **tidak terisi** untuk
request API aplikasi ini, dan `changed_fields` hanya mencakup **9 kolom**. Rekomendasi: jadikan
`anggota_perubahan` sebagai **log aktor/alasan** yang otoritatif, lengkapi tampilan riwayat, dan
(opsional, fase lanjutan) perbaiki trigger.

---

## 2. Cakupan Audit

| Area | File yang diperiksa |
|---|---|
| Skema anggota | `supabase/migrations/001_create_anggota_table.sql`, `014_add_anggota_enhancements.sql`, `023_clarify_anggota_status_fields.sql`, `032_create_pengakhiran_keanggotaan.sql` |
| Form edit anggota | `components/anggota/MemberForm.tsx` (1.061 baris), `components/anggota/MemberFormModal.tsx`, `components/anggota/MemberFormModalTabbed.tsx` (tidak terpakai) |
| Halaman pemanggil | `app/(protected)/keanggotaan/pengelolaan-data/page.tsx` |
| API anggota | `app/api/anggota/route.ts` (GET/POST), `app/api/anggota/[id]/route.ts` (GET/PUT/DELETE), `lib/server/anggota-service.ts` |
| Approval perubahan | `supabase/migrations/027_dakem_claim_config_anggota_approval.sql` (`anggota_perubahan`), `028_anggota_create_approval.sql`, `app/api/anggota/approvals/route.ts`, `app/api/anggota/approvals/[id]/route.ts`, `components/anggota/AnggotaApprovalsModal.tsx` |
| Audit trail | `supabase/migrations/003_create_anggota_history_table.sql`, `app/api/anggota/[id]/history/route.ts`, `lib/hooks/use-anggota-history.ts`, `components/anggota/HistoryTimeline.tsx`, `app/(protected)/keanggotaan/history-anggota/page.tsx` |
| RBAC & menu | `lib/rbac.ts`, `lib/rbac-server.ts`, `config/menu.config.tsx`, `prisma/data/permissions.js` |
| Pencarian anggota | `components/dana-kematian/MemberSearchModal.tsx`, `lib/hooks/use-anggota-api.ts` |
| Modul terkait (batas tanggung jawab) | `app/api/mutasi-cabang/*`, `app/(protected)/mutasi-cabang/page.tsx`, `app/api/anggota-kematian/*`, `app/api/pengakhiran-keanggotaan/*`, `app/(protected)/keanggotaan/pendaftaran-anggota-baru/page.tsx`, `docs/entry-meninggal-dunia-audit.md`, `docs/pengakhiran-keanggotaan-audit.md` |

---

## 3. Kondisi Existing

### 3.1 Alur Edit Anggota saat ini

```
Keanggotaan → Pengelolaan Data (app/(protected)/keanggotaan/pengelolaan-data/page.tsx)
  → tombol Edit (Pencil) → setEditMemberId(id)
  → useAnggota(id)                              // GET /api/anggota/[id]
  → MemberFormModal mode="edit"                 // dialog max-w-4xl
      → MemberForm (satu form besar, ±50 field, 10 seksi)
  → useUpdateAnggota(id)                        // PUT /api/anggota/[id]
      ├─ admin (admin|administrator|owner) → UPDATE langsung ke tabel anggota
      └─ non-admin                        → INSERT usulan anggota_perubahan (status 'menunggu')
  → AnggotaApprovalsModal (admin)               // GET/POST /api/anggota/approvals[/id]
  → trigger DB anggota_history                  // snapshot CREATE/UPDATE/DELETE
```

Semua state form berada di dalam `MemberForm` (satu `useState<CreateAnggotaInput>`), tidak ada
`react-hook-form`/`zod` di modul ini. `MemberFormModal` hanyalah wrapper dialog; halaman
**Pendaftaran Anggota Baru** memakai `MemberForm` yang sama (`mode="create"`), sehingga
komponen ini **sudah terbukti reusable**.

### 3.2 Inventaris field pada form Edit (`MemberForm.tsx`)

| Seksi (judul `h3`) | Field | Tipe UI | Wajib (HTML) | Catatan |
|---|---|---|---|---|
| Status & Kategori | `kategori_anggota` | select | ✅ (`required`) | biasa / luar_biasa / kehormatan |
| | `status_anggota` | select | ✅ | **termasuk `meninggal`** ← overlap Data Meninggal Dunia |
| | `status_mps` | select | ✅ | mps / non_mps |
| | `status_iuran` | select | ✅ | iuran / tidak_iuran |
| Informasi Pribadi | `nik` | input | ✅ | **selalu bisa diedit** di form saat ini |
| | `nama_anggota` | input | ✅ | |
| | `tempat_lahir`, `tanggal_lahir` | input / date | ❌ | |
| | `jenis_kelamin`, `agama`, `golongan_darah`, `status_perkawinan` | select | ❌ | |
| Informasi Organisasi | `nama_cabang` | input | ✅ | **overlap Mutasi Cabang** |
| | `kode_cabang` | input | ❌ | denormalisasi dari `master_cabang` |
| | `posisi_kepengurusan` | select | ✅ | nilai form hanya `anggota`/`pengurus`; tabel menampilkan `Ketua`/`Wakil Ketua`/dst → **mismatch** |
| | `sk_pensiun`, `nomor_sk_pensiun` | select / input | ❌ | |
| | `status_kepesertaan` | input (free text) | ❌ | sudah ditandai audit arsitektur sebagai "free text, no validation" |
| | `pasutri`, `cabang_kelas`, `cabang_area_regional`, `cabang_area_witel` | input | ❌ | cabang_* turunan `master_cabang` |
| Dokumen | `e_ktp`, `kartu_keluarga`, `npwp` | input (teks) | ❌ | **hanya nomor**, bukan upload dokumen |
| Kontak & Alamat | `alamat` | input | ✅ | |
| | `rt`, `rw`, `kode_pos` | input | ❌ | |
| | `provinsi`, `kota`, `kecamatan`, `kelurahan` | select cascading (`useWilayah`) | ❌ | |
| | `nomor_handphone`, `nomor_telepon` | input | ❌ | |
| | `email` | input (`type=email`) | ❌ | |
| | `sosial_media`, `kategori_datul`, `media_datul` | input | ❌ | |
| Data Keuangan | `besaran_iuran` | input number | ❌ | |
| | `form_kesediaan_iuran` | select bool | ❌ | |
| | `nama_bank`, `norek_bank` | input | ❌ | |
| Data BPJS | `status_bpjs`, `bpjs_kelas`, `bpjs_insentif` | select/input | ❌ | |
| Bantuan Sosial | `kategori_bantuan` | input (free text) | ❌ | ada `master_kategori_bantuan` (migration 022) tapi belum dipakai form |
| | `tanggal_terima_bantuan` | date | ❌ | |
| | `gambar_kondisi_tempat_tinggal` | `FileUpload` (bucket `anggota`, folder `gambar-kondisi-tempat-tinggal`) | ❌ | |
| Data Mutasi | `alasan_mutasi`, `tanggal_mutasi`, `cabang_pengajuan_mutasi`, `pusat_pengesahan_mutasi` | input/date | ❌ | **milik workflow Mutasi Cabang** |

**Temuan inventaris:**

- **Tidak ada** validasi client terstruktur (hanya atribut `required`/`type=email`); tidak ada
  regex NIK/handphone/norek, tidak ada cek tanggal, tidak ada zod/react-hook-form.
- Field `foto_anggota` dan `urutan_keluarga` **sudah ada di DB** (migration 014) tetapi **belum
  muncul** di `lib/supabase.ts` (`Anggota`) maupun di form → kandidat enhancement menu baru.
- `MemberFormModalTabbed.tsx` (980 baris) **tidak diimpor di mana pun** (dead code) — jangan
  dijadikan acuan; kandidat dihapus/diabaikan.
- Tidak ada logika `disabled` berbasis `mode === 'edit'` — semua field, termasuk `nik` dan
  `status_anggota='meninggal'`, bisa diubah dari Edit.


### 3.3 Backend: validasi, approval, penyimpanan

`PUT /api/anggota/[id]/route.ts`:

1. `requirePermission(MANAGE_KEANGGOTAAN)`.
2. Cek eksistensi (`deleted_at is null`).
3. Cek duplikasi NIK **hanya jika** `body.nik` terkirim.
4. **Non-admin** → `INSERT anggota_perubahan` (`jenis='edit'`, `status='menunggu'`,
   `data_sebelum = snapshot`, `data_usulan = body`, `alasan = body.alasan_perubahan`,
   `diajukan_oleh = user.id`) → `202`.
5. **Admin** → `buildAnggotaUpdatePayload(body)` (spread `...body` + normalisasi null +
   `updated_at`) → `UPDATE anggota` → `recordMutasiIfCabangChanged()` bila cabang berubah.

`POST /api/anggota/route.ts` (pembanding): validasi **hanya** 3 field (`nik`, `nama_anggota`,
`nama_cabang`), cek duplikasi NIK, lalu pola approval create yang sama.

`POST /api/anggota/approvals/[id]/route.ts` (admin-only): `setujui`/`tolak` dengan optimistic
lock (`status='menunggu'`); saat setujui edit, re-cek NIK lalu `buildAnggotaUpdatePayload`
diterapkan; saat setujui hapus → soft delete (guard transaksi Dakem aktif).

**Temuan penting (gap keamanan/integritas):**

1. **Guard field terproteksi hilang.** Dokumen `SIPATEL_PHASE1_5_VERIFICATION_REPORT.md` dan
   `business_rule_documentation` (migration 023) menyebut `nik`, `nama_anggota`,
   `kategori_anggota`, `status_anggota`, `status_mps`, `status_iuran` **tidak boleh diubah via
   API**. Namun kode `PUT` saat ini **tidak** mengimplementasikan guard itu — admin bisa mengubah
   NIK/nama/status langsung, dan usulan non-admin yang menyertakan field tersebut akan diterapkan
   saat disetujui. Guard ini harus dipulihkan (fase implementasi).
2. **Rule "Kategori Biasa → MPS" tidak ditegakkan** di `POST`/`PUT`/form saat ini (hanya default
   value di payload builder & batch-import). Aturan bisnis terdokumentasi tapi belum di-enforce.
3. **`alasan_perubahan` tidak pernah terkirim** oleh `MemberForm` (bukan bagian
   `CreateAnggotaInput`) → kolom `alasan` di usulan selalu `null`. Selain itu, jika field ini ikut
   terkirim, `buildAnggotaUpdatePayload` akan menyebarkannya ke payload UPDATE → PostgREST error
   (kolom tidak dikenal). Alasan harus menjadi field terpisah dan **wajib**.
4. Tidak ada validasi enum/format di server — nilai enum yang salah ditolak PostgREST secara
   implisit, tanpa pesan yang ramah.

### 3.4 Audit trail

- Tabel `anggota_history` (migration 003) + trigger `track_anggota_changes`
  (INSERT/UPDATE/DELETE) menyimpan `changed_data` (baru) & `previous_data` (lama) sebagai JSONB.
- `changed_fields` dihitung manual dan **hanya 9 kolom**: `nik`, `nama_anggota`, `kategori_anggota`,
  `status_anggota`, `nama_cabang`, `kode_cabang`, `alamat`, `nomor_handphone`, `email`.
- `changed_by` diisi `auth.uid()` — **tidak terisi** untuk request API aplikasi ini, karena
  autentikasi memakai **NextAuth (Prisma adapter)**, bukan Supabase Auth; client `supabase` memakai
  anon key tanpa user session. Selain itu tipe kolom `changed_by UUID REFERENCES auth.users(id)`
  berbeda domain dengan `Prisma User.id`. **Akibatnya aktor perubahan tidak tercatat di
  `anggota_history`**.
- Sudah ada: `GET /api/anggota/[id]/history` (butuh `HISTORY_ANGGOTA_VIEW`),
  `useAnggotaHistory`, `HistoryTimeline`, dan halaman `keanggotaan/history-anggota` — tetapi menu
  "History Anggota" di `config/menu.config.tsx` **masih di-comment** dan route history melakukan
  `from('users')` dengan kolom `full_name` (perlu diverifikasi terhadap skema Prisma `User`).
- Riwayat mutasi cabang terpisah di `anggota_mutasi` (append-only) via `recordMutasiIfCabangChanged`.

### 3.5 RBAC & menu

- `PERMISSIONS.MANAGE_KEANGGOTAAN` = gate untuk write (POST/PUT/DELETE/approvals).
- `isAdminActor()` (role slug `admin`/`administrator`/`owner`) = penentu "langsung vs usulan".
- `HISTORY_ANGGOTA_VIEW`/`HISTORY_ANGGOTA_MANAGE` sudah ada (menu history belum diaktifkan).
- Menu Keanggotaan saat ini: Pendaftaran Anggota Baru, Pengelolaan Data, Mutasi Cabang,
  Data Meninggal Dunia, Pengakhiran Keanggotaan.

### 3.6 Relasi database `anggota`

| Tabel | Relasi | Keterangan |
|---|---|---|
| `anggota_history` | `anggota_id` FK, ON DELETE CASCADE | audit trail (trigger) |
| `anggota_perubahan` | `anggota_id` FK (nullable sejak migration 028), CASCADE | usulan create/edit/hapus |
| `anggota_mutasi` | `anggota_id` FK, CASCADE | riwayat mutasi cabang (append-only) |
| `anggota_kematian` | `anggota_id` UNIQUE | fakta meninggal dunia |
| `pengakhiran_keanggotaan` | `anggota_id` | pengajuan berhenti |
| `nik_kepemilikan` | `source_anggota_id`, `heir_anggota_id` | pewarisan NIK |
| `dana_kematian` | `anggota_id` | pengajuan santunan |

`anggota` memakai **soft delete** (`deleted_at`); data historis dipertahankan.


---

## 4. Ringkasan Temuan (Gap Analysis)

| # | Temuan | Dampak | Severity |
|---|---|---|---|
| 1 | Form Edit memuat field milik modul lain (`nama_cabang`/`kode_cabang`, `status_anggota='meninggal'`, `alasan_mutasi` dkk.) | Proses bisnis Mutasi Cabang / Data Meninggal Dunia dapat "diambil alih" lewat edit biasa | **Tinggi** |
| 2 | Guard **field terproteksi** (NIK, nama, kategori, status, MPS, iuran) tidak ada di `PUT` saat ini | Perubahan identitas inti bisa lolos tanpa jalur yang semestinya (mis. NIK harus lewat pewarisan NIK) | **Tinggi** |
| 3 | Usulan perubahan tidak memiliki **diff** dan **alasan** tidak pernah terkirim; `AnggotaApprovalsModal` tidak menampilkan perubahan apa pun | Admin menyetujui "buta"; tidak ada jejak alasan | **Tinggi** |
| 4 | `anggota_history.changed_by` tidak terisi (auth.uid() + FK `auth.users`) | Tidak diketahui siapa yang mengubah data | **Tinggi** |
| 5 | `changed_fields` trigger hanya 9 kolom | Riwayat tidak akurat untuk field lain (mis. `norek_bank`, `email` sudah ada, `e_ktp` tidak) | Sedang |
| 6 | Tidak ada validasi terstruktur (format NIK/handphone/norek/email/tanggal) | Data kotor & error 500 dari PostgREST | Sedang |
| 7 | Rule **Kategori Biasa → MPS** tidak ditegakkan di API/form saat ini | Inkonsistensi aturan bisnis yang sudah didokumentasikan | Sedang |
| 8 | `foto_anggota` & `urutan_keluarga` ada di DB tapi tidak ada di tipe/form | Fitur tidak dapat dipakai dari UI | Rendah |
| 9 | `MemberFormModalTabbed.tsx` dead code | Beban maintenance, risiko salah acuan | Rendah |
| 10 | Menu "History Anggota" masih di-comment; route history memakai `from('users')`/`full_name` (perlu verifikasi) | Riwayat tidak dapat diakses pengguna | Sedang |

---

## 5. Pemisahan Tanggung Jawab dengan Menu Existing

| Data / Proses | Pemilik (modul) | Boleh diubah di **Perubahan Data Pribadi**? | Alasan |
|---|---|---|---|
| Tambah anggota baru | Pendaftaran Anggota Baru | ❌ | Menu tersebut sudah ada (reuse `MemberForm` mode create) |
| Perpindahan cabang (`kode_cabang`, `nama_cabang`, `cabang_*`) | **Mutasi Cabang** | ❌ (read-only) | Ada workflow pengajuan → verifikasi PC → keputusan PP + riwayat `anggota_mutasi` |
| `status_anggota = 'meninggal'`, tanggal/surat kematian | **Data Meninggal Dunia** | ❌ (read-only) | Fakta kematian tercatat di `anggota_kematian`; berpengaruh ke NIK inheritance & Dana Kematian |
| `status_keanggotaan` (`aktif`/`non_aktif`/`berhenti`) | **Pengakhiran Keanggotaan** | ❌ (read-only) | Perubahan status keanggotaan berdampak lintas modul (Dakem, Mutasi) |
| `nik` | Pewarisan NIK / Pengelolaan Data (admin) | ❌ (read-only) | UNIQUE + rantai kepemilikan `nik_kepemilikan`; koreksi NIK butuh jalur khusus |
| `kategori_anggota`, `status_mps`, `status_iuran` | Aturan bisnis inti | ❌ (default) | Field terproteksi (migration 023); kandidat admin-only (lihat §10) |
| Data pribadi (alamat, kontak, lahir, agama, dokumen nomor, bank, BPJS, datul) | **Perubahan Data Pribadi** (baru) | ✅ | Tidak mengubah status/hak keanggotaan |
| Hapus anggota (`deleted_at`) | Pengelolaan Data (admin) | ❌ | Bukan bagian "perubahan data" |

**Prinsip:** menu baru **tidak boleh** menjadi jalan pintas untuk proses yang sudah punya
workflow sendiri. Field milik modul lain ditampilkan **read-only** + tautan ke menu pemiliknya.

---

## 6. Evaluasi Opsi

### Opsi A — Pindahkan form Edit apa adanya ke menu baru

| Aspek | Penilaian |
|---|---|
| Kecepatan | ✅ Cepat (halaman baru + reuse `MemberFormModal`) |
| Risiko | ❌ Tinggi — 50 field tetap terbuka, termasuk cabang/status/mutasi; memindahkan masalah, bukan menyelesaikannya |
| Kesesuaian brief | ❌ Menabrak pemisahan tanggung jawab |
| **Kesimpulan** | **Tidak direkomendasikan** |

### Opsi B — Form khusus yang me-reuse komponen & business logic existing

| Aspek | Penilaian |
|---|---|
| Kecepatan | ⚠️ Sedang (perlu prop/metadata field + halaman baru) |
| Risiko | ⚠️ Rendah–sedang (perlu disiplin allowlist di client & server) |
| Reuse | ✅ `MemberForm` (komposisi seksi), `MemberSearchModal`, `useAnggota`, `useUpdateAnggota`, `PUT /api/anggota/[id]`, `anggota_perubahan` |
| **Kesimpulan** | **Direkomendasikan sebagai basis** |

### Opsi C — Enhancement (diff lama vs baru, riwayat, validasi tambahan)

| Aspek | Penilaian |
|---|---|
| Nilai bisnis | ✅ Tinggi — keputusan approval berbasis bukti, audit trail lengkap, data lebih bersih |
| Biaya | ⚠️ Sedang (komponen diff, schema validasi, tampilan riwayat) |
| Risiko | ⚠️ Perlu hati-hati agar tidak mengubah perilaku Edit existing |
| **Kesimpulan** | **Direkomendasikan, digabung dengan Opsi B** |

**Keputusan: B + C.** Bangun halaman khusus berbasis reuse, dengan enhancement diff + alasan +
validasi + riwayat. **Bukan** membuat form baru dari nol dan **bukan** memindahkan form lama.


---

## 7. Rekomendasi Desain

### 7.1 Struktur halaman & menu

- **Menu:** Keanggotaan → **"Perubahan Data Pribadi"**, diletakkan setelah "Pengelolaan Data",
  `permissions: [PERMISSIONS.MANAGE_KEANGGOTAAN]` (konsisten dengan menu tetangga).
- **Route:** `app/(protected)/keanggotaan/perubahan-data-pribadi/page.tsx`, dibungkus
  `<ProtectedRoute permission={PERMISSIONS.MANAGE_KEANGGOTAAN}>` (pola halaman Pendaftaran).
- **Alur 3 langkah** (stepper; mengikuti alur yang klien minta):

```
Langkah 1 — Cari Anggota
  · reuse pola MemberSearchModal (mode NIK exact-match + nama contains)
  · GET /api/anggota?search=... (sudah mendukung nik/nama/cabang ilike)
  · Catatan: "nomor anggota" ≡ NIK — tidak ada kolom no_anggota terpisah (lihat §10)

Langkah 2 — Informasi Anggota & Pilih Data
  · kartu identitas read-only (NIK, nama, cabang, badge status_anggota/status_keanggotaan/
    kategori) — reuse gaya Badge di Pengelolaan Data
  · field milik modul lain ditampilkan READ-ONLY + link ke menu pemilik
    (mis. "Perpindahan cabang diajukan lewat menu Mutasi Cabang")
  · form hanya berisi seksi yang boleh diubah (lihat §7.2); pengisian reuse input/select/
    cascading wilayah yang sudah ada di MemberForm

Langkah 3 — Periksa Perubahan & Simpan
  · tabel diff (field | nilai lama | nilai baru) — hanya field yang berubah
  · textarea "Alasan perubahan" WAJIB (min. 10 karakter)
  · submit → admin: tersimpan langsung; non-admin: status "menunggu persetujuan admin"
  · toast + Alert hasil (pola Pendaftaran Anggota Baru) + tautan ke daftar usulan
```

- **Tab kedua (opsional fase 1):** "Riwayat Perubahan" per anggota terpilih — menggabungkan
  `anggota_perubahan` (siapa/alasan/kapan) dan `anggota_history` (snapshot DB).

### 7.2 Matriks field — boleh vs tidak boleh diubah

**A. Boleh diubah (data pribadi):**

| Kelompok | Field |
|---|---|
| Diri pribadi | `tempat_lahir`, `tanggal_lahir`, `jenis_kelamin`, `agama`, `golongan_darah`, `status_perkawinan`, `pasutri` |
| Alamat | `alamat`, `rt`, `rw`, `provinsi`, `kota`, `kecamatan`, `kelurahan`, `kode_pos` |
| Kontak | `nomor_handphone`, `nomor_telepon`, `email`, `sosial_media` |
| Nomor dokumen | `e_ktp`, `kartu_keluarga`, `npwp`, `nomor_sk_pensiun`, `sk_pensiun` |
| Keuangan pribadi | `nama_bank`, `norek_bank` *(sensitif → selalu tampil di diff)* |
| BPJS & Datul | `status_bpjs`, `bpjs_kelas`, `bpjs_insentif`, `kategori_datul`, `media_datul` |
| Bantuan sosial | `kategori_bantuan`, `tanggal_terima_bantuan`, `gambar_kondisi_tempat_tinggal` |
| Foto (fase 2) | `foto_anggota` (kolom sudah ada; upload bucket `anggota/foto-anggota`) |

**B. Tidak boleh diubah (read-only, dengan alasan/pemilik):**

| Field | Alasan / Pemilik |
|---|---|
| `id`, `user_id`, `created_at`, `updated_at`, `deleted_at` | sistem |
| `nik` | terproteksi + rantai pewarisan NIK (`nik_master`/`nik_kepemilikan`) |
| `nama_anggota` | terproteksi per `business_rule_documentation` — opsi koreksi admin di §10 |
| `kategori_anggota`, `status_mps`, `status_iuran` | aturan bisnis inti (MPS/iuran) |
| `status_anggota` | peran keluarga; `meninggal` milik Data Meninggal Dunia; dipakai Dana Kematian |
| `status_keanggotaan` | milik Pengakhiran Keanggotaan |
| `kode_cabang`, `nama_cabang`, `cabang_kelas`, `cabang_area_regional`, `cabang_area_witel` | milik Mutasi Cabang (denormalisasi `master_cabang`) |
| `alasan_mutasi`, `tanggal_mutasi`, `cabang_pengajuan_mutasi`, `pusat_pengesahan_mutasi` | milik Mutasi Cabang |
| `posisi_kepengurusan` | data organisasi (admin-only via Pengelolaan Data) — lihat §10 |
| `status_kepesertaan` | free text, ditandai "should be derived" — tampil read-only |
| `besaran_iuran`, `form_kesediaan_iuran` | terkait Keuangan/iuran (bukan data pribadi) |

Server **wajib** meng-allowlist field yang boleh diubah (defense in depth) — lihat §7.7.


### 7.3 Validasi yang diperlukan

**Client + server** (defense in depth) — schema `zod` bersama (zod sudah terpasang di repo;
pola `react-hook-form`+`zod` sudah dipakai modul user-management):

| Field | Aturan |
|---|---|
| `alamat` | wajib bila seksi alamat diubah; min 5 karakter |
| `nomor_handphone` | `^(\+62|62|0)8[0-9]{8,12}$` (opsional) |
| `nomor_telepon` | `^0[0-9]{7,12}$` (opsional) |
| `email` | format email (`z.string().email()`) |
| `e_ktp` / `kartu_keluarga` | 16 digit numerik |
| `npwp` | 15 digit (atau format `xx.xxx.xxx.x-xxx.xxx`) |
| `norek_bank` | 8–16 digit numerik |
| `kode_pos` | 5 digit numerik |
| `rt` / `rw` | max 3 digit numerik |
| `tanggal_lahir` | bukan di masa depan; rentang wajar (mis. antara 1900 dan hari ini) |
| `tanggal_terima_bantuan` | ≤ hari ini |
| `besaran_iuran` | ≥ 0 (bila kelak dibuka) |
| `alasan_perubahan` | **wajib**, min 10 karakter |
| enum (`jenis_kelamin`, `agama`, `golongan_darah`, `status_perkawinan`, dll.) | harus masuk nilai enum yang valid (zod `enum`) |
| file upload | reuse whitelist `FileUpload`/`app/api/upload` (bucket `anggota`) |

**Server** (fase implementasi): validasi ulang payload, tolak/strip field di luar allowlist,
dan beri pesan error spesifik (bukan 500 PostgREST).

### 7.4 Workflow perubahan data

```
Petugas (PC/cabang, MANAGE_KEANGGOTAAN)
  → cari anggota → isi perubahan → isi alasan (wajib) → submit
      │
      ├─ role admin (admin|administrator|owner):
      │     UPDATE anggota langsung (via buildAnggotaUpdatePayload)
      │     + insert jejak anggota_perubahan(status='disetujui', self-approve)  [fase 2]
      │
      └─ non-admin:
            INSERT anggota_perubahan (jenis='edit', status='menunggu',
              data_sebelum (snapshot field yg relevan), data_usulan (field yg berubah), alasan)
            → 202 "menunggu persetujuan admin"
      │
Admin (approver)
  → buka daftar usulan (enhanced AnggotaApprovalsModal + DIFF)
  → setujui → apply data_usulan (re-check validasi & duplikasi) → data berubah
  → tolak  → data utama TIDAK berubah; alasan_keputusan wajib
```

**Keputusan:** perubahan data pribadi **tidak memerlukan rantai approval PC/PP baru** karena
bukan perubahan status keanggotaan (bandingkan dengan Mutasi/Pengakhiran yang mengubah hak/status).
Gunakan mekanisme `anggota_perubahan` yang sudah ada dan konsisten dengan Edit/Pendaftaran.


### 7.5 Kebutuhan approval

- **Default:** ikuti pola existing — admin langsung, non-admin usulan (1 level, admin).
- **Rekomendasi fase lanjut:** field **sensitif** (`norek_bank`, `nama_bank`, `e_ktp`,
  `tanggal_lahir`, `jenis_kelamin`, `status_perkawinan`) **wajib approval untuk semua peran**
  (termasuk admin), dengan flag `sensitive_fields` di schema. Ini mencegah perubahan data
  pembayaran/identitas tanpa jejak persetujuan.
- **Tidak** menambah workflow PC/PP baru (hindari duplikasi infrastruktur approval).

### 7.6 Mekanisme audit trail

| Lapisan | Tanggung jawab | Status |
|---|---|---|
| `anggota_history` (trigger) | snapshot `previous_data`/`changed_data` (JSONB) per baris | ✅ ada (tapi `changed_fields` parsial, `changed_by` kosong) |
| `anggota_perubahan` | **aktor, alasan, waktu** pengajuan & keputusan | ✅ ada (jadikan otoritatif untuk "siapa/kenapa/kapan") |
| `anggota_mutasi` | riwayat perpindahan cabang | ✅ ada (tidak disentuh) |
| Tampilan riwayat | merge `anggota_perubahan` + `anggota_history` + `HistoryTimeline` | ⚠️ perlu dirapikan (route `from('users')` + permission) |

Rekomendasi konkret:

1. **Fase 1** — tampilkan diff di layar submit & di daftar approval (dari `data_sebelum` vs
   `data_usulan`), tanpa migrasi DB.
2. **Fase 2** — saat admin mengedit langsung, **selalu tulis baris `anggota_perubahan`**
   (`status='disetujui'`, `diajukan_oleh`=`diputuskan_oleh`=admin, `alasan`). Ini membuat riwayat
   "siapa/kenapa/kapan" seragam untuk kedua jalur (tanpa bergantung `auth.uid()`).
3. **Fase 3 (opsional)** — perbaiki trigger: hitung `changed_fields` dinamis dari JSONB (semua
   kolom, kecuali `updated_at`), dan pertimbangkan kolom aktor berdomain `User.id` (migrasi
   additive) atau set `current_setting('app.actor_id')` via `supabaseAdmin.rpc()`.

### 7.7 Strategi reuse komponen & business logic

| Kebutuhan | Reuse (file) | Sifat |
|---|---|---|
| Form data pribadi (subset seksi) | `components/anggota/PerubahanDataPribadiForm.tsx` (baru — `MemberForm` sengaja tidak diubah agar Edit/Pendaftaran existing tidak berisiko regresi; reuse `useWilayah`, `Input`/`Select`/`FileUpload`) | **Baru (implementasi)** |
| Modal wrapper (jika tetap pakai dialog) | `components/anggota/MemberFormModal.tsx` | Reuse/opsional |
| Cari anggota (NIK/nama) | `components/dana-kematian/MemberSearchModal.tsx` → pindahkan ke `components/anggota/` agar bisa dipakai lintas modul | **Ekstrak/reuse** |
| Fetch detail & update | `lib/hooks/use-anggota-api.ts` (`useAnggota`, `useUpdateAnggota`) | Reuse |
| Ringkasan anggota (read-only) | `components/anggota/DetailModal.tsx` (atau kartu ringkas baru) | Reuse/adaptasi |
| API update | `app/api/anggota/[id]/route.ts` (`PUT`) + `lib/server/anggota-service.ts` (`buildAnggotaUpdatePayload`, `isAdminActor`) | **Modifikasi** (tambah allowlist + sanitasi) |
| Approval | `app/api/anggota/approvals/*`, `components/anggota/AnggotaApprovalsModal.tsx` | **Modifikasi** (tambah diff + alasan wajib) |
| Audit/riwayat | `components/anggota/HistoryTimeline.tsx`, `lib/hooks/use-anggota-history.ts`, `app/api/anggota/[id]/history/route.ts` | **Modifikasi** (merge + perbaiki aktor) |
| Validasi | schema `zod` baru di `lib/server/anggota-perubahan-schema.ts` (+ test `lib/server/*.test.ts`, tercakup glob test) | **Baru** |
| Diff helper | `computeFieldDiff(before, after)` di `lib/server/anggota-service.ts` | **Baru** |
| Guard field terproteksi | `PROTECTED_FIELDS` / `PERSONAL_DATA_EDITABLE_FIELDS` di `lib/server/anggota-service.ts` | **Baru** (pulihkan gap §4) |
| Halaman | `app/(protected)/keanggotaan/perubahan-data-pribadi/page.tsx` (pola Pendaftaran + toolbar/Container/Card/Alert/Toast) | **Baru** |
| Menu | `config/menu.config.tsx` | **Modifikasi** |


---

## 8. Rencana Implementasi (setelah persetujuan)

### Fase 1 — MVP (tanpa migrasi DB)

| # | Pekerjaan | File |
|---|---|---|
| 1 | Menu "Perubahan Data Pribadi" | `config/menu.config.tsx` |
| 2 | Halaman 3 langkah (cari → pilih/ubah → konfirmasi) | `app/(protected)/keanggotaan/perubahan-data-pribadi/page.tsx` (baru) |
| 3 | Ekstrak pencarian anggota agar reusable | `components/anggota/MemberSearchModal.tsx` (dipindah dari `dana-kematian/`) |
| 4 | Props allowlist/locked pada form | `components/anggota/MemberForm.tsx` |
| 5 | Komponen diff | `components/anggota/FieldDiffTable.tsx` (baru) |
| 6 | Schema validasi zod + test | `lib/server/anggota-perubahan-schema.ts` (baru) + `lib/server/*.test.ts` |
| 7 | Allowlist + sanitasi payload + diff helper | `lib/server/anggota-service.ts` |
| 8 | Terapkan allowlist & alasan wajib di API | `app/api/anggota/[id]/route.ts` |
| 9 | Diff + alasan wajib di layar approval | `components/anggota/AnggotaApprovalsModal.tsx` |

### Fase 2 — Enhancement

- Riwayat perubahan per anggota (merge `anggota_perubahan` + `anggota_history`) pada halaman baru.
- Jejak `anggota_perubahan` untuk edit langsung admin (self-approved) + notifikasi ke pengaju
  (reuse `lib/server/create-notification.ts` & tabel `notifications`).
- `foto_anggota` upload + `urutan_keluarga` (tambahkan ke tipe `Anggota` & form).
- Approval paksa untuk field sensitif (§7.5).
- Perbaiki `GET /api/anggota/[id]/history` (`from('users')` vs skema Prisma `User`, izin akses).

### Fase 3 — Opsional (teknis)

- Migrasi additive: `anggota_perubahan.sumber` (`pengelolaan_data`|`perubahan_data_pribadi`),
  `field_changes JSONB`.
- Trigger `changed_fields` dinamis + kolom aktor berdomain `User.id`.
- Pulihkan & tegakkan rule "Kategori Biasa → MPS" di form + API.
- Hapus/arsipkan `MemberFormModalTabbed.tsx` (dead code).

---

## 9. Dampak & Risiko

| Risiko | Severity | Mitigasi |
|---|---|---|
| Field milik modul lain tetap bisa diubah lewat `PUT` (jalur lama) | Tinggi | Terapkan allowlist **di server**, bukan hanya UI; audit ulang Edit existing |
| Usulan non-admin menyertakan field terproteksi | Tinggi | Validasi ulang saat `apply` usulan (`approvals/[id]`) |
| Approval tanpa diff → salah setujui | Sedang | Diff di modal approval (Fase 1) |
| Aktor tidak tercatat | Sedang | `anggota_perubahan` sebagai sumber aktor; Fase 3 perbaiki trigger |
| Duplikasi logika form vs halaman baru | Sedang | Satu komponen `MemberForm` dengan props; hindari fork |
| NIK dikoreksi tanpa jalur pewarisan | Sedang | NIK read-only; koreksi NIK lewat jalur admin/inheritance (keputusan §10) |
| Perubahan field sensitif tanpa persetujuan | Sedang | Fase 2: approval paksa untuk field sensitif |
| Regresi pada Edit/Pendaftaran existing | Sedang | Props opsional dengan default perilaku lama + test manual kedua halaman |

---

## 10. Pertanyaan Terbuka (butuh keputusan klien/PO)

1. **"Nomor anggota"** — apakah yang dimaksud adalah **NIK**? Tabel `anggota` tidak memiliki
   kolom nomor anggota terpisah. Bila perlu nomor keanggotaan tersendiri → butuh kolom baru.
2. **`nama_anggota`** — tetap terproteksi (koreksi hanya lewat admin di Pengelolaan Data) atau
   dibuka dengan approval + diff?
3. **`kategori_anggota` / `status_mps` / `status_iuran`** — tetap terproteksi atau dibuka khusus
   admin dengan audit?
4. **Field sensitif** (`norek_bank`, `e_ktp`, `tanggal_lahir`, dll.) — wajib approval untuk semua
   peran, termasuk admin?
5. **Approval multi-level** — cukup 1 level (admin) seperti existing, atau perlu PC → PP?
   (rekomendasi: cukup admin)
6. **Foto anggota & urutan keluarga** — dimasukkan ke menu ini pada fase 1 atau fase 2?
7. **Edit lama di Pengelolaan Data** — dipertahankan apa adanya, atau dibatasi (field milik modul
   lain dikunci sehingga hanya menu baru yang boleh mengubah data pribadi)?
8. **Akses riwayat perubahan** — hanya admin, atau juga petugas cabang (pengaju)?

---

## 11. Acceptance Criteria (usulan)

- Petugas dapat mencari anggota via NIK atau nama, melihat ringkasan, mengubah hanya field yang
  diizinkan, melihat diff, mengisi alasan, dan menyimpan.
- Admin → data langsung berubah; non-admin → usulan `menunggu` dan data utama tidak berubah.
- Field terlarang **tidak dapat** diubah baik dari UI maupun dengan memanggil API langsung
  (dibuktikan via test/curl).
- Setiap perubahan tercatat: sebelum/sesudah, aktor, alasan, waktu — dapat dilihat di riwayat.
- Menu Mutasi Cabang, Data Meninggal Dunia, Pengakhiran Keanggotaan, dan Pendaftaran Anggota Baru
  tetap berfungsi dan tidak tumpang tindih.
- Tidak ada regresi pada Edit/Pendaftaran existing (`npm run lint`, `npm test`, uji manual).

---

## 12. Referensi File Kunci

| Kategori | File |
|---|---|
| Form | `components/anggota/MemberForm.tsx`, `components/anggota/MemberFormModal.tsx` |
| Halaman | `app/(protected)/keanggotaan/pengelolaan-data/page.tsx`, `app/(protected)/keanggotaan/pendaftaran-anggota-baru/page.tsx` |
| API | `app/api/anggota/route.ts`, `app/api/anggota/[id]/route.ts`, `app/api/anggota/approvals/route.ts`, `app/api/anggota/approvals/[id]/route.ts`, `app/api/anggota/[id]/history/route.ts` |
| Service | `lib/server/anggota-service.ts` |
| Hooks | `lib/hooks/use-anggota-api.ts`, `lib/hooks/use-anggota-history.ts` |
| Komponen | `components/anggota/AnggotaApprovalsModal.tsx`, `components/anggota/HistoryTimeline.tsx`, `components/anggota/DetailModal.tsx`, `components/dana-kematian/MemberSearchModal.tsx` |
| RBAC/Menu | `lib/rbac.ts`, `lib/rbac-server.ts`, `config/menu.config.tsx` |
| DB | `supabase/migrations/001`, `003` (`anggota_history`), `014`, `023`, `027` (`anggota_perubahan`), `028`, `032` |
| Audit terdahulu | `docs/pengakhiran-keanggotaan-audit.md`, `docs/entry-meninggal-dunia-audit.md`, `SIPATEL_ARCHITECTURAL_AUDIT.md`, `ANGGOTA_AUDIT_SUMMARY.md` |

---

> **Status:** Rekomendasi telah disetujui — **Fase 1 (MVP) diimplementasikan** (lihat §13).
> Fase 2/3 menunggu keputusan lanjutan.


---

## 13. Catatan Implementasi (Fase 1 — selesai)

> Status dokumen: rekomendasi disetujui → Fase 1 (MVP) telah diimplementasikan.

### File baru

| File | Peran |
|---|---|
| `lib/anggota-perubahan.ts` | Allowlist (`PERSONAL_DATA_EDITABLE_FIELDS`), `PROTECTED_FIELDS`, label, schema zod, `safeParsePerubahanDataPribadi`, `computeFieldDiff`, `buildAnggotaPartialUpdatePayload` |
| `lib/anggota-perubahan.test.ts` | 10 unit test (allowlist, validasi, diff, payload builder) |
| `app/api/anggota/[id]/perubahan-data/route.ts` | `POST` — validasi allowlist + alasan wajib; non-admin → usulan, admin → simpan + jejak audit self-approved |
| `components/anggota/MemberSearchModal.tsx` | Pencarian anggota reusable (dipindah dari `dana-kematian/`) |
| `components/anggota/PerubahanDataPribadiForm.tsx` | Form field data pribadi (reuse `useWilayah`, `Input`/`Select`/`FileUpload`) |
| `components/anggota/FieldDiffTable.tsx` | Tabel perbandingan nilai lama vs baru |
| `app/(protected)/keanggotaan/perubahan-data-pribadi/page.tsx` | Halaman 3 langkah (cari → ubah → tinjau & simpan) |

### File diubah

| File | Perubahan |
|---|---|
| `config/menu.config.tsx` | Tambah menu "Perubahan Data Pribadi" (setelah Pengelolaan Data) |
| `lib/hooks/use-anggota-api.ts` | Tambah hook `usePerubahanDataPribadi(id)` |
| `app/api/anggota/approvals/[id]/route.ts` | Apply usulan edit memakai `buildAnggotaPartialUpdatePayload` (partial-safe) |
| `app/api/anggota/route.ts` | Guard `GET` juga mengizinkan `MANAGE_KEANGGOTAAN` (untuk pencarian anggota) |
| `components/anggota/AnggotaApprovalsModal.tsx` | Tampilkan diff data lama → baru pada tiap usulan |
| `components/anggota/index.ts` | Export komponen baru |
| `components/dana-kematian/MemberSearchModal.tsx` | Menjadi re-export dari `components/anggota/` |
| `package.json` | Test glob tambah `lib/*.test.ts` |
| `docs/perubahan-data-pribadi-audit.md` | §7.7 disesuaikan dengan implementasi aktual + catatan ini |

### Deviasi dari rekomendasi awal (dan alasannya)

1. **Endpoint khusus** `POST /api/anggota/[id]/perubahan-data` menggantikan usulan "modifikasi
   `PUT /api/anggota/[id]`". Ini mengisolasi enforce allowlist pada menu baru tanpa merusak
   perilaku Edit lama di Pengelolaan Data (yang masih mengirim seluruh field).
2. **Komponen form baru** (`PerubahanDataPribadiForm`) menggantikan "modifikasi `MemberForm`".
   Menghindari risiko regresi pada Edit/Pendaftaran existing; reuse tetap lewat `useWilayah` dan
   primitif UI.
3. Apply approval memakai payload builder partial-safe sehingga usulan parsial (hanya field yang
   berubah) tidak men-null-kan field lain saat disetujui.

### Hasil validasi

- `npx tsc --noEmit` → bersih (tanpa error).
- `npm test` → **129/129 lulus** (termasuk 10 test baru).
- `npm run build` → **Compiled successfully**; route `/keanggotaan/perubahan-data-pribadi` terdaftar.
- Prettier diformat. Catatan: `eslint` gagal bootstrap di environment ini
  (`Cannot set properties of undefined (setting 'defaultMeta')` — error tooling ajv/eslintrc,
  terjadi sebelum file diproses, tidak terkait perubahan).

### Belum dikerjakan (Fase 2/3 — lihat §8)

- Riwayat perubahan gabungan (`anggota_perubahan` + `anggota_history`) di halaman baru.
- Notifikasi ke pengaju saat usulan diputuskan.
- `foto_anggota` & `urutan_keluarga` di tipe/form.
- Approval paksa untuk field sensitif (§7.5).
- Perbaikan trigger `changed_fields` dinamis + aktor (`auth.uid()`).
- Pulihkan rule "Kategori Biasa → MPS" di form + API.
- Hapus/arsipkan `MemberFormModalTabbed.tsx` (dead code).

---

> **Status: FASE 1 (MVP) TELAH DIIMPLEMENTASIKAN.** Fase 2/3 menunggu keputusan lanjutan.

