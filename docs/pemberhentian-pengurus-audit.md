# Audit & Rekomendasi Desain — Pemberhentian Pengurus (Keanggotaan)

> Dokumen ini adalah hasil **audit/analisis tahap pertama** — **belum ada perubahan kode**.
> Tujuan: memetakan kondisi nyata project terkait pemberhentian jabatan kepengurusan
> (termasuk mekanisme Perubahan Kepengurusan yang baru diimplementasikan pada migration 033),
> lalu memberi rekomendasi desain menu **Pemberhentian Pengurus** (struktur halaman, matriks
> field + validasi, workflow, approval, struktur database, histori jabatan, dan integrasi
> dengan menu Perubahan Kepengurusan) **tanpa menduplikasi mekanisme existing**.
>
> Pola & gaya dokumen mengikuti `docs/perubahan-kepengurusan-audit.md`,
> `docs/pengakhiran-keanggotaan-audit.md`, dan `docs/entry-meninggal-dunia-audit.md`.
> Tanggal audit: 6 November 2026.

---

## 1. Ringkasan Eksekutif

**Rekomendasi utama: JANGAN bangun mekanisme paralel (tabel/service/workflow baru).**
Menu **Pemberhentian Pengurus** sebaiknya dibangun sebagai **halaman khusus (entry point
terspesialisasi) di atas mekanisme Perubahan Kepengurusan yang sudah ada**:

1. Tabel **`anggota_kepengurusan`** (migration 033) sudah mendukung pemberhentian secara
   penuh: enum `jenis` sudah memuat **`berhentikan`**, lengkap dengan `tanggal_mulai/selesai`,
   `nomor_sk`/`tanggal_sk`/`file_sk`, `jabatan_sebelumnya`, `periode`, workflow PC→PP,
   constraint anti-duplikasi, dan histori append-only.
2. Halaman baru cukup **menggunakan ulang** `POST /api/anggota-kepengurusan` (dengan
   `jenis='berhentikan'`), `PATCH /api/anggota-kepengurusan/[id]`,
   `applyKepengurusanApproval`, validasi `lib/utils/kepengurusan-validation.ts`, status
   machine `lib/workflow/kepengurusan-status.ts`, dan daftar kanonik
   `lib/anggota-kepengurusan.ts` — **tanpa perubahan perilaku** modul existing.
3. **Enhancement additive** yang dibutuhkan (migration 034 + kecil di app):
   - **Daftar pengurus aktif** sebagai langkah awal form (sekarang form mencari dari seluruh
     anggota; klien ingin memilih dari anggota yang punya jabatan).
   - **Kolom `alasan_pemberhentian`** bertipe enum (opsional; alternatif tanpa migration:
     simpan di `metadata` JSONB — tidak direkomendasikan, lihat §11).
   - **Folder upload `sk-pemberhentian`** (whitelist `app/api/upload/route.ts` +
     `lib/supabase-storage.ts`).
   - **Filter `jenis`** pada `GET /api/anggota-kepengurusan` agar daftar pengajuan di menu
     baru bisa terfokus pada pemberhentian.
4. **Dampak ke status keanggotaan: TIDAK ADA.** Pemberhentian jabatan tidak menyentuh
   `status_anggota`, `status_keanggotaan`, maupun `kategori_anggota` (sudah ditegakkan di
   `lib/server/kepengurusan-service.ts` dan dikomentari di migration 033). Pengakhiran
   keanggotaan tetap milik menu **Pengakhiran Keanggotaan** (migration 032).

**Keputusan kunci yang perlu disetujui klien** (lihat §13): daftar nilai enum alasan
pemberhentian, kewajiban dokumen SK, tanggal efektif di masa depan, permission terpisah atau
tidak, dan guard menyilang dengan pengajuan Pengakhiran Keanggotaan.

---

## 2. Cakupan Audit

| Area | File yang diperiksa |
|---|---|
| Skema anggota & posisi kepengurusan | `supabase/migrations/001_create_anggota_table.sql` (`posisi_kepengurusan VARCHAR(120) DEFAULT 'Anggota'`) |
| Histori generik anggota | `supabase/migrations/003_create_anggota_history_table.sql` (trigger `track_anggota_changes`, snapshot `row_to_json`) |
| Histori mutasi (pola append-only) | `supabase/migrations/027_dakem_claim_config_anggota_approval.sql` (`anggota_mutasi`), `lib/server/anggota-service.ts` (`recordMutasiIfCabangChanged`) |
| Workflow PC/PP referensi | `supabase/migrations/029_create_pengajuan_mutasi_cabang.sql`, `032_create_pengakhiran_keanggotaan.sql` |
| **Implementasi Perubahan Kepengurusan (existing)** | `supabase/migrations/033_create_anggota_kepengurusan.sql`, `lib/server/kepengurusan-service.ts`, `lib/workflow/kepengurusan-status.ts`, `lib/utils/kepengurusan-validation.ts`, `lib/anggota-kepengurusan.ts`, `app/api/anggota-kepengurusan/route.ts`, `app/api/anggota-kepengurusan/[id]/route.ts`, `app/api/anggota/[id]/kepengurusan/route.ts`, `lib/hooks/use-anggota-kepengurusan-api.ts`, `app/(protected)/keanggotaan/perubahan-kepengurusan/page.tsx` |
| Pengakhiran keanggotaan (pemilik `status_keanggotaan`) | `supabase/migrations/032_create_pengakhiran_keanggotaan.sql`, `lib/server/pengakhiran-keanggotaan-service.ts`, `app/(protected)/keanggotaan/pengakhiran-keanggotaan/page.tsx` |
| RBAC & menu | `lib/rbac.ts`, `prisma/data/permissions.js`, `config/menu.config.tsx` |
| Upload dokumen | `lib/supabase-storage.ts` (folder whitelist), `app/api/upload/route.ts`, `components/ui/FileUpload.tsx` |
| Pencarian anggota reusable | `components/anggota/MemberSearchModal.tsx` |
| Keputusan bisnis lintas modul | `docs/PROPOSAL_KEPUTUSAN_BISNIS_SIPATEL.md`, `docs/perubahan-kepengurusan-audit.md` (§13 Q1–Q10 & §15 catatan implementasi Fase 1) |

