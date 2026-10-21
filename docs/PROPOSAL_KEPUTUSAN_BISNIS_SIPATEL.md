# SIPATEL — Proposal Keputusan Bisnis

> Dokumen ini merangkum hal-hal yang **sudah diimplementasikan** dan yang
> **masih membutuhkan keputusan/konfirmasi bisnis** sebelum diimplementasikan.
> Gunakan sebagai bahan diskusi dengan klien.

---

## A. SUDAH DIIMPLEMENTASIKAN (info untuk klien)

1. **Approval Create/Edit/Delete anggota** — perubahan data utama anggota oleh
   **cabang** kini melalui usulan (`anggota_perubahan`) dan baru berubah setelah
   **admin** menyetujui. Admin dapat langsung mengubah. Penolakan tidak mengubah
   data utama. Snapshot sebelum, usulan, pengaju, penyetuju, waktu & alasan tercatat.
2. **Soft delete** tetap dipakai; penghapusan anggota diblokir bila masih ada
   pengajuan Dana Kematian aktif (menjaga integritas transaksi historis).
3. **Riwayat mutasi anggota** — tercatat append-only (`anggota_mutasi`): cabang
   asal/tujuan, tanggal efektif, pengaju, penyetuju, alasan. Tidak pernah tertimpa.
4. **Dana Kematian**: konfigurasi dinamis dokumen wajib/opsional + batas masa
   kedaluwarsa (default 4 tahun) dikelola admin pusat & ber-riwayat; penguncian data
   pasca-submit; validasi urutan tanggal; claim/penugasan antar-cabang (race-safe);
   workflow verifikasi pusat dengan alasan wajib; ringkasan durasi proses.
5. **Import Excel & hapus massal** anggota kini **admin-only** (konsekuensi logis
   dari aturan approval — lihat butir C.4).

---

## B. SUDAH DIIMPLEMENTASIKAN & PERLU KONFIRMASI NILAI

### B.1 Batas masa kedaluwarsa pengajuan (default 4 tahun)
- **Status**: sudah dikelola admin pusat secara dinamis, nilai awal **4 tahun**
  (sesuai SKPP). Selisih tepat 4 tahun masih lolos; lewat 1 hari ditolak.
- **Konfirmasi**: apakah nilai awal 4 tahun sudah benar untuk seluruh kategori
  anggota (pegawai/istri/suami/anak)? Apakah perlu dibedakan per kategori?

### B.2 Deadline koreksi dokumen (saat ini 30 hari)

---

## C. BELUM DIIMPLEMENTASIKAN — PERLU KEPUTUSAN

### C.1 Resubmit setelah pengajuan DITOLAK
- **Kondisi saat ini**: pengajuan berstatus `ditolak` bersifat **final** — tidak bisa
  diedit/submit ulang langsung (`can_resubmit` default `false`).
- **Opsi**:
  1. Ditolak = final (klien mengajukan pengajuan baru dari awal).
  2. Izin submit ulang **sekali** bila kategori penolakan tertentu
     (mis. `document`/`eligibility`), tetapi kategori `fraud` tetap final.
  3. Izin submit ulang hanya dengan persetujuan Pusat (Pusat membuka kembali).
- **Rekomendasi**: **Opsi 2** — fleksibel untuk kasus dokumen kurang lengkap, namun
  tetap tegas untuk indikasi kecurangan (`fraud`). Perlu keputusan: kategori mana saja
  yang boleh resubmit, dan berapa kali maksimal.

### C.2 Kriteria "cabang yang memenuhi syarat" untuk meng-klaim pengajuan
- **Kondisi saat ini**: pengajuan berstatus awal (draft/dilaporkan/verifikasi_cabang)
  dapat diklaim oleh cabang mana pun yang melihatnya (selama belum diklaim cabang lain).
- **Opsi kriteria**:
  1. Hanya **cabang pelapor** (cabang tempat anggota meninggal dilaporkan).
  2. Cabang berdasarkan **keanggotaan aktif** almarhum (cabang tempat terdaftar).
  3. Cabang dalam **wilayah kerja** yang sama (regional/witel) dengan cabang pelapor.
  4. Bebas (cabang mana pun boleh klaim) — seperti sekarang.
- **Rekomendasi**: konfirmasi dulu definisi "berwenang". Untuk memulai, **Opsi 2**
  (cabang keanggotaan aktif) paling sesuai dengan prinsip kepemilikan data anggota;
  bila almarhum sudah mutasi, perlu aturan cabang mana yang menjadi pemilik proses.

### C.3 Alur mutasi anggota antar-cabang
- **Kondisi saat ini**: pencatatan riwayat mutasi sudah otomatis saat cabang aktif
  anggota berubah (melalui approval edit). Belum ada **form mutasi khusus**.
