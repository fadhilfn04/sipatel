# Panduan Verifikasi Data PC ke PP
## Death Benefit System (Dana Kematian)

---

## 📋 Overview

Dokumen ini menjelaskan workflow lengkap verifikasi data yang dikirim oleh **PC (Pengurus Cabang)** kepada **PP (Pengurus Pusat)** dalam sistem Dana Kematian, sesuai dengan **Phase D: Verifikasi Pengajuan**.

---

## 🔄 Alur Verifikasi PC → PP

```
PC (Cabang)                PP (Pusat)
    │                           │
    │ 1. Submit Application     │
    ├──────────────────────────>│
    │   (Waktu-2)               │
    │                           │
    │                           │ 2. Receive & Log
    │                           │   (Waktu-2)
    │                           │
    │                           │ 3. Assign Validator
    │                           │
    │                           │ 4. Verify Documents
    │                           │   (Berkas-2)
    │                           │
    │                           │ 5. Check Eligibility
    │                           │
    │                           │ 6. Calculate Benefit
    │                           │
    │                           │ 7. Decision:
    │                           │   - Approve → Verified
    │                           │   - Return → Pending Docs
    │                           │   - Reject → Ditolak
    │                           │
    │ 8. Notification            │
    │<───────────────────────────┤
    │   (Result)                 │
    │                           │
    │ 9. Next Phase              │
    │   (If approved)            │
```

---

## 📝 Detail Langkah Verifikasi

### Step 1: PC Submit Application ke PP

**Waktu**: Waktu-2
**Status**: `verifikasi_cabang` → `proses_pusat`

PC mengirim aplikasi lengkap ke PP setelah:
- ✅ Dokumen lengkap (Berkas-2)
- ✅ Validasi PC selesai
- ✅ `cabang_tanggal_kirim_ke_pusat` diisi

**Fields yang diisi PC**:
```typescript
{
  cabang_tanggal_kirim_ke_pusat: "2026-04-25",
  status_proses: "proses_pusat",
  is_validated_pc: true,
  cabang_status_kelengkapan: "lengkap"
}
```

---

### Step 2: PP Menerima dan Mencatat Application

**Waktu**: Waktu-2 (PP side)
**Actor**: PP Staff

PP mencatat penerimaan:
```typescript
{
  pusat_tanggal_awal_terima: new Date().toISOString(),
  pusat_nomor_referensi: "DAKEM-PP-2026-XXXX"
}
```

**Action**: Update via API atau sistem

---

### Step 3: PP Menugaskan Validator

**Process**:
1. PP admin menugaskan validator
2. Validator mendapat notifikasi
3. Case muncul di dashboard validator

**Assignment**:
```typescript
{
  pusat_petugas_validator: validatorName,
  pusat_petugas_validator_id: validatorUserId
}
```

---

### Step 4: PP Memverifikasi Dokumen (Berkas-2)

**Dokumen yang harus diperiksa**:

#### A. Surat Kematian
- [ ] Ada dan terbaca dengan jelas
- [ ] Nama almarhum sesuai dengan data anggota
- [ ] Tanggal meninggal sesuai
- [ ] Ada cap/stempel resmi
- [ ] Ditandatangani pejabat berwenang

#### B. SK Pensiun
- [ ] Nomor SK pensiun valid
- [ ] Nama anggota sesuai
- [ ] Masa berlaku masih berlaku
- [ ] Ada cap/stempel instansi penerbit

#### C. Surat Pernyataan Ahli Waris
- [ ] Ditandatangani ahli waris
- [ ] Ada materai (jika diperlukan)
- [ ] Jelas menyatakan status sebagai ahli waris
- [ ] Tanggal pembuatan masih berlaku

#### D. Kartu Keluarga
- [ ] Nomor KK valid
- [ ] Nama almarhum tercantum
- [ ] Nama ahli waris tercantum
- [ ] Hubungan keluarga jelas
- [ ] Data lain sesuai dengan dokumen lain

#### E. E-KTP Ahli Waris
- [ ] NIK sesuai dengan KK
- [ ] Nama sesuai dengan KK
- [ ] Foto jelas terlihat
- [ ] KTP masih berlaku (tidak expired)
- [ ] Alamat sesuai

#### F. Buku Rekening
- [ ] Atas nama ahli waris
- [ ] Rekening aktif
- [ ] Nama bank dan nomor rekening jelas
- [ ] Ada bukti kepemilikan

**Action**: Centang ✅ atau ❌ di sistem verifikasi

---

### Step 5: PP Memeriksa Eligibility

**Pemeriksaan yang harus dilakukan**:

#### A. Eligibility Anggota
- [ ] **Status Anggota**: Pegawai/Pensiunan/Istri/Suami/Anak
- [ ] **Status MPS**: MPS (1.5x) atau Non-MPS (1.0x)
- [ ] **Tanggal Meninggal**: Sesuai dengan laporan
- [ ] **No. Anggota**: Valid dan terdaftar

#### B. Eligibility Ahli Waris
- [ ] **Hubungan**: Suami/Istri/Anak (prioritas) atau Keluarga lain
- [ ] **Usia**: Dewasa atau punya guardian (jika minor)
- [ ] **NIK**: Sesuai dengan KK dan valid
- [ ] **Alamat**: Ada dan dapat dihubungi

#### C. Legalitas
- [ ] **Tidak ada klaim ganda**: Cek di sistem
- [ ] **Batas waktu**: Dalam batas 90 hari sejak tanggal meninggal
- [ ] **Tidak ada fraud**: Dokumen terlihat asli dan konsisten

**Action**: Centang semua eligibility checks

---

### Step 6: PP Menghitung Benefit Amount

**Rumus Perhitungan**:
```
Base Amount:
- PNS/Pensiunan: Rp 15.000.000
- CPNS: Rp 10.000.000
- THL: Rp 5.000.000

MPS Multiplier:
- MPS: × 1.5
- Non-MPS: × 1.0

Heir Relationship Adjustment:
- Suami/Istri/Anak: × 1.0
- Orang Tua: × 0.75
- Keluarga Lain: × 0.5

Final Amount = Base Amount × MPS Multiplier × Heir Adjustment
```

**Contoh Perhitungan**:
```
Anggota: Pensiunan, MPS
Ahli Waris: Istri

Base: Rp 15.000.000
MPS: × 1.5
Heir: × 1.0

Total: Rp 15.000.000 × 1.5 × 1.0 = Rp 22.500.000
```

**Action**: Input hasil perhitungan di sistem

---

### Step 7: PP Membuat Keputusan

Berdasarkan hasil verifikasi, PP punya 3 opsi:

#### Opsi A: APPROVE (Setujui)
**Syarat**:
- ✅ Semua dokumen lengkap dan verified
- ✅ Semua eligibility checks passed
- ✅ Perhitungan benefit selesai

**Action**:
```typescript
{
  status_proses: "verified",
  waktu_3: new Date().toISOString(),
  is_validated_pp: true,
  is_approved: true,
  besaran_dana_kematian: calculatedAmount
}
```

**Result**: Lanjut ke Phase E (Finalisasi)

---

#### Opsi B: RETURN TO PC (Kembalikan untuk perbaikan)
**Syarat**:
- ⚠️ Ada dokumen yang perlu diperbaiki
- ⚠️ Ada informasi yang kurang lengkap
- ⚠️ Bisa diperbaiki dalam waktu tertentu

**Action**:
```typescript
{
  status_proses: "pending_dokumen",
  waktu_3: new Date().toISOString(),
  pusat_catatan_verifikasi: "Detail item yang perlu diperbaiki...",
  can_resubmit: true,
  resubmission_deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
}
```

**Result**: PC mendapat notifikasi untuk memperbaiki dokumen

---

#### Opsi C: REJECT (Tolak)
**Syarat**:
- ❌ Tidak eligible (bukan hak menerima dana)
- ❌ Indikasi fraud atau dokumen palsu
- ❌ Ada klaim ganda
- ❌ Lewat batas waktu (90+ hari)

**Action**:
```typescript
{
  status_proses: "ditolak",
  waktu_3: new Date().toISOString(),
  rejection_reason: "Alasan penolakan detail...",
  rejection_category: "eligibility" | "document" | "fraud" | "timeout",
  can_resubmit: false
}
```

**Result**: Proses berhenti, PC dan ahli waris mendapat notifikasi penolakan

---

### Step 8: PP Memberitahukan Hasil ke PC

**Method**: Notifikasi sistem + Email (jika ada)

**Jika Approved**:
```
Subject: ✅ Dana Kematian Approved - [Nama Anggota]
Content:
Pengajuan dana kematian untuk [Nama Anggota] telah disetujui.
Nomor Referensi: DAKEM-PP-2026-XXXX
Besaran Dana: Rp [Amount]
Selanjutnya: Dana akan ditransfer ke rekening PC
```

**Jika Returned**:
```
Subject: ⚠️ Dana Kematian - Perlu Perbaikan
Content:
Pengajuan dana kematian untuk [Nama Anggota] perlu perbaikan.
Catatan: [Detail perbaikan]
Deadline: [Tanggal]
Silakan perbaiki dan ajukan kembali.
```

**Jika Rejected**:
```
Subject: ❌ Dana Kematian Rejected - [Nama Anggota]
Content:
Pengajuan dana kematian untuk [Nama Anggota] ditolak.
Alasan: [Detail alasan]
Status: Tidak dapat diajukan kembali.
```