---

## 3. Temuan Audit

### 3.1 Posisi kepengurusan pada data anggota

- `anggota.posisi_kepengurusan` adalah **VARCHAR free text** `DEFAULT 'Anggota'` (migration
  001). Enum `posisi_kepengurusan_enum` dibuat di migration 001 tetapi **tidak dipakai**
  kolomnya — nilai historis campur (`anggota`, `pengurus`, `Ketua`, dst).
- Nilai kanonik kini diseragamkan lewat `lib/anggota-kepengurusan.ts`
  (`POSISI_KEPENGURUSAN_OPTIONS` = Ketua, Wakil Ketua, Sekretaris, Bendahara, Pengurus,
  Anggota; `POSISI_NETRAL = 'Anggota'`).
- Form Edit di Pengelolaan Data **masih bisa** mengubah posisi secara langsung (Fase 2 §15
  belum dikerjakan — rencananya dijadikan read-only). Badge tabel Pengelolaan Data sudah
  memakai `getPosisiKepengurusanProps`.
- `posisi_kepengurusan` terdaftar di `PROTECTED_FIELDS` modul Perubahan Data Pribadi
  (`lib/anggota-perubahan.ts`) — hanya Pengelolaan Data & Perubahan Kepengurusan yang
  boleh mengubahnya.

### 3.2 Tabel `anggota_kepengurusan` (migration 033) — sudah mendukung pemberhentian

Kolom yang relevan untuk pemberhentian **sudah ada semuanya**:

| Kebutuhan pemberhentian | Kolom existing |
|---|---|
| Jenis perubahan | `jenis` enum `('angkat','pindah','**berhentikan**')` |
| Jabatan yang diakhiri | `jabatan_sebelumnya` (snapshot posisi lama); `jabatan` di-set `'Anggota'` |
| Periode/masa jabatan | `periode` (teks bebas), `tanggal_mulai`, `tanggal_selesai` |
| Tanggal efektif pemberhentian | `tanggal_mulai` pada baris `berhentikan` + `tanggal_selesai` pada baris jabatan lama (di-set `applyKepengurusanApproval` via `safeTanggalSelesai`) |
| Nomor & tanggal SK | `nomor_sk` (NOT NULL), `tanggal_sk` (NOT NULL) |
| Dokumen pendukung | `file_sk` (URL bucket `anggota`) |
| Alasan/keterangan | `catatan_pengaju` (teks bebas, wajib ≥10 karakter), `keterangan`, `metadata` JSONB |
| Jejak pelaku | `diajukan_oleh`, `diverifikasi_oleh/pada`, `diputuskan_oleh/pada`, `alasan_keputusan` |

**Constraint anti-duplikasi yang sudah ditegakkan di DB:**

- `uq_kepengurusan_aktif_pengajuan_per_anggota` — satu pengajuan aktif
  (`menunggu`/`diverifikasi_pc`) per anggota → **mencegah pemberhentian ganda berjalan**.
- `uq_kepengurusan_jabatan_aktif_per_anggota` — satu jabatan aktif (selain `'Anggota'`,
  `disetujui_pp`, `tanggal_selesai IS NULL`) per anggota → **mencegah jabatan ganda**.
- `uq_kepengurusan_nomor_aktif` — nomor SK unik antar pengajuan aktif/final → nomor SK
  pemberhentian tidak boleh sama dengan nomor SK pengangkatan mana pun yang masih berlaku.
- `deleted_at` (soft delete) + seluruh query memfilter `deleted_at IS NULL` → **riwayat
  tidak pernah dihapus fisik**.

### 3.3 Mekanisme Perubahan Kepengurusan (baru saja diimplementasikan)

- **Halaman 3 langkah** (`Cari Anggota → Pilih Jabatan & SK → Tinjau & Kirim`), panel
  **Riwayat Kepengurusan per anggota**, dan tabel **Pengajuan & Riwayat** dengan aksi
  Verifikasi PC / Setujui PP / Tolak / Batalkan.
- **Mode `berhentikan` sudah ada di form existing**: saat dipilih, field Jabatan diganti
  kotak read-only "Kembali menjadi **Anggota**" (`POSISI_NETRAL`), dan `jabatanEfektif`
  di review = `'Anggota'`.