- **Usulan alur**:
  1. Cabang asal **atau** cabang tujuan mengajukan usulan mutasi (pilih anggota +
     cabang tujuan + tanggal efektif + alasan).
  2. Admin menyetujui/menolak (dengan alasan).
  3. Setelah disetujui: data **cabang aktif** anggota berubah, dan **riwayat cabang
     sebelumnya tetap tersimpan** (tidak tertimpa), mutasi tidak mengubah histori /
     transaksi Dana Kematian yang sudah terjadi.
- **Konfirmasi**: siapa yang berhak mengajukan (asal, tujuan, atau Pusat)? Apakah
  butuh persetujuan kedua cabang? Berapa lama proses efektif?

### C.4 Import Excel oleh cabang
- **Kondisi saat ini**: import Excel dibatasi **admin** (karena create non-admin wajib
  approval).
- **Opsi**:
  1. Tetap admin-only (cabang menambah anggota satu per satu via usulan).
  2. Import cabang menghasilkan **usulan massal** (satu usulan per baris) yang menunggu
     approval admin.
  3. Import cabang auto-approve (bertentangan dengan aturan approval — tidak disarankan).
- **Rekomendasi**: **Opsi 1** untuk sekarang; **Opsi 2** bila volume penambahan oleh
  cabang besar.

### C.5 Notifikasi untuk event baru
- **Status**: notifikasi workflow Dana Kematian & notifikasi anggota baru sudah ada.
  Belum ada notifikasi untuk: **usulan approval anggota baru/pending**, **keputusan
  approval**, **klaim/penugasan & pengalihan**.
- **Usulan**: tambahkan routing notifikasi (ke admin saat ada usulan menunggu; ke
  pengaju saat usulan diputuskan; ke cabang terkait saat penugasan dialihkan).
- **Konfirmasi**: target role penerima notifikasi (admin pusat? ketua? staff cabang?).

### C.6 Data historis `claim_status = 'tersedia'`
- **Kondisi**: baris Dana Kematian lama (sebelum migration 027) default
  `claim_status='tersedia'` dan `cabang_pemilik_kode` kosong; pemilik efektif saat ini
  dianggap **cabang pelapor** (`kode_cabang`).
- **Opsi**:
  1. Biarkan apa adanya (pemilik efektif = cabang pelapor) — **rekomendasi** (aman).
  2. Backfill `claim_status='diklaim'` + `cabang_pemilik_kode=kode_cabang` untuk baris
     lama agar konsisten dengan baris baru.
- **Konfirmasi**: apakah backfill diperlukan? (Rekomendasi: tidak perlu, kecuali ada
  kebutuhan laporan kepemilikan yang ketat.)

---

## D. TEKNIS — PERLU TINDAKAN (bukan keputusan klien)

1. **Jalankan migration** `027` dan `028` di database (Supabase/Postgres). Belum
   dieksekusi otomatis; `tsc`, unit test, dan `next build` sudah hijau.
2. **`anggota_history.changed_by`** saat ini selalu NULL karena trigger memakai
   `auth.uid()` (Supabase Auth) sedangkan aplikasi memakai Prisma Auth. Usulan teknis:
   ganti trigger agar membaca aktor dari kolom `data_perubahan`/parameter aplikasi
   (pola yang sama dengan audit Dana Kematian). Tidak butuh keputusan bisnis.
3. **Dokumentasi role/permission**: ada dua versi slug permission Dana Kematian
   (`dana_kematian_pc_*` underscore vs `dana_kematian.manage_pc` dot). Kode backend
   kini membaca keduanya; disarankan konsolidasi ke satu versi saat migrasi RBAC.

---

- **Status**: saat Pusat mengembalikan pengajuan untuk koreksi, sistem menetapkan
  batas waktu **30 hari** untuk submit ulang (hardcoded di backend).
- **Konfirmasi**: berapa nilai deadline yang benar menurut SKPP/aturan internal?
  (14/30/60 hari?) Apakah setelah lewat deadline otomatis batal/ditolak?

### B.3 Batas kewenangan nominal Ketua II (Rp 100 juta)
- **Status**: tertulis pada deskripsi role `ketua_ii` ("butuh approval Ketua I untuk
  amount > Rp 100 juta") tetapi **belum ditegakkan** di kode. Saat ini nominal Dana
  Kematian berkisar Rp 1,5–2 juta sehingga aturan ini praktis tidak relevan.
- **Konfirmasi**: apakah aturan nominal/eskalasi persetujuan masih dibutuhkan? Jika
  ya, berapa ambang nominalnya dan mekanismenya (approval 2 tingkat)?