---

### Step 9: Lanjut ke Phase Berikutnya

**Jika Approved**:
- Status berubah ke `verified`
- Waktu-3 tercatat
- Lanjut ke **Phase E: Finalisasi Pengajuan**
- Finance department memproses transfer dana

**Jika Returned**:
- Status kembali ke `pending_dokumen`
- PC dapat memperbaiki dan resubmit
- Proses verifikasi diulang

**Jika Rejected**:
- Status menjadi `ditolak`
- Proses berhenti
- PC dan ahli waris mendapat penjelasan

---

## 🎯 Implementasi di Sistem

### 1. Halaman Verifikasi PP

**URL**: `/keuangan/dana-kematian/verification/[id]`

**Features**:
- 📄 Tab Documents: Verifikasi semua dokumen
- ✅ Tab Eligibility: Check eligibility requirements
- 💰 Tab Calculation: Hitung dan verifikasi benefit amount
- 🎯 Tab Approval: Buat keputusan (approve/return/reject)

### 2. API Endpoint

**Endpoint**: `POST /api/dana-kematian/[id]/verify`

**Request Body**:
```typescript
{
  approved: boolean,
  rejectionReason?: string,
  rejectionCategory?: string,
  notes: string,
  verifiedBy: string,
  verifiedAt: Date,
  benefitAmount?: number,
  documentVerifications?: {
    [docKey: string]: {
      verified: boolean,
      notes: string
    }
  },
  eligibilityChecks?: {
    [checkKey: string]: boolean
  }
}
```

**Response**:
```typescript
{
  success: true,
  claim: DanaKematian,
  message: "Pengajuan berhasil diverifikasi dan disetujui"
}
```

### 3. Update Status Flow

```typescript
// PC submits to PP
status_proses: "verifikasi_cabang" → "proses_pusat"
waktu_2: cabang_tanggal_kirim_ke_pusat

// PP verifies
waktu_3: pusat_tanggal_validasi

// PP decision
if (approved) {
  status_proses: "verified"
  is_validated_pp: true
  is_approved: true
} else if (returned) {
  status_proses: "pending_dokumen"
  can_resubmit: true
} else if (rejected) {
  status_proses: "ditolak"
  can_resubmit: false
}
```

---

## ✅ Checklist Verifikasi PP

### Sebelum Approve:
- [ ] Semua 6 dokumen utama ada dan verified
- [ ] Semua eligibility checks passed
- [ ] Benefit amount dihitung dengan benar
- [ ] Tidak ada indikasi fraud
- [ ] Tidak ada klaim ganda
- [ ] Dalam batas waktu pengajuan

### Saat Return ke PC:
- [ ] Catat detail dokumen/perbaikan yang diperlukan
- [ ] Set deadline resubmit (maksimal 30 hari)
- [ ] Berikan penjelasan yang jelas
- [ ] Update status ke `pending_dokumen`

### Saat Reject:
- [ ] Catat alasan penolakan secara detail
- [ ] Pilih kategori penolakan yang tepat
- [ ] Tentukan apakah bisa resubmit
- [ ] Update status ke `ditolak`
- [ ] Kirim notifikasi ke PC

---

## 🔧 Troubleshooting

### Issue: Dokumen tidak terbaca
**Solution**: Request clear scan dari PC

### Issue: Nama tidak cocok antar dokumen
**Solution**: Return ke PC untuk konfirmasi

### Issue: NIK tidak valid
**Solution**: Cross-check dengan Dukcapil jika memungkinkan

### Issue: Tanggal meninggal tidak logis
**Solution**: Konfirmasi dengan PC dan keluarga

### Issue: Ahli waris minor (di bawah 17 tahun)
**Solution**: Cek apakah ada guardian resmi

---

## 📊 Performance Metrics

PP harus menyelesaikan verifikasi dalam:
- **Target**: 5 hari kerja sejak Waktu-2
- **Maksimum**: 7 hari kerja

**Tracking**:
```sql
-- PP verification performance
SELECT
  dk.id,
  dk.nama_anggota,
  dk.cabang_asal_melapor,
  dk.waktu_2 AS "received_from_pc",
  dk.waktu_3 AS "verified_at",
  EXTRACT(DAY FROM (dk.waktu_3 - dk.waktu_2)) AS "verification_days"
FROM dana_kematian dk
WHERE dk.status_proses IN ('verified', 'ditolak')
ORDER BY dk.waktu_3 DESC;
```

---

## 📞 Kontak & Support

Untuk pertanyaan mengenai proses verifikasi:
- **PP Admin**: [Contact PP Admin]
- **System Support**: [Contact IT Support]
- **Procedure Manual**: [Link to SOP]

---

**Document Version**: 1.0  
**Last Updated**: 2026-04-25  
**Status**: Active Implementation