- **Validasi** (`lib/utils/kepengurusan-validation.ts`, dipakai client & server):
  anggota wajib; `tanggal_mulai` wajib & **tidak boleh masa depan**; `tanggal_selesai`
  opsional tapi harus > `tanggal_mulai`; `nomor_sk` wajib 3–100 karakter (pola
  `[A-Za-z0-9 ./_()-]`); `tanggal_sk` wajib & **≤ `tanggal_mulai`**; `catatan_pengaju`
  wajib ≥10 karakter; `keterangan` opsional ≤500 karakter.
- **Guard server** (`POST /api/anggota-kepengurusan`): anggota `meninggal` → 409; anggota
  `status_keanggotaan='berhenti'` → 409; `jenis='berhentikan'` tapi posisi sudah
  `'Anggota'` → 400 `NO_CHANGE`; ada pengajuan aktif → 409 `DUPLICATE_ACTIVE`; nomor SK
  terpakai → 409 `DOCUMENT_NUMBER_USED`.
- **Persetujuan** (`applyKepengurusanApproval`): (1) tutup semua jabatan aktif lama
  (`tanggal_selesai = safeTanggalSelesai`, aman constraint `tanggal_selesai >
  tanggal_mulai`), (2) tandai baris `disetujui_pp` + aktor keputusan, (3) sinkronkan
  `anggota.posisi_kepengurusan` (idempotent) — dengan **rollback** bila langkah berikutnya
  gagal. Admin mendapat **jalur cepat** (self-approved saat POST; gagal apply → ditandai
  `ditolak` + HTTP 502).
- **Status machine** (`lib/workflow/kepengurusan-status.ts`):
  `menunggu → diverifikasi_pc → disetujui_pp` (`ditolak`/`dibatalkan` terminal).

### 3.4 Periode / masa jabatan

Sudah didukung sejak migration 033: `periode` VARCHAR(50) teks bebas (mis. `2025-2030`)
**plus** `tanggal_mulai`/`tanggal_selesai` terstruktur. Keputusan audit sebelumnya (Q3):
**tanpa tabel master periode** — cukup teks. Belum ada fitur "berakhir otomatis saat periode
habis" (jabatan berakhir hanya lewat pemberhentian/disetujui atau di-set `tanggal_selesai`
manual saat pengangkatan).

### 3.5 Gap data legacy (penting untuk daftar pengurus)

- Pengurus yang posisinya di-set **sebelum** migration 033 (via Edit Pengelolaan Data /
  import Excel) **tidak punya baris di `anggota_kepengurusan`** — posisinya hanya ada di
  `anggota.posisi_kepengurusan`.
- Konsekuensi: (a) daftar pengurus aktif harus bersumber dari
  `anggota.posisi_kepengurusan <> 'Anggota'` (bukan hanya dari tabel histori);
  (b) saat pengurus legacy diberhentikan, `applyKepengurusanApproval` tidak menemukan
  jabatan lama untuk ditutup (tidak error — hanya tidak ada baris lama yang ditutup;
  posisi tetap tersinkron dan `jabatan_sebelumnya` terisi di baris `berhentikan`).
  Seed histori awal (Q7) memang tercatat sebagai **belum dikerjakan** di Fase 2.
- Helper `getActiveJabatan()` sudah ada di `lib/server/kepengurusan-service.ts` tetapi
  **belum dipakai** siapa pun — siap direuse untuk panel "jabatan aktif".

### 3.6 RBAC, role, dan menu

- Permission khusus sudah ada: `manage_perubahan_kepengurusan`
  (`lib/rbac.ts`, `prisma/data/permissions.js`), dengan grup:
  - `KEPENGURUSAN_MANAGE_PERMISSIONS` = `manage_keanggotaan`,
    `manage_perubahan_kepengurusan`, `dakem_manage_pc`, `dakem_verify_pp`.
  - `KEPENGURUSAN_VIEW_PERMISSIONS` = manage + `view_keanggotaan`.
- Menu Keanggotaan saat ini: Pendaftaran Anggota Baru, Pengelolaan Data, Perubahan Data
  Pribadi, **Perubahan Kepengurusan**, Mutasi Cabang, Data Meninggal Dunia, Pengakhiran
  Keanggotaan.
- `isAdminActor()` = slug `admin`/`administrator`/`owner` → satu-satunya aktor jalur cepat.

### 3.7 Mekanisme histori perubahan data (menyeluruh)

| Mekanisme | Isi | Relevansi |
|---|---|---|
| `anggota_history` (trigger, migration 003) | Snapshot penuh `row_to_json(NEW/OLD)` **setiap** UPDATE anggota | Perubahan `posisi_kepengurusan` ikut terekam di snapshot JSON (meski tidak disebut di `changed_fields`); `changed_by` selalu NULL untuk request aplikasi (pakai `auth.uid()` — isu D.2 proposal) |
| `anggota_perubahan` (migration 027/028) | Usulan create/edit/hapus + keputusan | Tidak dipakai modul kepengurusan (punya workflow sendiri) |
| `anggota_mutasi` (migration 027) | Riwayat mutasi cabang append-only | Pola yang ditiru histori jabatan |
| **`anggota_kepengurusan`** (migration 033) | **Riwayat jabatan append-only** — satu baris per pengajuan/periode; penutupan = isi `tanggal_selesai`, bukan hapus | **Sumber kebenaran histori jabatan** untuk fitur ini |

