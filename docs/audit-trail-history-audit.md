# Audit Menyeluruh — Data History / Audit Trail SIPATEL

> **Status: AUDIT ONLY — tidak ada perubahan kode/schema/migrasi yang dilakukan.**
> Tanggal audit: 8 November 2026.
> Basis audit: pembacaan langsung kode & struktur project (migrasi SQL, API routes, services, trigger DB, UI pages) — bukan asumsi.
> Terkait: `SIPATEL_ARCHITECTURAL_AUDIT.md`, `docs/PROPOSAL_KEPUTUSAN_BISNIS_SIPATEL.md`, `docs/*-audit.md`.

---

## Daftar Isi

1. [Kondisi Existing Mekanisme History](#1-kondisi-existing-mekanisme-history)
2. [Peta Modul: Punya / Belum Punya History](#2-peta-modul-punya--belum-punya-history)
3. [Gap Analysis Pencatatan Perubahan Data](#3-gap-analysis-pencatatan-perubahan-data)
4. [Potensi Perubahan Data Tanpa Tercatat](#4-potensi-perubahan-data-tanpa-tercatat)
5. [Rekomendasi Arsitektur Audit Trail](#5-rekomendasi-arsitektur-audit-trail)
6. [Rekomendasi Struktur Database](#6-rekomendasi-struktur-database)
7. [Rekomendasi Tampilan & Hak Akses](#7-rekomendasi-tampilan--hak-akses)
8. [Strategi Implementasi Bertahap](#8-strategi-implementasi-bertahap)

## 1. Kondisi Existing Mekanisme History

SIPATEL **tidak memiliki satu mekanisme audit yang terpusat**. Saat ini ada **9 mekanisme history yang terfragmentasi**, dengan desain, kualitas, dan cakupan berbeda.

### 1.1 `anggota_history` — trigger-based audit untuk tabel `anggota`

- **Sumber**: `supabase/migrations/003_create_anggota_history_table.sql` (trigger `track_anggota_changes` pada INSERT/UPDATE/DELETE `anggota`).
- **Tercatat**: `anggota_id`, `action` (CREATE/UPDATE/DELETE), `changed_data` (JSONB full row SETELAH), `previous_data` (JSONB full row SEBELUM), `changed_fields` (TEXT[]), `created_at`.
- **Kualitas**: satu-satunya tabel audit yang menyimpan **snapshot penuh before/after otomatis** — fondasi yang baik.
- **Masalah terverifikasi**:
  1. `changed_by` diisi `auth.uid()` (Supabase Auth) — aplikasi memakai **NextAuth/Prisma** dan menulis via anon-key/service-role client, sehingga **`changed_by` selalu NULL** (dikonfirmasi `docs/PROPOSAL_KEPUTUSAN_BISNIS_SIPATEL.md` §D.2 dan `docs/penggantian-rekening-audit.md` §3.5). Tidak diketahui SIAPA yang mengubah.
  2. `changed_fields` hanya mendeteksi **9 kolom hard-coded** (`nik`, `nama_anggota`, `kategori_anggota`, `status_anggota`, `nama_cabang`, `kode_cabang`, `alamat`, `nomor_handphone`, `email`). Kolom `status_keanggotaan`, `status_mps`, `status_iuran`, `posisi_kepengurusan`, `nama_bank`, `norek_bank`, `besaran_iuran`, dll. **tidak pernah masuk daftar field berubah** (snapshot JSON tetap ada, tapi diff per-field tidak andal).
  3. `changed_by` bertipe UUID FK ke `auth.users`, padahal aktor aplikasi adalah `public."User".id` (Prisma) — **mismatch skema**.
  4. FK `ON DELETE CASCADE` → bila anggota di-hard-delete lewat SQL, **history ikut hilang** (mitigasi: app memakai soft delete).
  5. Tidak ada **modul asal**, **role aktor**, **alasan**, **IP**.

### 1.2 `audit_dana_kematian` + `riwayat_proses_dakem` — audit & riwayat workflow Dana Kematian

- **Sumber**: migrasi `006`, `009`–`012`, `023`, `027`; trigger `audit_dana_kematian_changes` dan `log_dana_kematian_transition` di `dana_kematian`.
- **Tercatat**: `riwayat_proses_dakem` menyimpan tiap transisi `status_proses` (status_dari→status_ke) + `actor_id/role/nama/cabang` + `catatan`; `audit_dana_kematian` menyimpan INSERT/DELETE penuh dan UPDATE (hanya bila `status_proses`/`besaran_dana_kematian`/`nama_ahli_waris` berubah) dengan `old_data`/`new_data` JSONB.
- **Aktor** diambil dari `dana_kematian.data_perubahan` yang diisi API dari session (`app/api/dana-kematian/[id]/route.ts:337-345`) — pola ini lebih baik dari `auth.uid()`, tetapi: fallback `'system'` menutupi aktor nyata; UPDATE field lain di luar 3 field tsb **tidak menghasilkan baris audit**; `actor_role` hanya `pusat/cabang`.

### 1.3 `dana_kematian_config_history` — riwayat konfigurasi Dakem

- **Sumber**: migrasi `027`; `lib/server/dakem-config.ts` (`updateDakemConfig`) INSERT `old_value`+`new_value`+`updated_by`+`catatan`. Kualitas baik (old/new + aktor + alasan), cakupan hanya konfigurasi Dakem.

### 1.4 `anggota_perubahan` — approval perubahan data anggota (OLD/NEW VALUES)

- **Sumber**: migrasi `027`/`028`/`035`; dipakai route POST/PUT/DELETE anggota, `approvals/[id]`, `[id]/perubahan-data`, `[id]/penggantian-rekening`.
- **Tercatat**: `jenis` (create/edit/hapus/rekening), `data_sebelum`, `data_usulan`, `alasan`, `diajukan_oleh/pada`, `status`, `diputuskan_oleh/pada`, `alasan_keputusan`.
- **Kualitas**: satu-satunya tempat **old/new value + aktor + alasan lengkap & otoritatif** untuk perubahan anggota. Batasan: hanya jalur non-admin; baris di-update saat keputusan (bukan log transisi); **tidak ada API/UI untuk melihat riwayat `anggota_perubahan` yang sudah diputuskan**.

### 1.5 Tabel histori domain append-only (mutasi, rekening, kepengurusan, pengakhiran, pengajuan mutasi)

- `anggota_mutasi` (mig. 027) — riwayat mutasi antar cabang (asal/tujuan, tanggal efektif, `diajukan_oleh`, `disetujui_oleh`, `alasan`), ditulis `recordMutasiIfCabangChanged()` (`lib/server/anggota-service.ts`) — **best-effort**, gagal insert hanya `console.error` (bukan satu transaksi dengan perubahan data utama).
- `anggota_rekening` (mig. 035) — histori penggantian rekening **lama → baru** + alasan + pengaju/penyetuju. Ditulis `applyPenggantianRekening()` — **3 operasi Supabase terpisah tanpa transaksi** (history bisa gagal tanpa rollback data utama). `norek_bank` **plaintext**.
- `anggota_kepengurusan` (mig. 033) — riwayat jabatan append-only + `jabatan_sebelumnya` + workflow verifikasi/keputusan + nomor/tanggal/file SK.
- `pengakhiran_keanggotaan` (mig. 032) — pengajuan + snapshot identitas + workflow; sinkronisasi `anggota.status_keanggotaan='berhenti'` via UPDATE (terekam `anggota_history`, minus aktor).
- `pengajuan_mutasi_cabang` (mig. 029/030) — pengajuan self-service + snapshot + workflow.
- **Inkonsistensi terverifikasi**: `diverifikasi_oleh`/`diputuskan_oleh` pada mutasi & kepengurusan diisi **`actorName(user)` = nama/email, bukan user id** (`app/api/mutasi-cabang/[id]/route.ts:132,138`; `app/api/anggota-kepengurusan/route.ts:342`), sedangkan pengakhiran/rekening/perubahan-data memakai `user.id`.

### 1.6 `anggota_kematian` (Entry Meninggal Dunia)

- **Sumber**: migrasi `031`; `app/api/anggota-kematian/route.ts` mengisi `dicatat_oleh: user.id`, `dicatat_pada`.
- **Gap**: hanya kolom "dibuat oleh" — **update/koreksi/penghapusan tidak meninggalkan history** (hanya `updated_at`/`deleted_at`).

### 1.7 `batch_operation_log` — log operasi massal (TIDAK DIPAKAI)

- **Sumber**: migrasi `025` — tabel, enum, helper function (`log_batch_operation`, `update_batch_operation_status`), view, RLS policy lengkap.
- **Fakta**: **tidak ada satu pun route API yang menulis ke tabel ini.** `app/api/anggota/batch-import/route.ts` langsung `upsert`, `app/api/anggota/bulk-delete/route.ts` langsung `update deleted_at` — keduanya **tanpa log operasi massal**.

### 1.8 `SystemLog` (Prisma) — log aktivitas modul user-management saja

- **Sumber**: `prisma/schema.prisma` (model `SystemLog`), `services/system-log.ts` (`systemLog()` mendukung optional Prisma transaction dan **menelan error** agar operasi utama tidak gagal).
- **Pemakaian**: **hanya** di `app/api/user-management/**` (users, roles, permissions, settings, account) — 15 titik. Field: `userId`, `entityId`, `entityType`, `event`, `description`, `ipAddress`, `meta`.
- **Gap**: tanpa **old/new values** (`meta` praktis tak dipakai), tanpa **module**, tanpa **role aktor**, dan **tidak ada API/UI pembaca** (halaman `account/activity` adalah demo Metronic yang tidak membaca `SystemLog`).

### 1.9 Kolom `created_by`/`updated_by` di tabel master (KOSONG)

- **Sumber**: migrasi `021` (master_cabang, nik_kepemilikan, master_bank), `022` (master_kategori_bantuan), `024` (master_regional, master_witel) + trigger `update_audit_updated_by()` membaca `current_setting('request.user.id')`.
- **Fakta**: **tidak ada route API yang mengisi kolom ini**, dan `request.user.id` tidak pernah di-set (client Supabase JS tidak dapat `SET LOCAL` per-request). Semua kolom audit ini **selalu NULL**. `master_tarif_dana_kematian` bahkan **tidak punya kolom audit**.

### 1.10 UI History yang ada hari ini

- `app/(protected)/keanggotaan/history-anggota/page.tsx` — halaman **DEMO**: `demoAnggotaId = 'demo-anggota-id'` hardcoded, pencarian NIK/nama dan tombol Filter **tidak berfungsi**. Dilindungi `PERMISSIONS.HISTORY_ANGGOTA_VIEW`.
- `GET /api/anggota/[id]/history` — API berfungsi (paginasi + enrich user) tetapi join ke tabel `users` yang **tidak ada** (aktor sebenarnya di `"User"`/`auth.users`) sehingga `changed_by_user` selalu null.
- `components/anggota/HistoryTimeline.tsx` — komponen timeline siap pakai dengan diff field.
- Konfigurasi Dakem mengekspos `history` via `GET /api/dana-kematian/config`.
- **Tidak ada halaman "Riwayat Aktivitas / Audit Trail" global.**

## 2. Peta Modul: Punya / Belum Punya History

Legenda: ✅ ada & layak · 🟡 parsial · ❌ tidak ada.

### 2.1 Modul Keanggotaan

| Modul / Menu | Tabel utama | Mekanisme history saat ini | Status |
|---|---|---|---|
| Pengelolaan Data Anggota (CRUD) | `anggota` | `anggota_history` (trigger, snapshot penuh) | 🟡 snapshot ya, **aktor NULL**, `changed_fields` 9 kolom |
| Pendaftaran Anggota Baru | `anggota` + `anggota_perubahan(jenis=create)` | Usulan non-admin lengkap; **admin create langsung** → hanya `anggota_history` minus aktor | 🟡 |
| Perubahan Data Pribadi | `anggota_perubahan(jenis=edit)` | `data_sebelum`/`data_usulan`/alasan/pengaju/penyetuju | ✅ (jalur admin langsung tetap 🟡) |
| Mutasi Cabang | `pengajuan_mutasi_cabang`, `anggota_mutasi` | Snapshot + workflow + riwayat append-only | 🟡 pelaku verifikasi/keputusan = **nama**, bukan ID |
| Data Meninggal Dunia (entry) | `anggota_kematian` | `dicatat_oleh` saja; **update/delete tanpa history** | 🟡 |
| Pengakhiran Keanggotaan | `pengakhiran_keanggotaan` | Snapshot + workflow verifikasi PC → PP | ✅ |
| Perubahan Kepengurusan | `anggota_kepengurusan` | Append-only + `jabatan_sebelumnya` + workflow + SK | 🟡 pelaku = nama |
| Pemberhentian Pengurus | `anggota_kepengurusan(jenis=berhentikan)` + alasan (mig. 034) | idem | 🟡 |
| Penggantian Rekening | `anggota_rekening` | Histori lama→baru append-only + alasan + pengaju/penyetuju | 🟡 **norek plaintext**, non-transaksional |
| Pewarisan NIK | `nik_master`, `nik_kepemilikan` | **TIDAK ADA** (kolom `created_by/updated_by` pun tak terisi) | ❌ (event legal/kritis) |
| History Anggota (menu) | — | Halaman demo tidak fungsional | ❌ UI |

### 2.2 Modul Pelayanan & Keuangan

| Modul | Tabel utama | History | Status |
|---|---|---|---|
| Dana Kematian (workflow) | `dana_kematian` | `riwayat_proses_dakem` + `audit_dana_kematian` | 🟡 hanya transisi & 3 field |
| Dokumen Dakem (verifikasi/upload/hapus) | kolom dokumen di `dana_kematian` | ikut `data_perubahan.changed_fields` (tertimpa) | 🟡 |
| Konfigurasi Dakem | `dana_kematian_config` | `dana_kematian_config_history` (old/new/aktor/catatan) | ✅ |
| Klaim/Penugasan Dakem | `dana_kematian.claim_status` dll. | via `audit_dana_kematian`/riwayat | 🟡 |
| Dana Sosial | `dana_sosial` | **TIDAK ADA** | ❌ |
| Pembayaran Sumbangan | `pembayaran_sumbangan` | `diverifikasi_oleh` **diambil dari request body** (bisa dipalsukan) | ❌ |
| Arus Kas | `arus_kas` | **TIDAK ADA** | ❌ |
| Laporan Periode | `laporan_periode` | `diverifikasi_oleh` dari body; tanpa history | ❌ |
| Laporan Periode Dakem | `laporan_periode_dakem` | `created_by` = **nama** user (bukan ID) | ❌ |
| Keuangan (dashboard/neraca/laba-rugi) | agregasi read-only | n/a (tidak mengubah data) | — |

### 2.3 Master Data & Pengaturan

| Modul | Tabel | History | Status |
|---|---|---|---|
| Master Cabang | `master_cabang` | kolom `created_by/updated_by` ada tapi **tak pernah terisi**; tanpa tabel history | ❌ |
| Master Bank | `master_bank` | idem | ❌ |
| Master Kategori Bantuan | `master_kategori_bantuan` | idem | ❌ |
| Master Tarif Dakem | `master_tarif_dana_kematian` | **tidak ada kolom audit sama sekali** | ❌ |
| Master Regional / Witel | `master_regional`, `master_witel` | `updated_by` tak terisi | ❌ |
| Wilayah (provinces dst.) | tabel wilayah | — (data referensi eksternal, prioritas rendah) | ❌ (low) |
| User Management (users/roles/permissions/settings) | Prisma `User`, `UserRole`, dll. | `SystemLog` event-level **tanpa old/new values**, tanpa module/role | 🟡 |
| Notification Routing | `notification_routing` | tidak ada | ❌ (medium) |
| Notifikasi / Chat | `notifications`, `chat_messages` | tidak ada | ❌ (low) |
| Auth (login/logout/change password) | — | change-password di `SystemLog`; **login/logout tidak dicatat** | ❌ |

### 2.4 Operasi Massal & Background

| Operasi | History | Status |
|---|---|---|
| Import Excel anggota (`batch-import`, upsert onConflict nik) | hanya `anggota_history` (minus aktor); **`batch_operation_log` tidak dipakai**; upsert menimpa field terlindungi (lihat `SIPATEL_ARCHITECTURAL_AUDIT.md`) | ❌ |
| Bulk delete anggota | soft delete massal; **tanpa log operasi**, aktor tidak diketahui | ❌ |
| Upload/dokumen (storage) | URL tersimpan sebagai kolom tabel terkait (ikut trigger bila tabelnya diaudit) | 🟡 |

## 3. Gap Analysis Pencatatan Perubahan Data

Dibandingkan kebutuhan klien — *"siapa, kapan, dari menu mana, old/new value, alasan, untuk SEMUA modul"*:

| # | Kebutuhan | Kondisi existing | Gap |
|---|---|---|---|
| 1 | Identitas data yang berubah | `anggota_history`, `audit_dana_kematian` punya; modul keuangan/master tidak | ❌ tidak merata |
| 2 | Nama pengguna pelaku | Dakem & approval OK; **`anggota_history.changed_by` selalu NULL**; master & keuangan NULL | ❌ kritis |
| 3 | Role pengguna pelaku | Hanya `actor_role` dakem (`pusat/cabang`, bukan role RBAC) | ❌ |
| 4 | Tanggal & waktu | Semua tabel history punya | ✅ |
| 5 | Modul/menu asal aktivitas | **Tidak ada tabel audit yang menyimpan modul asal** | ❌ |
| 6 | Jenis aktivitas terstandardisasi | `anggota_history` 3 nilai; dakem 4 nilai; `SystemLog` free-text; workflow pakai kolom status | 🟡 |
| 7 | Old value | `anggota_history`, `audit_dana_kematian` (3 field), `anggota_perubahan`, `anggota_rekening`, `dana_kematian_config_history` | 🟡 hanya modul tertentu |
| 8 | New value | idem | 🟡 |
| 9 | Alasan perubahan | `anggota_perubahan.alasan`, workflow `catatan`/`alasan_keputusan` | 🟡 hanya jalur approval |
| 10 | Multi-field diff andal | `changed_fields` `anggota_history` 9 kolom; dakem `changed_fields` tertimpa di `data_perubahan` | ❌ |
| 11 | Perubahan via API tercatat | Anggota & dakem ya (minus aktor utk anggota) | 🟡 |
| 12 | Background job / SQL langsung / proses otomatis tercatat | Hanya tabel ber-trigger (anggota, dakem); **modul lain bisa berubah tanpa jejak** | ❌ kritis |
| 13 | Penelusuran per anggota/entitas | Ada tapi **tersebar di ≥6 tabel** (`anggota_history`, `anggota_perubahan`, `anggota_mutasi`, `anggota_rekening`, `anggota_kepengurusan`, `pengakhiran_keanggotaan`, `pengajuan_mutasi_cabang`) tanpa API agregat | 🟡 |
| 14 | Data lama diketahui meski master berubah/dihapus | Anggota: ya (soft delete + snapshot); **master data: TIDAK** (perubahan/penonaktifan cabang tidak meninggalkan kondisi lama) | ❌ |
| 15 | Konsistensi history dengan transaksi DB | `applyPenggantianRekening` & `recordMutasiIfCabangChanged` non-transaksional (best-effort); `systemLog` transaksional hanya di jalur Prisma | 🟡 |
| 16 | Keamanan data sensitif | `norek_bank` plaintext di `anggota_history` JSON, `anggota_rekening`, `audit_dana_kematian`; tanpa masking; password/token tidak masuk audit (aman) | 🟡 |
| 17 | Pencarian/filter (anggota, modul, user, aksi, periode) | Hanya per-anggota + paginasi | ❌ |
| 18 | UI pengguna berwenang | Halaman demo tidak fungsional; tidak ada halaman global | ❌ |

**Ringkasan gap kritis (P0):**
1. **Aktor tidak tercatat** pada audit anggota, master data, dan seluruh modul keuangan → history tidak dapat dipertanggungjawabkan.
2. **Tidak ada modul/menu asal** pada semua mekanisme → tidak bisa menjawab "dari menu mana perubahan dilakukan".
3. **5 modul bisnis inti tanpa history sama sekali** (dana sosial, pembayaran sumbangan, arus kas, laporan periode, master data).
4. **Pewarisan NIK tanpa audit** — event legal/keuangan paling sensitif di domain koperasi/pensiunan.
5. **Tidak ada jaminan otomatis** untuk tabel baru (developer harus ingat membuat trigger/insert history) — persis risiko yang ingin dihindari klien.

---

## 4. Potensi Perubahan Data Tanpa Tercatat

Aktivitas yang **saat ini bisa mengubah/menghapus data tanpa meninggalkan jejak** yang memadai:

| # | Aktivitas | Bukti | Dampak |
|---|---|---|---|
| 1 | CRUD Master Cabang (create/update/nonaktifkan) | `app/api/master-cabang/route.ts`, `[id]/route.ts` — tanpa history, `created_by/updated_by` tak diisi | Perubahan struktur organisasi tak tertelusur |
| 2 | CRUD Master Bank | `app/api/master-bank/route.ts` (insert/update/soft delete) | Data rekening referensi berubah tanpa jejak |
| 3 | CRUD Master Kategori Bantuan | `app/api/master-kategori-bantuan/route.ts` | Kategori bantuan berubah tanpa jejak |
| 4 | CRUD Master Tarif Dakem | `app/api/master-tarif-dakem/route.ts` — tabel tanpa kolom audit | **Nominal dana kematian** bisa berubah tanpa jejak |
| 5 | CRUD Master Regional/Witel | `app/api/master-regional/route.ts`, `master-witel/route.ts` | Hierarki wilayah kerja tak tertelusur |
| 6 | CRUD Dana Sosial | `app/api/dana-sosial/route.ts` (+ `[id]`) | Bantuan sosial tanpa audit |
| 7 | CRUD Arus Kas | `app/api/arus-kas/route.ts` (+ `[id]`) | Mutasi kas tanpa audit |
| 8 | CRUD Pembayaran Sumbangan + verifikasi | `app/api/pembayaran-sumbangan/**` — `diverifikasi_oleh` dari **request body** | **Bisa dipalsukan** siapa verifikatornya |
| 9 | CRUD Laporan Periode + verifikasi | `app/api/laporan-periode/**` — `diverifikasi_oleh` dari **body** | Laporan keuangan bisa diubah tanpa jejak |
| 10 | CRUD Laporan Periode Dakem | `app/api/laporan-periode-dakem/**` — `created_by` = nama (bukan ID) | Identitas pelaku ambigu |
| 11 | Pewarisan/perpindahan NIK | `app/api/nik-master/**`, `app/api/nik-kepemilikan/route.ts` (bahkan meng-update `is_current` record lama) | Event hukum tanpa audit |
| 12 | Import Excel anggota | `app/api/anggota/batch-import/route.ts` — upsert massal, `batch_operation_log` tak dipakai | Overwrite data massal tanpa log operasi; aktor hanya terbaca NULL di `anggota_history` |
| 13 | Bulk delete anggota | `app/api/anggota/bulk-delete/route.ts` — update massal `deleted_at` | Penghapusan massal tanpa log siapa/kapan/berapa |
| 14 | Perubahan langsung via SQL / Supabase Dashboard / service role | Hanya `anggota` & `dana_kematian` yang ber-trigger | Semua tabel lain: **celah total** |
| 15 | Perubahan user/role/permission | `SystemLog` hanya event-level; old/new value hilang | Tidak bisa merekonstruksi perubahan hak akses |
| 16 | Login/logout & aktivitas keamanan lain | Tidak dicatat | Tidak bisa audit akses |
| 17 | Koreksi/hapus data kematian (`anggota_kematian`) | Hanya `updated_at`/`deleted_at` | Fakta kematian bisa dikoreksi tanpa jejak |

## 5. Rekomendasi Arsitektur Audit Trail

### 5.1 Pendekatan yang dipilih: **Centralized Audit Trail + Domain History (hybrid)**

Rekomendasi: **satu lapisan audit terpusat berbasis trigger database** sebagai *system of record* audit untuk seluruh tabel, dikombinasikan dengan **mempertahankan tabel histori domain** yang sudah bernilai bisnis.

Alasan memilih trigger DB (bukan hanya service application-level):
1. **Otomatis & menyeluruh** — semua penulisan (API, background job, SQL langsung, Supabase Dashboard, script migrasi) otomatis tercatat tanpa developer harus ingat menambahkannya.
2. **Konsisten dengan transaksi** — trigger berjalan dalam transaksi yang sama dengan perubahan data (ACID): data dan audit tidak pernah terpisah.
3. **Anti-tamper** — audit ditulis oleh database, bukan aplikasi yang bisa di-skip/diubah.

Mengapa tetap mempertahankan domain history (anggota_mutasi, anggota_rekening, anggota_kepengurusan, riwayat_proses_dakem, dll.):
- Tabel-tabel ini menyimpan **timeline bisnis** (bukan sekadar diff), mis. rantai jabatan, rantai mutasi cabang, rantai rekening — dibutuhkan untuk UI/verifikasi workflow.
- Audit terpusat menjadi **safety net + lapisan pelaporan**; domain history tetap menjadi **proses bisnis**.
- Keputusan: **jangan migrasi domain history ke audit terpusat**; cukup pastikan keduanya konsisten (domain history idealnya juga memicu audit terpusat, atau sebaliknya).

### 5.2 Identitas aktor yang andal (kunci perbaikan)

Masalah inti saat ini: `auth.uid()` NULL (Supabase Auth tak dipakai). Solusi yang kompatibel dengan Supabase/PostgREST:

- **Kirim aktor via header** pada setiap penulisan lewat client service-role/anon yang dibuat per-request:
  ```ts
  // lib/supabase-actor.ts (contoh — BUKAN diimplementasikan pada tahap audit ini)
  createClient(url, serviceKey, {
    global: { headers: { 'x-app-user-id': user.id, 'x-app-user-role': roleSlug } }
  })
  ```
- **Trigger membaca GUC**: `current_setting('request.headers', true)::json->>'x-app-user-id'` (fitur standar PostgREST/Supabase yang sudah tersedia). Untuk job/background tanpa aktor, nilainya NULL → ditandai `source='system'`.
- Aktor **SELALU dari session server**, jangan pernah dari request body (perbaiki `pembayaran_sumbangan`, `laporan_periode`).

### 5.3 Normalisasi kualitas data (menyertai audit)

- Standarkan `action` (CREATE/UPDATE/DELETE/APPROVE/REJECT/VERIFY/...).
- Standarkan aktor: simpan `actor_user_id` (FK ke `"User".id`), `actor_name`, `actor_role_slug` snapshot.
- Tambahkan `module` dan `entity`/`entity_id`.
- Masking nilai sensitif di layer trigger (lihat §6).

### 5.4 Hubungan dengan `SystemLog` dan `created_by/updated_by`

- `SystemLog` (Prisma) dipakai hanya untuk user-management. Rekomendasi: **jembatani** `systemLog()` agar juga menulis ke `audit_log` (atau memigrasikan pemanggilnya ke service audit terpusat) supaya satu tempat baca.
- Kolom `created_by/updated_by` master: tetap dipertahankan sebagai *denormalized* "siapa terakhir mengubah" untuk tampilan cepat, tetapi **sumber kebenaran riwayat tetap `audit_log`**.

## 6. Rekomendasi Struktur Database

### 6.1 Tabel `audit_log` terpusat (BARU)

```sql
CREATE TABLE audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  module          VARCHAR(50)  NOT NULL,          -- keanggotaan, dana_kematian, keuangan, master_data, user_management, ...
  table_name      VARCHAR(63)  NOT NULL,          -- anggota, dana_sosial, master_cabang, ...
  entity_id       VARCHAR(64),                    -- PK baris yang berubah
  anggota_id      UUID,                           -- opsional: penelusuran lintas tabel per anggota
  action          VARCHAR(20)  NOT NULL,          -- CREATE | UPDATE | DELETE | APPROVE | REJECT | VERIFY | RESTORE | TRASH | ...
  old_values      JSONB,                          -- kondisi SEBELUM (masked)
  new_values      JSONB,                          -- kondisi SESUDAH (masked)
  changed_fields  TEXT[],                         -- diff kolom (semua kolom, bukan hard-coded)
  actor_user_id   UUID,                           -- "User".id (Prisma); NULL = system
  actor_name      VARCHAR(255),                   -- snapshot nama
  actor_role_slug VARCHAR(50),                    -- snapshot role saat aksi
  reason          TEXT,                           -- alasan (dari approval body / catatan)
  source          VARCHAR(20)  NOT NULL DEFAULT 'api',  -- api | job | system | migration
  ip_address      VARCHAR(45),
  user_agent      TEXT
);

-- Index untuk filter & penelusuran
CREATE INDEX idx_audit_log_time      ON audit_log(occurred_at DESC);
CREATE INDEX idx_audit_log_actor     ON audit_log(actor_user_id, occurred_at DESC);
CREATE INDEX idx_audit_log_entity    ON audit_log(table_name, entity_id);
CREATE INDEX idx_audit_log_anggota   ON audit_log(anggota_id, occurred_at DESC);
CREATE INDEX idx_audit_log_module    ON audit_log(module, occurred_at DESC);
CREATE INDEX idx_audit_log_action    ON audit_log(action);
CREATE INDEX idx_audit_log_changed   ON audit_log USING GIN(changed_fields);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY; -- akses hanya via API (service role)
```

Catatan desain:
- **Tidak memakai FK** untuk `actor_user_id` ke `auth.users` (pelajaran dari mismatch `anggota_history.changed_by`); cukup FK ke `"User"(id)` atau tanpa FK + join manual — snapshot `actor_name`/`actor_role_slug` menjamin keterbacaan walau user dihapus.
- `old_values`/`new_values` menyimpan **seluruh baris** (seperti pola `anggota_history` yang sudah terbukti) — diff dihitung via `changed_fields` saat display.
- Untuk volume besar: pertimbangkan **partisi bulanan** (`PARTITION BY RANGE (occurred_at)`) di kemudian hari; tidak perlu di fase awal.
- **Retensi**: audit log JANGAN dihapus otomatis (kebutuhan ketertelusuran klien). Fungsi `cleanup_old_batch_logs` hanya untuk `batch_operation_log`.

### 6.2 Konfigurasi audit per tabel `audit_table_config` (BARU)

```sql
CREATE TABLE audit_table_config (
  table_name      VARCHAR(63) PRIMARY KEY,
  module          VARCHAR(50) NOT NULL,
  anggota_column  VARCHAR(63),          -- nama kolom FK anggota (agar trigger bisa isi audit_log.anggota_id)
  mask_columns    TEXT[] DEFAULT '{}',  -- kolom yang dimasking, mis. {norek_bank}
  exclude_columns TEXT[] DEFAULT '{}'   -- kolom yang TIDAK boleh masuk old/new, mis. {password, token}
);
```

- **Masking** (contoh `norek_bank`): trigger menyimpan hanya 4 digit terakhir + panjang (`"****1234 (16)"`), sisanya ditandai `[MASKED]`. Berlaku juga untuk `nik` bila kebijakan klien mensyaratkan.
- **Exclude**: kolom credential (password, token, secret) TIDAK PERNAH masuk `old_values`/`new_values`.

### 6.3 Trigger generik `audit_log_row()` (BARU)

Satu fungsi trigger generik untuk semua tabel terdaftar di `audit_table_config`:
- INSERT → `action='CREATE'`, `new_values=to_jsonb(NEW)`.
- UPDATE → `action='UPDATE'`, keduanya, `changed_fields` = selisih **semua kolom** (bukan hard-coded).
- DELETE → `action='DELETE'`, `old_values=to_jsonb(OLD)`.
- Aktor dari `current_setting('request.headers', true)::json->>'x-app-user-id'` + role dari header yang sama.
- `anggota_id` di-resolve dari `anggota_column` konfigurasi (mis. `anggota.anggota_id`), memungkinkan penelusuran **per anggota lintas modul**.

### 6.4 Perubahan pada mekanisme existing (transisi)

| Objek | Tindakan |
|---|---|
| `anggota_history` + `track_anggota_changes` | **Deprecate bertahap**: aktifkan `audit_log` untuk `anggota`, verifikasi paritas, lalu hentikan trigger lama (data lama dipertahankan untuk dibaca). Perbaiki sekaligus masalah `changed_by` NULL. |
| `audit_dana_kematian` / `riwayat_proses_dakem` | **Pertahankan** (domain history bernilai bisnis); tambahkan `audit_log` untuk `dana_kematian` sebagai lapisan diff lengkap (menutupi field di luar 3 field saat ini). |
| `update_audit_updated_by` (mig. 021) | Ganti pembacaan `request.user.id` → header `x-app-user-id`, atau isi kolom dari aplikasi; supaya `created_by/updated_by` master benar-benar terisi. |
| `batch_operation_log` | **Aktifkan pemakaianya** di `batch-import` dan `bulk-delete` (INSERT log start → update completed/partial + counts + performed_by + IP). |
| `SystemLog` | Bridge ke `audit_log` (module `user_management`) atau migrasi bertahap; tetap simpan untuk backward-compat. |
| `anggota_kematian`, `nik_master`, `nik_kepemilikan` | Daftarkan ke `audit_table_config`. |
| Tabel keuangan (`dana_sosial`, `pembayaran_sumbangan`, `arus_kas`, `laporan_periode`, `laporan_periode_dakem`) | Daftarkan ke `audit_table_config`. |
| Master (`master_cabang`, `master_bank`, `master_kategori_bantuan`, `master_tarif_dana_kematian`, `master_regional`, `master_witel`) | Daftarkan ke `audit_table_config`. |
| Tabel sistem (`notifications`, `chat_messages`, `notification_routing`, Prisma `User`/`UserRole`/`UserPermission`) | Daftarkan (prioritas lebih rendah). |

## 7. Rekomendasi Tampilan & Hak Akses

### 7.1 Halaman baru: **Riwayat Aktivitas / Audit Trail** (global)

Lokasi usulan: `app/(protected)/audit-trail/page.tsx` (menu baru di grup "Pengaturan"/"Sistem"), API: `GET /api/audit-trail` (paginasi + filter), `GET /api/audit-trail/[id]` (detail), serta `GET /api/audit-trail/anggota/[anggotaId]` (agregat timeline anggota).

Kolom tabel minimal (sesuai kebutuhan klien):

| Kolom | Sumber |
|---|---|
| Waktu aktivitas | `occurred_at` |
| Pengguna | `actor_name` (+ link ke user bila `actor_user_id` ada) |
| Role | `actor_role_slug` |
| Modul | `module` (+ sub-modul/menu) |
| Jenis aktivitas | `action` (badge berwarna) |
| Entitas | `table_name` + `entity_id` (+ NIK/nama anggota bila `anggota_id` ada) |
| Data yang berubah | `changed_fields` (chip) |
| Detail sebelum/sesudah | drawer/modal: tabel **Field | Sebelum | Sesudah**, hanya field berubah |

Fitur filter: anggota (cari NIK/nama), modul, pengguna, jenis aktivitas, rentang tanggal, tabel/entitas; ekspor CSV (dibatasi permission).

### 7.2 Integrasi di halaman detail

- `DetailModal` anggota & halaman detail modul (dakem, rekening, kepengurusan, pengakhiran): tab **"Riwayat"** menggabungkan `audit_log` + domain history terkait menjadi satu timeline kronologis.
- **Perbaiki halaman `history-anggota`** yang sekarang demo:
  - Opsi A (rekomendasi): jadikan halaman global yang otomatis ter-filter `anggota_id` saat dibuka dari detail anggota.
  - Opsi B: tambahkan selector anggota (autocomplete NIK/nama) di halaman yang ada.
  - Sekaligus perbaiki join aktor (`"User"`, bukan tabel `users`).

### 7.3 Hak akses (RBAC)

- Permission baru (pola `PERMISSIONS` di `lib/rbac.ts`):
  - `audit_trail_view` — melihat daftar & detail audit.
  - `audit_trail_export` — ekspor.
  - `audit_trail_manage` — (opsional) konfigurasi retensi/masking; hanya admin.
- Pemetaan default: `administrator`/`owner`/`pp` → view+export; `ketua_*`/`pc` → view (terbatas cabangnya); staff cabang → **tidak** dapat akses global.
- **Filtering berbasis data**: user non-pusat hanya melihat audit entitas cabangnya (via `anggota_id` → `anggota.nama_cabang` atau `entity_id` terkait).
- Masking **di UI**: `norek_bank`, `nik` (parsial) ditampilkan termask untuk role selain admin; nilai mentah tidak pernah dikirim ke client.
- Halaman audit **read-only** (tanpa tombol ubah/hapus).
- Akses API wajib `requirePermission(...)` (pola `lib/rbac-server.ts`) + middleware auth existing.

---

## 8. Strategi Implementasi Bertahap (tanpa merusak workflow existing)

Prinsip: **additive-only**, tidak mengubah perilaku bisnis, tiap fase dapat dirilis & diverifikasi sendiri.

### Fase 0 — Fondasi (tanpa dampak bisnis)
1. Migration baru: `audit_log`, `audit_table_config`, fungsi `audit_log_row()`, helper masking, index.
2. `lib/supabase-actor.ts` — factory client yang mengirim header `x-app-user-id` & `x-app-user-role` dari session; dipakai bertahap oleh route yang menulis.
3. Service `lib/server/audit-service.ts` — helper `writeAudit()` untuk aksi non-CRUD (APPROVE/REJECT/VERIFY/LOGIN) dan jalur Prisma.
4. Script verifikasi (pola `scripts/verify-phase2-database.js`) memastikan trigger terpasang & audit terisi.

### Fase 1 — Keanggotaan & master data (P0)
5. Daftarkan `anggota` di `audit_table_config`; verifikasi paritas dengan `anggota_history`; **aktor kini terisi**.
6. Daftarkan `nik_master`, `nik_kepemilikan`, `anggota_kematian`, `anggota_perubahan`, `anggota_mutasi`, `anggota_rekening`, `anggota_kepengurusan`, `pengakhiran_keanggotaan`, `pengajuan_mutasi_cabang`.
7. Daftarkan semua tabel master; isi `created_by/updated_by` dari aplikasi agar tidak NULL.
8. Normalisasi aktor domain history: `diverifikasi_oleh`/`diputuskan_oleh` simpan **user id** (nama tetap sebagai snapshot).

### Fase 2 — Pelayanan & keuangan (P0/P1)
9. Daftarkan `dana_kematian` (tanpa mengganggu `audit_dana_kematian` & `riwayat_proses_dakem`).
10. Daftarkan `dana_sosial`, `pembayaran_sumbangan`, `arus_kas`, `laporan_periode`, `laporan_periode_dakem`.
11. Hapus pengambilan `diverifikasi_oleh`/`created_by` dari request body → selalu dari session.
12. Aktifkan `batch_operation_log` di `batch-import` & `bulk-delete`.
13. Transaksional: bungkus alur multi-langkah (`applyPenggantianRekening`, `recordMutasiIfCabangChanged`) ke **RPC Postgres** agar data + domain history atomik.

### Fase 3 — User management & keamanan (P1)
14. Bridge `systemLog()` → `audit_log` (module `user_management`), sertakan old/new untuk role/permission/user.
15. Catat login/logout & perubahan password/token (tanpa nilai sensitif) di `audit_log`.

### Fase 4 — UI (P1)
16. API `/api/audit-trail` (list+filter+detail) dengan RBAC & masking.
17. Halaman global Riwayat Aktivitas + drawer diff per field.
18. Tab "Riwayat" di detail anggota & modul; perbaiki `history-anggota` (demo → fungsional).
19. Permission baru + seeding ke `INITIAL_PERMISSIONS`/`DEFAULT_ROLE_PERMISSIONS`.

### Fase 5 — Hardening & operasional (P2)
20. Masking menyeluruh (verifikasi tidak ada nilai sensitif di `old_values`/`new_values`).
21. Monitoring: alert bila ada `audit_log` tanpa aktor (`actor_user_id IS NULL` AND `source='api'` = anomali).
22. Dokumentasi cut-off ke klien: data sebelum Fase 1 tidak dapat direkonstruksi.
23. Opsional: partisi tabel audit + dashboard statistik aktivitas.

### Kriteria penerimaan (per fase)
- Tidak ada perubahan kontrak API yang dipakai frontend (kecuali perbaikan bug aktor).
- `tsc`, unit test, `next build` hijau.
- Bukti uji: create/update/delete di modul terdaftar → baris `audit_log` muncul dengan aktor, role, modul, action, old/new, changed_fields.
- Uji negatif: penulisan langsung via SQL tanpa header tercatat dengan `source='system'` + `actor_user_id NULL` (terlihat, bukan hilang).

### Urutan nilai bisnis

| Fase | Nilai klien | Risiko |
|---|---|---|
| 0 | Fondasi (tak terlihat) | Sangat rendah (additive) |
| 1 | Menjawab "siapa mengubah anggota & master" | Rendah |
| 2 | Menutup celah keuangan & operasi massal | Rendah–sedang (perlu uji import) |
| 3 | Audit hak akses & keamanan | Rendah |
| 4 | Klien dapat memakai sendiri | Rendah |
| 5 | Tahan lama & aman | Sangat rendah |

---

> **Kesimpulan:** fondasi audit terbaik yang sudah ada (`anggota_history` + trigger) perlu **digeneralisasi menjadi `audit_log` terpusat**, aktor diperbaiki lewat header PostgREST, domain history dipertahankan, dan 5 modul bisnis inti + seluruh master data **wajib didaftarkan** ke mekanisme terpusat. **Tidak ada perubahan kode dilakukan pada tahap audit ini — implementasi menunggu persetujuan.**

---

## 9. Status Implementasi (pasca-persetujuan)

> Bagian ini mencatat apa yang **sudah diimplementasikan** setelah audit disetujui.
> `tsc --noEmit` hijau, 172 unit test lulus, `next build` hijau.

### 9.1 Fondasi (migration 036)
- `supabase/migrations/036_create_audit_trail.sql`:
  - Tabel `audit_log` (old/new JSONB, changed_fields, aktor+role, module, source, ip) + index + RLS.
  - Tabel `audit_table_config` + seed 25 tabel bisnis (anggota, nik_*, dana_kematian, keuangan, master data).
  - Fungsi `audit_log_row()` (trigger generik, SECURITY DEFINER), `audit_attach/detach/attach_all`, masking `audit_mask_text`, diff `audit_changed_fields`, konteks header `audit_request_context`.
  - Perbaikan FK `batch_operation_log.performed_by` (mendukung id user Prisma).
  - RPC `apply_penggantian_rekening(...)` atomik (menutup gap non-transaksional).
- `lib/supabase-actor.ts` — factory client service-role dengan header aktor (`x-app-user-id/name/role/ip/reason`).
- `lib/server/audit-mask.ts` — fungsi murni masking/sanitasi/diff (unit-testable).
- `lib/server/audit-service.ts` — `writeAudit()`, `resolveActor()`, `logBatchOperation()`.
- `scripts/verify-audit-trail.js` — cek tabel/trigger/konfigurasi audit di database.

### 9.2 Bridging & RBAC
- `services/system-log.ts` — bridge `SystemLog` → `audit_log` (module `user_management`).
- `lib/rbac.ts` — permission baru `audit_trail_view/export/manage` + seeding + role `ketua-1` mendapat view.
- `app/api/auth/[...nextauth]/auth-options.ts` — **audit LOGIN/LOGOUT** via NextAuth `events.signIn`/`events.signOut`
  (module `user_management`, tabel `User`, reason mencantumkan provider, aktor di-resolve dari Prisma).
  Best-effort: kegagalan audit tidak menggagalkan proses auth. Tervalidasi smoke test
  (baris LOGIN & LOGOUT tertulis lalu dibersihkan).

### 9.3 API & UI
- `app/api/audit-trail/route.ts` (list+filter+ekspor CSV) dan `app/api/audit-trail/[id]/route.ts` (detail).
- `app/(protected)/audit-trail/page.tsx` — halaman global Riwayat Aktivitas (filter modul/aksi/tanggal, diff per field, ekspor).
- `config/menu.config.tsx` — menu "Riwayat Aktivitas" di Manajemen Pengguna.
- Perbaikan `app/api/anggota/[id]/history` (join aktor ke tabel `User`; `full_name`→`name`) dan halaman `history-anggota` (selector anggota fungsional).

### 9.4 Adopsi aktor + perbaikan integritas data
Route yang kini menulis dengan **aktor dari session** (bukan request body):
- Keanggotaan: `anggota/route.ts`, `anggota/[id]`, `approvals/[id]` (+ aksi APPROVE/REJECT), `batch-import`, `bulk-delete`, `nik-master`, `nik-kepemilikan`, `master-cabang`.
- Keuangan/pelayanan: `dana-sosial`, `arus-kas`, `pembayaran-sumbangan` (**verifikator dari session**), `laporan-periode` (**verifikator dari session**), `master-bank`.
- Operasi massal kini tercatat di `batch_operation_log` (import & bulk delete).
- `created_by`/`updated_by` master-cabang kini terisi.

### 9.5 Belum diadopsi aktor (transitional — trigger tetap menangkap, aktor NULL/system)
- ~~master-kategori-bantuan, master-tarif-dakem, master-regional, master-witel~~ → **sudah diadopsi** (§9.8).
- ~~mutasi-cabang, anggota-kepengurusan, pengakhiran-keanggotaan, anggota-kematian, dana-kematian~~ → **sudah diadopsi** (§9.8).
- Tersisa hanya: tabel Prisma `notifications`/`chat_messages` (sengaja tidak diaudit — volume tinggi),
  serta perubahan role/permission yang masih event-level via `SystemLog` bridge.

### 9.8 Update implementasi lengkap (audit menyeluruh)

Setelah persetujuan "aplikasikan semua logging", seluruh route/service penulisan kini
**mengirim aktor dari session** ke `audit_log`:

- **19 file route** dikonversi (pola `getClient()` → `getActorClient`): master
  kategori-bantuan, tarif-dakem, regional, witel, dana-kematian (route, [id], verify,
  claim, documents, import), mutasi-cabang (route, [id]), anggota-kepengurusan
  (route, [id]), pengakhiran-keanggotaan (route, [id]), anggota-kematian (route, [id]),
  notification-routing.
- **Service** kini menerima client aktor opsional: `recordMutasiIfCabangChanged`,
  `applyPenggantianRekening` (kini **RPC-first** `apply_penggantian_rekening` atomik +
  fallback legacy), `markAnggotaBerhenti`, `markAnggotaMeninggal`, dan
  `applyKepengurusanApproval`/`closeActiveJabatan`/`reopenJabatan`/`syncAnggotaPosisi`.
- Route `anggota/[id]/perubahan-data` & `penggantian-rekening` juga diadopsi aktor.
- **LOGIN_FAILED** dicatat di `authorize()` (email tak terdaftar / password salah /
  akun nonaktif) — tanpa menyimpan password.
- UI audit: label & badge aksi `LOGIN_FAILED`.
- **Migration 037**: registrasi `notification_routing` (module `sistem`) + `audit_attach_all()`.
- **`scripts/seed-audit-permissions.js`**: upsert permission `audit_trail_view/export/manage`
  dan assign ke role `administrator` (idempotent; sudah dijalankan — 3/3).

- **Migration 038**: deprecate trigger lama `track_anggota_changes` (menghilangkan duplikasi ke
  `anggota_history` yang `changed_by`-nya selalu NULL). `GET /api/anggota/[id]/history` kini membaca
  `audit_log`; `HistoryTimeline` mendukung aksi RESTORE/APPROVE/REJECT/VERIFY + menampilkan alasan.
- **User-management old/new**: `systemLog()` kini menerima `oldValues`/`newValues`; route
  roles/permissions/users (create/update/delete/set-default) mengirim snapshot before/after
  sehingga perubahan hak akses dapat direkonstruksi per-field.

Validasi: `tsc` bersih, 172 test lulus, `next build` hijau, `verify-audit-trail.js` menampilkan
status per-tabel.

### 9.6 Langkah berikutnya (opsional)
1. Jalankan `036_create_audit_trail.sql` pada database (dan `scripts/verify-audit-trail.js`).
2. Seed permission `audit_trail_view/export` ke role non-admin (via menu Hak Akses / `setup-rbac`).
3. Partisi `audit_log` per bulan bila volume tumbuh.

### 9.7 Catatan kompatibilitas migration 036 (update)

- Migration 036 **tidak mensyaratkan** tabel lain sudah ada:
  - `ALTER TABLE batch_operation_log` dibungkus guard `to_regclass` (perbaikan error
    `42P01: relation "batch_operation_log" does not exist`).
  - `audit_attach()` melewati tabel yang belum ada (hanya NOTICE).
  - `audit_trigger_count()` mengembalikan 0 untuk tabel yang belum ada.
- **Hasil verifikasi keberadaan tabel** (cek read-only via Prisma, Nov 2026) — tabel
  berikut **belum ada** di database sehingga trigger audit untuk sementara dilewati:
  - `anggota_history` (mig. 003) → catatan: audit anggota saat ini sepenuhnya bergantung `audit_log`.
  - `master_bank` (018), `master_tarif_dana_kematian` (020), `master_kategori_bantuan` (022),
    `master_regional` & `master_witel` (024), `batch_operation_log` (025),
    `anggota_rekening` (035 — tertahan FK ke `master_bank` yang belum ada).
- Setelah migration yang bersangkutan dijalankan, cukup panggil ulang:
  ```sql
  SELECT audit_attach_all();
  ```
  untuk memasang trigger audit ke tabel-tabel tersebut (config sudah terisi sejak 036).
- Dry-run `036` (BEGIN…ROLLBACK via `prisma db execute`) terhadap database aktual: **sukses tanpa error**.