### 3.8 Pengakhiran Keanggotaan (pemilik status keanggotaan)

- Migration 032 menambah `anggota.status_keanggotaan` (`aktif`/`non_aktif`/`berhenti`);
  modul ini **satu-satunya** yang men-set `'berhenti'`, dengan alasan enum
  (`mengundurkan_diri`, `diberhentikan`, `lainnya`) + `keterangan_alasan` wajib bila
  `lainnya`, tanggal efektif tidak boleh masa depan, dokumen opsional, dan pola guard
  "satu lifecycle per anggota" (blokir bila ada pengajuan Dakem/Mutasi aktif).
- **Belum ada guard menyilang** antara pengajuan kepengurusan aktif ↔ pengajuan pengakhiran
  aktif (dua-duanya bisa berjalan bersamaan untuk anggota yang sama).

---

## 4. Evaluasi Kebutuhan Bisnis vs Existing

| Kebutuhan (brief §4) | Kondisi existing | Kesimpulan |
|---|---|---|
| Pemberhentian ≠ mengakhiri keanggotaan | `applyKepengurusanApproval` hanya menyentuh `posisi_kepengurusan` | ✅ Sudah terpenuhi |
| Status anggota tetap aktif | `status_anggota`/`status_keanggotaan`/`kategori` tidak disentuh | ✅ Sudah terpenuhi |
| Histori jabatan tidak dihapus | Append-only + soft delete + constraint | ✅ Sudah terpenuhi |
| Tanggal efektif & alasan jelas | `tanggal_mulai` wajib (≤ hari ini) + `catatan_pengaju` wajib ≥10 karakter | ⚠️ Cukup, tapi alasan masih teks bebas → rekomendasi enum terstruktur (§6) |
| Cegah pemberhentian ganda | `NO_CHANGE` + `DUPLICATE_ACTIVE` + partial unique index | ✅ Sudah terpenuhi |
| Satu jabatan vs semua jabatan | Model **jabatan tunggal** (Q10 disetujui): maks 1 jabatan aktif per anggota | ✅ Pemberhentian mengakhiri **satu-satunya** jabatan aktif. Bila kelak multi-jabatan disetujui, perlu revisi (§13-Q9) |
| Dokumen SK pemberhentian | `nomor_sk`/`tanggal_sk` wajib; `file_sk` opsional (folder `sk-pengangkatan`) | ⚠️ Folder upload perlu label netral/baru `sk-pemberhentian` (§6) |
| Persetujuan PC/PP | Workflow 2 tahap + jalur cepat admin sudah berjalan | ✅ Reuse (§10) |

---

## 5. Rekomendasi Struktur Halaman & Form

**Nama menu:** "Pemberhentian Pengurus" (sesuai bahasa klien; paralel dengan menu
"Pengangkatan…"/"Pengakhiran…" yang berorientasi proses).
**Path:** `/keanggotaan/pemberhentian-pengurus` (konsisten pola path kebab-case).
**Posisi menu:** langsung **setelah "Perubahan Kepengurusan"**, sebelum "Mutasi Cabang".
**Permission menu:** `[...KEPENGURUSAN_MANAGE_PERMISSIONS]` (reuse — lihat §10).

**Struktur halaman (mengikuti pola 3-langkah + panel yang sudah dikenal petugas):**

```
Langkah 1 — Pilih Pengurus (BARU, beda dari Perubahan Kepengurusan)
  • Daftar/tabel pengurus aktif: NIK, Nama, Cabang, Jabatan Aktif, Periode,
    Mulai Jabatan, No SK Pengangkatan + pencarian (NIK/nama) & filter cabang
  • Sumber data: anggota.posisi_kepengurusan <> 'Anggota' (tahan legacy, §3.5),
    LEFT JOIN baris aktif anggota_kepengurusan untuk detail periode/SK
  • Baris dengan pengajuan kepengurusan aktif ditandai (badge) & tombol dinonaktifkan
    (guard DUPLICATE_ACTIVE sudah ada di server)

Langkah 2 — Form Pemberhentian
  • Kartu ringkasan (read-only): NIK, Nama, Cabang, Jabatan Aktif (+ periode/SK bila ada)
  • Alert info: "Pemberhentian jabatan TIDAK mengakhiri keanggotaan — status anggota
    tetap aktif. Untuk mengakhiri keanggotaan gunakan menu Pengakhiran Keanggotaan."
  • Field form (lihat matriks §6) — tanpa field Jenis Perubahan (fixed 'berhentikan')
    dan tanpa field Jabatan Tujuan (fixed hasil: kembali menjadi 'Anggota')

Langkah 3 — Tinjau & Kirim
  • Ringkasan: anggota, jabatan saat ini → 'Anggota', tanggal efektif, alasan, SK,
    dokumen (link), keterangan — pola identik halaman existing

Panel bawah (selalu tampil):
  • Riwayat kepengurusan anggota terpilih (reuse useKepengurusanByAnggota)
  • Tabel "Pengajuan & Riwayat Pemberhentian" — GET /api/anggota-kepengurusan
    dengan filter jenis='berhentikan' + aksi Verifikasi PC / Setujui PP / Tolak /
    Batalkan (reuse hook useUpdateKepengurusanStatus & dialog keputusan)
```

**Komponen yang direuse langsung:** `Toolbar/ToolbarHeading`, `Container`, `Card`,
`FileUpload`, `MemberSearchModal` (opsional sebagai fallback pencarian), badge
`getPosisiKepengurusanProps`/`getKepengurusanStatusProps`, dialog keputusan, tabel riwayat.

---

## 6. Matriks Field & Validasi

Mapping kebutuhan field klien (brief §2) → implementasi:

| Field di form | Pemetaan | Wajib | Validasi |
|---|---|---|---|
| Pilih Pengurus | daftar pengurus aktif → `anggota_id` | ✅ | Hanya anggota ber-jabatan (posisi ≠ 'Anggota'), tidak `meninggal`, `status_keanggotaan ≠ 'berhenti'`, tanpa pengajuan kepengurusan aktif |
| NIK & Nama Pengurus | read-only dari `anggota` | — | Terisi otomatis |
| Posisi/Jabatan Saat Ini (+ periode, mulai, SK pengangkatan) | read-only dari `anggota.posisi_kepengurusan` + baris aktif histori | — | Terisi otomatis; tampil juga bila datanya legacy (tanpa histori) |
| Hasil pemberhentian | fixed read-only "Kembali menjadi **Anggota**" (`POSISI_NETRAL`) | — | — |
| Tanggal Efektif Pemberhentian | `tanggal_mulai` | ✅ | Valid kalender; **tidak boleh masa depan** (konsisten Q4 & pengakhiran); **≥ `tanggal_mulai` jabatan aktif** (validasi baru, jaga kualitas data — saat ini hanya dijaga tidak-fatal oleh `safeTanggalSelesai`) |
| Alasan Pemberhentian | **BARU: `alasan_pemberhentian`** enum — usulan nilai: `habis_masa_jabatan`, `mengundurkan_diri`, `diberhentikan`, `lainnya` | ✅ | Wajib; bila `lainnya` → `keterangan_alasan` wajib (pola pengakhiran) |
| Uraian Alasan | `catatan_pengaju` | ✅ | Min 10, maks 1000 karakter (existing) |
| Nomor Dokumen/SK Pemberhentian | `nomor_sk` | ✅ | 3–100 karakter, pola existing, unik antar pengajuan aktif/final (server 409 + partial unique index) |
| Tanggal Dokumen/SK | `tanggal_sk` | ✅ | Valid; **≤ tanggal efektif** (existing) |
| Keterangan | `keterangan` | ❌ | Maks 500 karakter (existing) |
| Upload Dokumen Pendukung | `file_sk` (folder `sk-pemberhentian` — BARU) | ❌ | PDF/gambar via `FileUpload` + whitelist upload; rekomendasi: **wajib bila alasan `diberhentikan`** (paralel rekomendasi pengakhiran §11) — konfirmasi §13-Q3 |

Validasi server tambahan yang spesifik pemberhentian (di atas guard existing §3.3):
tidak ada pengajuan **pengakhiran keanggotaan** aktif untuk anggota yang sama
(`satu lifecycle per anggota` — konfirmasi §13-Q7).

---

## 7. Workflow yang Direkomendasikan

Identik dengan workflow klien (brief §5) dan **100% reuse mesin existing**:

```
1. Petugas membuka menu Pemberhentian Pengurus.
2. Sistem menampilkan daftar pengurus aktif (pencarian/filter).
3. Petugas memilih pengurus → sistem menampilkan info jabatan aktif + riwayat.
4. Petugas mengisi tanggal efektif, alasan (enum + uraian), SK, dokumen pendukung.
5. Petugas meninjau lalu menyimpan/mengajukan:
   • Admin (isAdminActor) → jalur cepat: langsung disetujui & diterapkan
     (self-verified + self-approved, jejak aktor tercatat).
   • Non-admin → pengajuan berstatus 'menunggu'.
6. PC memverifikasi ('diverifikasi_pc') → PP memutuskan:
   • 'disetujui_pp' → applyKepengurusanApproval:
       a. jabatan aktif lama ditutup (tanggal_selesai = tanggal efektif, aman constraint),
       b. baris pemberhentian menjadi final (jabatan 'Anggota', jabatan_sebelumnya terisi),
       c. anggota.posisi_kepengurusan disinkronkan menjadi 'Anggota' (idempotent),
       dengan rollback bila gagal.
   • 'ditolak' (alasan wajib) / 'dibatalkan' (hanya sebelum final) → terminal,
     data jabatan TIDAK berubah.
7. Riwayat kepengurusan tetap tersimpan (append-only) — tampil di menu ini,
   menu Perubahan Kepengurusan, dan bisa dibaca via /api/anggota/[id]/kepengurusan.
```

Pemberhentian **diterapkan saat disetujui, bukan scheduled** — konsisten dengan keputusan
Pengakhiran (§032 no. 4) dan audit Kepengurusan Q4.

---

## 8. Pengaruh terhadap Status Keanggotaan

- **Tidak ada perubahan** pada `status_anggota` (peran keluarga), `status_keanggotaan`
  (siklus hidup), maupun `kategori_anggota` — ditegakkan di `syncAnggotaPosisi` (hanya
  menulis `posisi_kepengurusan`) dan dikunci secara konvensi lintas modul.
- Anggota yang diberhentikan dari jabatan **tetap anggota aktif penuh** (iuran, Dakem,
  dsb. tidak terdampak).
- Jika niatnya juga mengakhiri keanggotaan → proses terpisah di menu **Pengakhiran
  Keanggotaan**. Rekomendasi UI: alert penegas di langkah 2 (§5) agar petugas tidak
  keliru memilih proses.
- Saat menyusun pengakhiran keanggotaan untuk anggota yang masih pengurus: tidak ada
  yang otomatis menutup jabatannya — **gap Fase 2 (Q8: auto-close saat meninggal/berhenti)**.
  Rekomendasi jangka pendek: (a) guard menyilang (§6/§13-Q7) dan (b) setelah pengakhiran
  disetujui, petugas masih bisa memberhentikan jabatan melalui menu ini — namun guard
  `ANGGOTA_BERHENTI` di POST saat ini **menolaknya** → perlu **pengecualian**: pemberhentian
  jabatan atas anggota `status_keanggotaan='berhenti'` sebaiknya tetap diizinkan
  (bersifat penutupan administratif jabatan), berbeda dari pengangkatan/pindah yang memang
  ditolak. → butuh keputusan (§13-Q8).

---

## 9. Mekanisme Penyimpanan Histori Jabatan

- **Satu baris `anggota_kepengurusan` = satu fakta jabatan/pengajuan.** Pemberhentian
  menambah baris baru (`jenis='berhentikan'`, `jabatan='Anggota'`,
  `jabatan_sebelumnya=<jabatan lama>`, `nomor_sk`/`tanggal_sk` SK pemberhentian) dan
  **menutup** baris jabatan lama (`tanggal_selesai` diisi) — tidak ada UPDATE destruktif
  maupun DELETE.
- Timeline jabatan anggota = kumpulan baris ter-urut (`/api/anggota/[id]/kepengurusan`);
  sudah dirender di panel Riwayat Kepengurusan (existing) — menu baru menampilkan sama.
- `anggota_history` tetap merekam snapshot perubahan `posisi_kepengurusan` (trigger level
  baris), tetapi **bukan** sumber timeline jabatan (tidak terstruktur per periode; isu
  `changed_by` NULL — sudah tercatat di proposal D.2).
- Data legacy (pengurus pra-033) tidak punya baris periode lama; pemberhentian tetap
  tercatat lengkap dengan snapshot `jabatan_sebelumnya`. Backfill/seed tetap disarankan
  sebagai Fase 2 terpisah (Q7) — bukan blocker fitur ini.

---

## 10. Kebutuhan Approval & RBAC

- **Reuse workflow 2 tahap (PC verifikasi → PP keputusan) + jalur cepat admin** — keputusan
  Q5 audit kepengurusan yang sudah disetujui; pemberhentian setara formalnya dengan
  pengangkatan (berbasis SK, umumnya diputuskan pusat), sehingga tidak ada alasan
  menurunkan/menaikkan tingkat approval berbeda.
- **Permission: reuse `KEPENGURUSAN_MANAGE_PERMISSIONS`** (menu, POST, PATCH) dan
  `KEPENGURUSAN_VIEW_PERMISSIONS` (GET). Tidak dibutuhkan permission baru — pemberhentian
  adalah `jenis` dari perubahan kepengurusan; menambah `manage_pemberhentian_pengurus`
  terpisah hanya layak bila klien ingin **mendelegasikan kewenangan pemberhentian ke role
  berbeda** (konfirmasi §13-Q5).
- Perlindungan antar-tahap tetap dari status machine (`isValidKepengurusanTransition`) dan
  guard server; halaman membungkus aksi dengan `useHasAnyPermission` (pola existing).

---

## 11. Struktur Database yang Direkomendasikan

**TIDAK ada tabel baru.** Migration 034 bersifat **additive & idempotent**:

```sql
-- 1) Enum alasan pemberhentian (pola alasan_pengakhiran_enum, migration 032)
DO $$ BEGIN
  CREATE TYPE alasan_pemberhentian_enum AS ENUM
    ('habis_masa_jabatan', 'mengundurkan_diri', 'diberhentikan', 'lainnya');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Kolom opsional khusus jenis='berhentikan' (nullable → aman untuk data lama)
ALTER TABLE anggota_kepengurusan
  ADD COLUMN IF NOT EXISTS alasan_pemberhentian alasan_pemberhentian_enum;
ALTER TABLE anggota_kepengurusan
  ADD COLUMN IF NOT EXISTS keterangan_alasan TEXT;

COMMENT ON COLUMN anggota_kepengurusan.alasan_pemberhentian IS
  'Alasan pemberhentian — hanya relevan saat jenis=''berhentikan'' (nullable)';
COMMENT ON COLUMN anggota_kepengurusan.keterangan_alasan IS
  'Penjelasan wajib bila alasan_pemberhentian=''lainnya''';

-- 3) Index pendukung filter daftar per jenis (opsional, nice-to-have)
CREATE INDEX IF NOT EXISTS idx_kepengurusan_jenis_status
  ON anggota_kepengurusan(jenis, status) WHERE deleted_at IS NULL;
```

- **Alternatif tanpa migration:** simpan alasan di `metadata` JSONB (kolom sudah ada).
  **Tidak direkomendasikan** — lemah ketik, tak bisa divalidasi/difilter di DB, dan
  menghancurkan paritas dengan pola `pengakhiran_keanggotaan.alasan`.
- Constraint/unique index lain **tidak diubah** (sudah memadai, §3.2). RLS tetap enable;
  akses hanya via API service role (pola 027/029/032/033).
- Penyesuaian kode pendukung (bukan skema): tipe `AnggotaKepengurusan`/input di
  `lib/supabase.ts`; whitelist folder `sk-pemberhentian` di `lib/supabase-storage.ts` +
  `app/api/upload/route.ts`; parameter `jenis` di `GET /api/anggota-kepengurusan`;
  opsi filter posisi untuk daftar pengurus aktif (endpoint anggota existing atau query
  gabungan di service).

---

## 12. Integrasi dengan Menu Perubahan Kepengurusan

- **Satu sumber kebenaran:** kedua menu menulis/membaca tabel & API yang sama. Menu
  Pemberhentian Pengurus = *preset* `jenis='berhentikan'` + daftar pengurus aktif +
  label/istilah pemberhentian; tidak ada logika bisnis yang dicabang.
- Opsi `berhentikan` di form Perubahan Kepengurusan **tetap dipertahankan**
  (rekomendasi) — menghapusnya memaksa petugas pindah menu untuk kasus yang sama, tanpa
  manfaat integritas apa pun karena backend identik. (Bila klien ingin *funneling* ketat,
  opsi dapat disembunyikan — keputusan §13-Q6, dampak hanya UI.)
- Riwayat & keputusan tampil konsisten di kedua menu (tabel pengajuan existing tanpa filter
  jenis; menu baru terfilter `jenis='berhentikan'`).
- Form Edit Pengelolaan Data tetap direncanakan menjadi read-only untuk posisi (Fase 2 Q2)
  — makin memperkuat satu jalur perubahan kepengurusan.

---

## 13. Keputusan yang Diperlukan (konfirmasi klien)

| # | Pertanyaan | Rekomendasi |
|---|---|---|
| Q1 | Nilai final enum `alasan_pemberhentian`? | `habis_masa_jabatan`, `mengundurkan_diri`, `diberhentikan`, `lainnya` |
| Q2 | `keterangan_alasan` wajib saat `lainnya`? | Ya (pola pengakhiran) |
| Q3 | Upload dokumen SK wajib/opsional? | Opsional default; **wajib bila alasan `diberhentikan`** |
| Q4 | Tanggal efektif boleh masa depan? | Tidak (konsisten Q4 kepengurusan & pengakhiran) |
| Q5 | Permission terpisah `manage_pemberhentian_pengurus`? | Tidak — reuse `KEPENGURUSAN_MANAGE_PERMISSIONS` |
| Q6 | Opsi "Berhentikan Jabatan" di menu Perubahan Kepengurusan tetap tampil? | Ya, tetap tampil (backend sama) |
| Q7 | Blokir pemberhentian bila ada pengajuan Pengakhiran Keanggotaan aktif (dan sebaliknya)? | Ya — satu lifecycle per anggota |
| Q8 | Izinkan pemberhentian jabatan atas anggota yang keanggotaannya sudah `berhenti`/`meninggal` (penutupan administratif)? | Ya untuk `berhenti` (penutupan jabatan); untuk `meninggal` arahkan ke Fase 2 auto-close (Q8 lama) |
| Q9 | Apakah organisasi butuh multi-jabatan per anggota? | Tetap jabatan tunggal (Q10 lama); revisi hanya bila ada kebutuhan nyata |

---

## 14. Rencana Implementasi (setelah business rules disetujui)

**Fase 1 (MVP fitur ini):**
1. Migration 034 (§11) + tipe di `lib/supabase.ts`.
2. Query/endpoint daftar pengurus aktif (posisi ≠ 'Anggota' + detail histori aktif).
3. Parameter `jenis` pada `GET /api/anggota-kepengurusan`; validasi alasan (enum +
   keterangan wajib) di `kepengurusan-validation.ts` (hanya untuk `berhentikan`); penyesuaian
   guard `ANGGOTA_BERHENTI` sesuai Q8.
4. Folder upload `sk-pemberhentian`.
5. Halaman `/keanggotaan/pemberhentian-pengurus` (3 langkah, §5) + entri menu + seed tidak
   diperlukan (permission reuse).
6. Unit test (pola `kepengurusan-*.test.ts`): validasi alasan, guard menyilang, transisi.

**Fase 2/3 (terpisah, sudah tercatat):** read-only posisi di Edit Pengelolaan Data (Q2),
seed histori legacy (Q7), auto-close jabatan saat meninggal/berhenti (Q8 lama), notifikasi,
normalisasi import/export terhadap daftar kanonik, master periode & multi-jabatan (Q9).

---

## 15. Catatan Implementasi — FASE 1 (MVP)

> Keputusan: rekomendasi diimplementasikan dengan **default §13** — klien akan mengonfirmasi
> nilai final dan revisi menyusul. Default yang dipakai: Q1 enum 4 nilai
> (`habis_masa_jabatan`, `mengundurkan_diri`, `diberhentikan`, `lainnya`); Q2 keterangan
> wajib saat `lainnya`; Q3 dokumen SK wajib saat `diberhentikan`; Q4 tanggal efektif tidak
> boleh masa depan; Q5 **reuse** `KEPENGURUSAN_MANAGE_PERMISSIONS` (tanpa permission baru);
> Q6 opsi `berhentikan` tetap tampil di menu Perubahan Kepengurusan; Q7 guard menyilang
> dengan pengajuan Pengakhiran Keanggotaan aktif; Q8 pemberhentian jabatan **diizinkan**
> atas anggota `status_keanggotaan='berhenti'` (penutupan administratif); Q9 jabatan tunggal.

### File baru

| File | Peran |
|---|---|
| `supabase/migrations/034_add_alasan_pemberhentian.sql` | Enum `alasan_pemberhentian_enum` + kolom `alasan_pemberhentian`/`keterangan_alasan` (nullable, additive) + index `(jenis, status)` |
| `app/api/anggota-kepengurusan/aktif/route.ts` | `GET` daftar pengurus aktif (langkah "Pilih Pengurus") |
| `app/(protected)/keanggotaan/pemberhentian-pengurus/page.tsx` | Halaman 3 langkah khusus pemberhentian + riwayat + tabel pengajuan & aksi keputusan |

### File diubah

| File | Perubahan |
|---|---|
| `lib/anggota-kepengurusan.ts` | `ALASAN_PEMBERHENTIAN_OPTIONS` + helper validasi/label alasan |
| `lib/supabase.ts` | Tipe `AlasanPemberhentianEnum`; field `alasan_pemberhentian`/`keterangan_alasan` pada `AnggotaKepengurusan` & `CreateKepengurusanInput` |
| `lib/utils/kepengurusan-validation.ts` | Field & aturan alasan (wajib utk `berhentikan`; keterangan wajib saat `lainnya`; dokumen wajib saat `diberhentikan`) |
| `lib/server/kepengurusan-service.ts` | `listPengurusAktif()` (legacy-safe: sumber `posisi_kepengurusan` + detail histori) & `hasActivePengakhiranPengajuan()` (guard menyilang) |
| `app/api/anggota-kepengurusan/route.ts` | `GET` filter `jenis`; `POST`: pengecualian guard `ANGGOTA_BERHENTI` utk `berhentikan` (Q8), guard `ACTIVE_PENGAKHIRAN` (Q7), guard `INVALID_TANGGAL_EFEKTIF` (≥ mulai jabatan aktif), simpan alasan |
| `lib/hooks/use-anggota-kepengurusan-api.ts` | `useKepengurusanList` param `jenis`; hook baru `usePengurusAktifList` (+ tipe `PengurusAktifItem`) |
| `lib/supabase-storage.ts`, `app/api/upload/route.ts` | Folder bucket `anggota` → `sk-pemberhentian` |
| `config/menu.config.tsx` | Menu "Pemberhentian Pengurus" setelah "Perubahan Kepengurusan" (icon `UserMinus`, permission reuse) |
| `app/(protected)/keanggotaan/perubahan-kepengurusan/page.tsx` | Form mode `berhentikan` kini meminta alasan (select + keterangan saat `lainnya`), folder upload dinamis, review menampilkan alasan — satu sumber kebenaran dengan menu baru |
| `lib/utils/kepengurusan-validation.test.ts` | +6 tes alasan pemberhentian |

### Perilaku kunci

- **Langkah 1 baru**: daftar pengurus aktif (badge jabatan, periode/SK bila ada histori,
  penanda "pra-sistem" untuk legacy, tombol dinonaktifkan bila ada pengajuan berjalan /
  anggota meninggal).
- **Non-admin** → pengajuan `menunggu` (PC verifikasi → PP keputusan). **Admin** → jalur
  cepat self-approved + `applyKepengurusanApproval` (tutup jabatan lama + sync posisi,
  rollback bila gagal) — seluruhnya reuse tanpa perubahan.
- `status_anggota` / `status_keanggotaan` / `kategori_anggota` **tetap tidak disentuh**.
- Pemberhentian atas anggota yang keanggotaannya sudah `berhenti` diizinkan (penutupan
  administratif), namun **diblokir** bila masih ada **pengajuan** pengakhiran berjalan.

### Hasil validasi

- `npx tsc --noEmit` → bersih.
- `npm test` → **154/154 lulus** (termasuk 6 tes baru alasan pemberhentian).
- ESLint tidak dapat dijalankan di environment ini (toolchain `ajv`/`eslintrc` crash pada
  file apa pun, termasuk file lama yang tidak diubah) — bukan efek perubahan ini.
- **Migration `034` perlu dijalankan manual** di database Supabase (belum dieksekusi
  otomatis — pola §D.1 `docs/PROPOSAL_KEPUTUSAN_BISNIS_SIPATEL.md`).

---

> **Status: FASE 1 DIIMPLEMENTASIKAN dengan default §13 — menunggu konfirmasi klien untuk
> revisi nilai final (enum alasan, kewajiban dokumen, dsb.).**
> Migration `034` **wajib dijalankan** di database sebelum fitur dipakai: kolom
> `alasan_pemberhentian`/`keterangan_alasan` harus ada — bila belum, insert pengajuan akan
> gagal (kolom tidak dikenal).


