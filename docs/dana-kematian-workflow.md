# Dana Kematian - Business Process Workflow

## Overview
Sistem manajemen Dana Kematian P2TEL mengelola proses klaim dana kematian anggota dari pelaporan hingga penyaluran dana ke ahli waris.

---

## 1. SYSTEM WORKFLOW

### 1.1. Process Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        DANA KEMATIAN WORKFLOW                               │
└─────────────────────────────────────────────────────────────────────────────┘

[ANGGOTA]          [KELUARGA/AHLI WARIS]    [CABANG (PC)]         [PUSAT (PP)]
    │                      │                      │                      │
    │  1. Meninggal        │                      │                      │
    │                      │                      │                      │
    │                      │  2. Kumpulkan Dokumen│                      │
    │                      │     - Surat Kematian │                      │
    │                      │     - SK Pensiun     │                      │
    │                      │     - Ahli Waris     │                      │
    │                      │     - KK, KTP, dll   │                      │
    │                      │                      │                      │
    │                      │  3. Lapor ke Cabang  │                      │
    │                      ├─────────────────────>│                      │
    │                      │                      │                      │
    │                      │                      │  4. Terima & Verifikasi│
    │                      │                      │     - Kelengkapan     │
    │                      │                      │     - Keabsahan       │
    │                      │                      │     - Rekening        │
    │                      │                      │                      │
    │                      │                      │  5. Kirim ke Pusat    │
    │                      │                      ├─────────────────────>│
    │                      │                      │                      │
    │                      │                      │                      │  6. Validasi
    │                      │                      │                      │     - Verifikasi Ulang
    │                      │                      │                      │     - Persetujuan
    │                      │                      │                      │     - Kalkulasi Dana
    │                      │                      │                      │
    │                      │                      │                      │  7. Transfer Dana
    │                      │                      │                      │     PP → PC
    │                      │                      │<─────────────────────┤
    │                      │                      │                      │
    │                      │                      │  8. Serah ke Ahli Waris│
    │                      │<─────────────────────┤                      │
    │                      │                      │                      │
    │                      │  9. Terima Dana      │                      │
    │                      │                      │                      │
    │                      │ 10. Tanda Terima     │                      │
    │                      ├─────────────────────>│                      │
    │                      │                      │                      │
    │                      │                      │ 11. Lapor ke Pusat    │
    │                      │                      ├─────────────────────>│
    │                      │                      │                      │
    │                      │                      │                      │ 12. Tutup Case
    │                      │                      │                      │
    └──────────────────────┴──────────────────────┴──────────────────────┘
```

### 1.2. Detailed Process Steps

#### STAGE 1: DILAPORKAN (Reported)
- **Trigger**: Keluarga melapor ke cabang dengan dokumen
- **Actor**: Keluarga/Ahli Waris → Cabang
- **Activities**:
  1. Terima laporan kematian dari keluarga
  2. Catat data pelapor (nama, NIK, kontak)
  3. Input data awal ke sistem
  4. Upload dokumen pendukung
- **Output**: Status = `dilaporkan`
- **Timestamp**: `tanggal_lapor_keluarga`

#### STAGE 2: VERIFIKASI CABANG (Branch Verification)
- **Trigger**: Dokumen lengkap diterima cabang
- **Actor**: Petugas Cabang
- **Activities**:
  1. Periksa kelengkapan dokumen:
     - Surat Kematian dari RS/Desa
     - SK Pensiun asli
     - Surat Pernyataan Ahli Waris bermaterai
     - Kartu Keluarga
     - KTP Ahli Waris
     - Surat Nikah (jika diperlukan)
  2. Verifikasi keabsahan dokumen
  3. Konfirmasi hubungan ahli waris
  4. Validasi rekening tujuan
  5. Request data tambahan jika kurang
  6. Buat berkas verifikasi cabang
- **Output**: Status = `verifikasi_cabang`
- **Timestamps**:
  - `cabang_tanggal_awal_terima_berkas`
  - `cabang_tanggal_kirim_ke_pusat`

#### STAGE 3: PROSES PUSAT (Central Processing)
- **Trigger**: Berkas diterima pusat
- **Actor**: Tim Verifikasi Pusat
- **Activities**:
  1. Terima berkas dari cabang
  2. Verifikasi ulang kelengkapan
  3. Cross-check dengan database anggota
  4. Validasi status keanggotaan
  5. Hitung besaran dana kematian:
     - Berdasarkan kategori anggota
     - Berdasarkan masa kerja
     - Berdasarkan status MPS
  6. Proses persetujuan:
     - Review oleh supervisor
     - Approval oleh manager
     - Generate instruksi pembayaran
  7. Transfer dana ke rekening cabang
- **Output**: Status = `proses_pusat`
- **Timestamps**:
  - `pusat_tanggal_awal_terima`
  - `pusat_tanggal_validasi`
  - `pusat_tanggal_selesai`

#### STAGE 4: SELESAI (Completed)
- **Trigger**: Dana diserahkan ke ahli waris
- **Actor**: Cabang → Ahli Waris → Pusat
- **Activities**:
  1. Terima dana dari pusat di rekening cabang
  2. Jadwalkan penyerahan ke ahli waris
  3. Serah dana kepada ahli waris:
     - Tanda tangan buku tabungan
     - Tanda tangan surat kuasa penarikan
     - Foto dokumentasi
  4. Ahli waris buat surat pernyataan penerimaan
  5. Cabang buat laporan penyaluran
  6. Submit bukti penyaluran ke pusat
  7. Pusat tutup case
- **Output**: Status = `selesai`
- **Timestamps**:
  - `cabang_tanggal_serah_ke_ahli_waris`
  - `cabang_tanggal_lapor_ke_pusat`

### 1.3. Required Documents Checklist

| Dokumen | Wajib | Deskripsi | Validasi |
|---------|-------|-----------|----------|
| Surat Kematian | ✓ | Dari RS/Puskesmas/Desa | Nama sesuai, tanggal jelas |
| SK Pensiun | ✓ | Asli, fotokopi legalisir | Nomor SK terbaca |
| Surat Ahli Waris | ✓ | Bermeterai Rp 10.000 | Tertanda ahli waris & saksi |
| Kartu Keluarga | ✓ | Fotokopi | Nama ahli waris tercantum |
| KTP Ahli Waris | ✓ | Fotokopi | Masih berlaku |
| Surat Nikah | Opsional | Jika ada istri/anak | Bukti hubungan keluarga |
| Buku Rekening | ✓ | Rekening aktif | Atas nama ahli waris |
| Surat Kuasa | Opsional | Jika diwakilkan | Bermaterai dan ditandatangani |

---

## 2. STATE MACHINE

### 2.1. State Transitions

```typescript
type DanaKematianStatus =
  | 'dilaporkan'        // Initial state
  | 'verifikasi_cabang' // Verified by branch
  | 'proses_pusat'      // Being processed by center
  | 'selesai'           // Completed
  | 'ditolak'          // Rejected
  | 'pending_dokumen'; // Awaiting additional documents
```

### 2.2. Transition Rules

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         STATE TRANSITION MATRIX                        │
├───────────────────┬──────────────────────────────────────────────────┤
│ CURRENT STATE     │ VALID NEXT STATES                                │
├───────────────────┼──────────────────────────────────────────────────┤
│ dilaporkan        │ → verifikasi_cabang (docs complete)            │
│                   │ → pending_dokumen (docs incomplete)             │
│                   │ → ditolak (invalid claim)                       │
├───────────────────┼──────────────────────────────────────────────────┤
│ pending_dokumen   │ → verifikasi_cabang (docs received)             │
│                   │ → ditolak (timeout/invalid)                     │
├───────────────────┼──────────────────────────────────────────────────┤
│ verifikasi_cabang │ → proses_pusat (approved)                       │
│                   │ → dilaporkan (returned for correction)           │
│                   │ → ditolak (rejected)                            │
├───────────────────┼──────────────────────────────────────────────────┤
│ proses_pusat      │ → selesai (funds transferred & distributed)     │
│                   │ → verifikasi_cabang (returned for info)         │
│                   │ → ditolak (failed verification)                 │
├───────────────────┼──────────────────────────────────────────────────┤
│ selesai           │ → (terminal state)                              │
├───────────────────┼──────────────────────────────────────────────────┤
│ ditolak          │ → dilaporkan (resubmitted with new evidence)    │
│                   │ → (terminal state)                              │
└───────────────────┴──────────────────────────────────────────────────┘
```

### 2.3. State Implementation

```typescript
interface StateTransition {
  from: DanaKematianStatus;
  to: DanaKematianStatus;
  condition: (claim: DanaKematian) => boolean;
  action: (claim: DanaKematian, actor: User) => Promise<void>;
}

const transitions: StateTransition[] = [
  // dilaporkan → verifikasi_cabang
  {
    from: 'dilaporkan',
    to: 'verifikasi_cabang',
    condition: (claim) => {
      return allDocumentsComplete(claim) &&
             claim.cabang_tanggal_awal_terima_berkas !== null;
    },
    action: async (claim, actor) => {
      await updateClaim(claim.id, {
        status_proses: 'verifikasi_cabang',
        cabang_tanggal_kirim_ke_pusat: new Date(),
        verified_by: actor.id,
        verified_at: new Date()
      });
    }
  },

  // verifikasi_cabang → proses_pusat
  {
    from: 'verifikasi_cabang',
    to: 'proses_pusat',
    condition: (claim) => {
      return claim.pusat_tanggal_awal_terima !== null;
    },
    action: async (claim, actor) => {
      const amount = calculateBenefitAmount(claim);
      await updateClaim(claim.id, {
        status_proses: 'proses_pusat',
        besaran_dana_kematian: amount,
        pusat_tanggal_validasi: new Date(),
        approved_by: actor.id,
        approved_at: new Date()
      });
      // Initiate transfer to branch
      await initiateTransfer(claim.id, amount);
    }
  },

  // proses_pusat → selesai
  {
    from: 'proses_pusat',
    to: 'selesai',
    condition: (claim) => {
      return claim.cabang_tanggal_serah_ke_ahli_waris !== null &&
             claim.cabang_tanggal_lapor_ke_pusat !== null;
    },
    action: async (claim, actor) => {
      await updateClaim(claim.id, {
        status_proses: 'selesai',
        pusat_tanggal_selesai: new Date(),
        closed_by: actor.id,
        closed_at: new Date()
      });
      await closeFinancialRecord(claim.id);
    }
  }
];
```

---

## 3. ENTITY MODELS

### 3.1. Core Entities

```typescript
// =====================================================
// MAIN ENTITY
// =====================================================

interface DanaKematian {
  // Primary
  id: string;
  anggota_id: string | null;

  // Member Data
  nama_anggota: string;
  status_anggota: StatusAnggotaEnum;
  status_mps: StatusMpsEnum;
  nikap: string;

  // Death Data
  tanggal_meninggal: string;
  penyebab_meninggal: string | null;
  tempat_meninggal: string | null;

  // Reporting Data
  tanggal_lapor_keluarga: string | null;
  cabang_asal_melapor: string;
  cabang_nama_pelapor: string | null;
  cabang_nik_pelapor: string | null;
  cabang_kontak_pelapor: string | null;

  // Branch Processing
  cabang_tanggal_awal_terima_berkas: string | null;
  cabang_tanggal_kirim_ke_pusat: string | null;
  cabang_petugas_verifikator: string | null;
  cabang_catatan_verifikasi: string | null;
  cabang_status_kelengkapan: 'lengkap' | 'kurang' | 'tidak_lengkap' | null;

  // Central Processing
  pusat_tanggal_awal_terima: string | null;
  pusat_tanggal_validasi: string | null;
  pusat_tanggal_selesai: string | null;
  pusat_petugas_validator: string | null;
  pusat_petugas_approver: string | null;
  pusat_nomor_referensi: string | null;

  // Financial Data
  besaran_dana_kematian: number;
  kategori_dana: 'rutin' | 'khusus' | null;
  metode_penyaluran: 'transfer' | 'tunai' | null;
  rekening_tujuan: string | null;
  bank_tujuan: string | null;

  // Distribution Data
  cabang_tanggal_serah_ke_ahli_waris: string | null;
  cabang_tanggal_lapor_ke_pusat: string | null;
  cabang_petugas_penyerah: string | null;
  cabang_bukti_penyerahan: string | null; // file URL

  // Heir Data
  nama_ahli_waris: string;
  status_ahli_waris: StatusAhliWarisEnum;
  nik_ahli_waris: string | null;
  alamat_ahli_waris: string | null;
  no_hp_ahli_waris: string | null;

  // Document Files
  file_sk_pensiun: string | null;
  file_surat_kematian: string | null;
  file_surat_pernyataan_ahli_waris: string | null;
  file_kartu_keluarga: string | null;
  file_e_ktp: string | null;
  file_surat_nikah: string | null;
  file_buku_rekening: string | null;
  file_surat_kuasa: string | null;
  file_lainnya: string[] | null;

  // Process Status
  status_proses: StatusProsesDakemEnum;
  alasan_penolakan: string | null;
  dokumen_kurang: string[] | null;

  // Metadata
  keterangan: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

// =====================================================
// SUPPORTING ENTITIES
// =====================================================

interface DokumenKematian {
  id: string;
  dana_kematian_id: string;
  jenis_dokumen: JenisDokumenEnum;
  nama_file: string;
  url_file: string;
  diupload_oleh: string;
  tanggal_upload: string;
  status_verifikasi: 'valid' | 'invalid' | 'pending' | 'perlu_perbaikan';
  catatan_verifikasi: string | null;
}

interface RiwayatProsesDakem {
  id: string;
  dana_kematian_id: string;
  status_dari: StatusProsesDakemEnum;
  status_ke: StatusProsesDakemEnum;
  actor_id: string;
  actor_role: 'cabang' | 'pusat' | 'system';
  catatan: string;
  timestamp: string;
}

interface PerhitunganDana {
  dana_kematian_id: string;
  kategori_anggota: string;
  masa_kerja_tahun: number;
  status_mps: string;
  dasar_perhitungan: number;
  tambahan_keluarga: number;
  total_dana: number;
  rumus_perhitungan: string;
  dihitung_oleh: string;
  tanggal_perhitungan: string;
}

// =====================================================
// TYPES & ENUMS
// =====================================================

type StatusProsesDakemEnum =
  | 'dilaporkan'
  | 'pending_dokumen'
  | 'verifikasi_cabang'
  | 'proses_pusat'
  | 'penyaluran'
  | 'selesai'
  | 'ditolak';

type JenisDokumenEnum =
  | 'surat_kematian'
  | 'sk_pensiun'
  | 'surat_ahli_waris'
  | 'kartu_keluarga'
  | 'ktp_ahli_waris'
  | 'surat_nikah'
  | 'buku_rekening'
  | 'surat_kuasa'
  | 'lainnya';

type StatusAhliWarisEnum =
  | 'istri'
  | 'suami'
  | 'anak'
  | 'orang_tua'
  | 'saudara_kandung'
  | 'keluarga_lainnya';

type KategoriDanaEnum =
  | 'rutin'
  | 'khusus'
  | 'premi'
  | 'lainnya';
```

### 3.2. Request/Response Models

```typescript
// =====================================================
// API REQUEST/RESPONSE MODELS
// =====================================================

interface CreateDanaKematianInput {
  anggota_id?: string;
  nama_anggota: string;
  status_anggota: StatusAnggotaEnum;
  status_mps: StatusMpsEnum;
  tanggal_meninggal: string;
  penyebab_meninggal?: string;
  tanggal_lapor_keluarga?: string;
  cabang_asal_melapor: string;
  cabang_nama_pelapor?: string;
  cabang_nik_pelapor?: string;
  nama_ahli_waris: string;
  status_ahli_waris: StatusAhliWarisEnum;
  file_sk_pensiun?: string;
  file_surat_kematian?: string;
  file_surat_pernyataan_ahli_waris?: string;
  file_kartu_keluarga?: string;
  file_e_ktp?: string;
  file_surat_nikah?: string;
  keterangan?: string;
}

interface UpdateDanaKematianInput {
  // Branch Updates
  cabang_tanggal_awal_terima_berkas?: string;
  cabang_tanggal_kirim_ke_pusat?: string;
  cabang_status_kelengkapan?: 'lengkap' | 'kurang' | 'tidak_lengkap';
  cabang_catatan_verifikasi?: string;
  dokumen_kurang?: string[];

  // Central Updates
  pusat_tanggal_awal_terima?: string;
  pusat_tanggal_validasi?: string;
  pusat_tanggal_selesai?: string;
  besaran_dana_kematian?: number;

  // Distribution Updates
  cabang_tanggal_serah_ke_ahli_waris?: string;
  cabang_tanggal_lapor_ke_pusat?: string;
  cabang_bukti_penyerahan?: string;

  // Status Updates
  status_proses?: StatusProsesDakemEnum;
  alasan_penolakan?: string;

  // Heir Updates
  nama_ahli_waris?: string;
  status_ahli_waris?: StatusAhliWarisEnum;
  nik_ahli_waris?: string;
  alamat_ahli_waris?: string;
  no_hp_ahli_waris?: string;

  // Document Updates
  file_sk_pensiun?: string;
  file_surat_kematian?: string;
  file_surat_pernyataan_ahli_waris?: string;
  file_kartu_keluarga?: string;
  file_e_ktp?: string;
  file_surat_nikah?: string;
  file_buku_rekening?: string;
  file_surat_kuasa?: string;

  keterangan?: string;
}

interface DanaKematianFilter {
  search?: string;
  status_proses?: StatusProsesDakemEnum;
  cabang_asal_melapor?: string;
  tanggal_meninggal_from?: string;
  tanggal_meninggal_to?: string;
  tanggal_lapor_from?: string;
  tanggal_lapor_to?: string;
  page?: number;
  limit?: number;
}

interface DanaKematianResponse {
  data: DanaKematian[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  summary: {
    totalClaims: number;
    byStatus: Record<StatusProsesDakemEnum, number>;
    totalDanaDisetujui: number;
    totalDanaDisalurkan: number;
    avgProcessingDays: number;
  };
}
```

---

## 4. API STRUCTURE

### 4.1. Endpoints Overview

```
/api/dana-kematian
├── GET    /                          # List all claims
├── POST   /                          # Create new claim
├── GET    /[id]                      # Get claim detail
├── PUT    /[id]                      # Update claim
├── DELETE /[id]                      # Soft delete claim
├── POST   /[id]/transition           # Change status with validation
├── POST   /[id]/documents            # Upload document
├── GET    /[id]/history              # Get process history
├── POST   /[id]/calculate            # Calculate benefit amount
├── POST   /[id]/approve              # Approve claim (central)
├── POST   /[id]/reject               # Reject claim
└── POST   /[id]/distribute           # Mark as distributed

/api/dana-kematian/documents
├── GET    /                          # List document types
├── GET    /required                  # Get required docs checklist
└── POST   /[id]/verify               # Verify document

/api/dana-kematian/workflow
├── GET    /states                    # Get all possible states
├── GET    /transitions               # Get valid transitions
└── GET    /[id]/next-states          # Get next valid states for claim

/api/dana-kematian/statistics
├── GET    /overview                  # Overview statistics
├── GET    /by-cabang                 # Statistics by branch
├── GET    /by-status                 # Statistics by status
├── GET    /processing-time           # Average processing time
└── GET    /financial-summary         # Financial summary

/api/dana-kematian/reports
├── GET    /monthly                   # Monthly report
├── GET    /by-cabang/[cabang]        # Report by branch
└── GET    /outstanding               # Outstanding claims
```

### 4.2. Detailed API Specifications

```typescript
// =====================================================
// MAIN CRUD ENDPOINTS
// =====================================================

// GET /api/dana-kematian
// List all dana kematian claims with filtering
interface GetDanaKematianParams {
  search?: string;
  status_proses?: StatusProsesDakemEnum;
  cabang_asal_melapor?: string;
  tanggal_meninggal_from?: string;
  tanggal_meninggal_to?: string;
  page?: number;
  limit?: number;
}

// POST /api/dana-kematian
// Create new dana kematian claim
interface CreateDanaKematianBody extends CreateDanaKematianInput {}

// GET /api/dana-kematian/[id]
// Get detailed claim information
interface GetDanaKematianDetailResponse {
  claim: DanaKematian;
  documents: DokumenKematian[];
  history: RiwayatProsesDakem[];
  calculation?: PerhitunganDana;
  nextStates: StatusProsesDakemEnum[];
  requiredActions: string[];
}

// PUT /api/dana-kematian/[id]
// Update claim information
interface UpdateDanaKematianBody extends UpdateDanaKematianInput {}

// DELETE /api/dana-kematian/[id]
// Soft delete claim (only if status = 'dilaporkan')

// =====================================================
// WORKFLOW ENDPOINTS
// =====================================================

// POST /api/dana-kematian/[id]/transition
// Transition claim to next state with validation
interface TransitionStateBody {
  to_status: StatusProsesDakemEnum;
  catatan?: string;
  dokumen_tambahan?: Record<string, string>;
  actor_id: string;
  actor_role: 'cabang' | 'pusat';
}

interface TransitionStateResponse {
  success: boolean;
  message: string;
  claim: DanaKematian;
  history: RiwayatProsesDakem;
  required_actions?: string[];
}

// GET /api/dana-kematian/[id]/history
// Get complete process history
interface GetHistoryResponse {
  history: RiwayatProsesDakem[];
  current_status: StatusProsesDakemEnum;
  duration_in_current_state: number;
  total_duration: number;
}

// POST /api/dana-kematian/[id]/calculate
// Calculate benefit amount
interface CalculateBenefitBody {
  kategori_anggota: string;
  masa_kerja_tahun: number;
  status_mps: string;
  jumlah_tanggungan: number;
}

interface CalculateBenefitResponse {
  besaran_dana: number;
  rincian_perhitungan: {
    dasar_perhitungan: number;
    tambahan_keluarga: number;
    tambahan_mps: number;
    total: number;
  };
  rumus: string;
}

// POST /api/dana-kematian/[id]/approve
// Approve claim (central office only)
interface ApproveClaimBody {
  approved_by: string;
  besaran_dana: number;
  catatan?: string;
  no_referensi: string;
}

// POST /api/dana-kematian/[id]/reject
// Reject claim with reason
interface RejectClaimBody {
  rejected_by: string;
  alasan_penolakan: string;
  dapat_diajukan_ulang: boolean;
}

// POST /api/dana-kematian/[id]/distribute
// Mark claim as distributed to heir
interface DistributeClaimBody {
  tanggal_penyerahan: string;
  petugas_penyerah: string;
  bukti_penyerahan: string;
  tanda_terima_ahli_waris: string;
}

// =====================================================
// DOCUMENT ENDPOINTS
// =====================================================

// POST /api/dana-kematian/[id]/documents
// Upload document for claim
interface UploadDocumentBody {
  jenis_dokumen: JenisDokumenEnum;
  nama_file: string;
  url_file: string;
}

interface UploadDocumentResponse {
  document: DokumenKematian;
  kelengkapan: {
    total_required: number;
    total_uploaded: number;
    is_complete: boolean;
    missing_documents: JenisDokumenEnum[];
  };
}

// GET /api/dana-kematian/documents/required
// Get required documents checklist
interface RequiredDocumentsResponse {
  required: JenisDokumenEnum[];
  uploaded: {
    jenis_dokumen: JenisDokumenEnum;
    nama_file: string;
    url_file: string;
    status_verifikasi: string;
  }[];
  is_complete: boolean;
  missing: JenisDokumenEnum[];
}

// =====================================================
// STATISTICS ENDPOINTS
// =====================================================

// GET /api/dana-kematian/statistics/overview
// Get overview statistics
interface OverviewStatsResponse {
  total_claims: number;
  by_status: Record<StatusProsesDakemEnum, number>;
  by_cabang: Array<{
    cabang: string;
    total: number;
    selesai: number;
    proses: number;
  }>;
  total_dana_disetujui: number;
  total_dana_disalurkan: number;
  rata_rata_waktu_proses: number;
  bulan_ini: number;
  bulan_lalu: number;
}

// GET /api/dana-kematian/statistics/processing-time
// Get processing time statistics
interface ProcessingTimeStatsResponse {
  rata_rata_hari: number;
  median_hari: number;
  tercepat_hari: number;
  terlama_hari: number;
  per_tahap: {
    tahap: string;
    rata_rata_hari: number;
  }[];
}

// =====================================================
// REPORT ENDPOINTS
// =====================================================

// GET /api/dana-kematian/reports/monthly
// Get monthly report
interface MonthlyReportParams {
  year: number;
  month: number;
  cabang?: string;
}

interface MonthlyReportResponse {
  periode: string;
  total_klaim: number;
  klaim_baru: number;
  klaim_selesai: number;
  total_dana_disalurkan: number;
  rata_rata_waktu_proses: number;
  per_cabang: Array<{
    cabang: string;
    total: number;
    selesai: number;
    dana: number;
  }[];
}

// GET /api/dana-kematian/reports/outstanding
// Get outstanding claims report
interface OutstandingReportResponse {
  total: number;
  by_status: Record<string, number>;
  by_cabang: Array<{
    cabang: string;
    dilaporkan: number;
    verifikasi_cabang: number;
    proses_pusat: number;
  }>;
  overdue: Array<{
    id: string;
    nama_anggota: string;
    status: string;
    hari_terlambat: number;
  }>;
}
```

---

## 5. DATABASE SCHEMA ENHANCEMENTS

### 5.1. Additional Tables

```sql
-- =====================================================
-- DOCUMENTS TABLE
-- =====================================================

CREATE TABLE dokumen_kematian (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dana_kematian_id UUID NOT NULL REFERENCES dana_kematian(id) ON DELETE CASCADE,

    jenis_dokumen VARCHAR(50) NOT NULL,
    nama_file VARCHAR(255) NOT NULL,
    url_file TEXT NOT NULL,
    ukuran_file BIGINT,
    mime_type VARCHAR(100),

    diupload_oleh UUID NOT NULL,
    tanggal_upload TIMESTAMPTZ DEFAULT timezone('utc', now()),

    status_verifikasi VARCHAR(20) DEFAULT 'pending',
        -- 'valid', 'invalid', 'pending', 'perlu_perbaikan'
    catatan_verifikasi TEXT,
    diverifikasi_oleh UUID,
    tanggal_verifikasi TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_dokumen_kematian_claim
ON dokumen_kematian(dana_kematian_id);

CREATE INDEX idx_dokumen_kematian_jenis
ON dokumen_kematian(jenis_dokumen);

-- =====================================================
-- PROCESS HISTORY TABLE
-- =====================================================

CREATE TABLE riwayat_proses_dakem (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dana_kematian_id UUID NOT NULL REFERENCES dana_kematian(id) ON DELETE CASCADE,

    status_dari VARCHAR(50) NOT NULL,
    status_ke VARCHAR(50) NOT NULL,

    actor_id UUID NOT NULL,
    actor_role VARCHAR(20) NOT NULL, -- 'cabang', 'pusat', 'system'
    actor_nama VARCHAR(255) NOT NULL,

    catatan TEXT,
    data_perubahan JSONB,

    timestamp TIMESTAMPTZ DEFAULT timezone('utc', now()),

    created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

CREATE INDEX idx_riwayat_dakem_claim
ON riwayat_proses_dakem(dana_kematian_id, timestamp DESC);

CREATE INDEX idx_riwayat_dakem_actor
ON riwayat_proses_dakem(actor_id);

-- =====================================================
-- BENEFIT CALCULATION TABLE
-- =====================================================

CREATE TABLE perhitungan_dana_kematian (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dana_kematian_id UUID NOT NULL REFERENCES dana_kematian(id) ON DELETE CASCADE,

    kategori_anggota VARCHAR(50) NOT NULL,
    masa_kerja_tahun INTEGER NOT NULL,
    masa_kerja_bulan INTEGER DEFAULT 0,
    status_mps VARCHAR(20) NOT NULL,

    dasar_perhitungan NUMERIC(14,2) NOT NULL,
    tambahan_keluarga NUMERIC(14,2) DEFAULT 0,
    tambahan_mps NUMERIC(14,2) DEFAULT 0,
    tambahan_lainnya NUMERIC(14,2) DEFAULT 0,
    potongan NUMERIC(14,2) DEFAULT 0,

    total_dana NUMERIC(14,2) NOT NULL,

    rumus_perhitungan TEXT NOT NULL,
    detail_perhitungan JSONB,

    dihitung_oleh UUID NOT NULL,
    tanggal_perhitungan TIMESTAMPTZ DEFAULT timezone('utc', now()),
    disetujui_oleh UUID,
    tanggal_persetujuan TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

CREATE INDEX idx_perhitungan_dakem_claim
ON perhitungan_dana_kematian(dana_kematian_id);

-- =====================================================
-- AUDIT/TRACKING TABLE
-- =====================================================

CREATE TABLE audit_dana_kematian (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dana_kematian_id UUID NOT NULL REFERENCES dana_kematian(id) ON DELETE CASCADE,

    action VARCHAR(50) NOT NULL, -- 'create', 'update', 'transition', 'approve', 'reject'
    actor_id UUID NOT NULL,
    actor_role VARCHAR(20) NOT NULL,
    actor_ip VARCHAR(45),
    actor_user_agent TEXT,

    old_data JSONB,
    new_data JSONB,
    changes JSONB,

    created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

CREATE INDEX idx_audit_dakem_claim
ON audit_dana_kematian(dana_kematian_id, created_at DESC);

CREATE INDEX idx_audit_dakem_action
ON audit_dana_kematian(action);
```

### 5.2. Enhanced Main Table

```sql
-- Add columns to existing dana_kematian table
ALTER TABLE dana_kematian
ADD COLUMN IF NOT EXISTS nikap VARCHAR(25),
ADD COLUMN IF NOT EXISTS tempat_meninggal VARCHAR(255),
ADD COLUMN IF NOT EXISTS cabang_kontak_pelapor VARCHAR(50),
ADD COLUMN IF NOT EXISTS cabang_petugas_verifikator VARCHAR(255),
ADD COLUMN IF NOT EXISTS cabang_status_kelengkapan VARCHAR(50),
    CHECK (cabang_status_kelengkapan IN ('lengkap', 'kurang', 'tidak_lengkap')),
ADD COLUMN IF NOT EXISTS cabang_catatan_verifikasi TEXT,
ADD COLUMN IF NOT EXISTS pusat_petugas_validator VARCHAR(255),
ADD COLUMN IF NOT EXISTS pusat_petugas_approver VARCHAR(255),
ADD COLUMN IF NOT EXISTS pusat_nomor_referensi VARCHAR(100),
ADD COLUMN IF NOT EXISTS kategori_dana VARCHAR(50),
    CHECK (kategori_dana IN ('rutin', 'khusus', 'premi', 'lainnya')),
ADD COLUMN IF NOT EXISTS metode_penyaluran VARCHAR(50),
    CHECK (metode_penyaluran IN ('transfer', 'tunai')),
ADD COLUMN IF NOT EXISTS rekening_tujuan VARCHAR(100),
ADD COLUMN IF NOT EXISTS bank_tujuan VARCHAR(100),
ADD COLUMN IF NOT EXISTS cabang_petugas_penyerah VARCHAR(255),
ADD COLUMN IF NOT EXISTS cabang_bukti_penyerahan TEXT,
ADD COLUMN IF NOT EXISTS nik_ahli_waris VARCHAR(25),
ADD COLUMN IF NOT EXISTS alamat_ahli_waris TEXT,
ADD COLUMN IF NOT EXISTS no_hp_ahli_waris VARCHAR(20),
ADD COLUMN IF NOT EXISTS file_buku_rekening TEXT,
ADD COLUMN IF NOT EXISTS file_surat_kuasa TEXT,
ADD COLUMN IF NOT EXISTS file_lainnya TEXT[],
ADD COLUMN IF NOT EXISTS alasan_penolakan TEXT,
ADD COLUMN IF NOT EXISTS dokumen_kurang TEXT[];

-- Update status enum to include more states
CREATE TYPE status_proses_dakem_enum_new AS ENUM (
    'dilaporkan',
    'pending_dokumen',
    'verifikasi_cabang',
    'proses_pusat',
    'penyaluran',
    'selesai',
    'ditolak'
);

-- Migration to update existing data
ALTER TABLE dana_kematian
    ALTER COLUMN status_proses DROP DEFAULT,
    ALTER COLUMN status_proses TYPE status_proses_dakem_enum_new
    USING status_proses::text::status_proses_dakem_enum_new,
    ALTER COLUMN status_proses SET DEFAULT 'dilaporkan',
    ADD CONSTRAINT chk_status_transition
    CHECK (status_proses IN ('dilaporkan', 'pending_dokumen', 'verifikasi_cabang', 'proses_pusat', 'penyaluran', 'selesai', 'ditolak'));

DROP TYPE status_proses_dakem_enum;
ALTER TYPE status_proses_dakem_enum_new RENAME TO status_proses_dakem_enum;
```

---

## 6. VALIDATION RULES

### 6.1. Business Rules

```typescript
// Document Validation
const validateDocuments = (claim: DanaKematian): ValidationResult => {
  const requiredDocs = [
    'file_surat_kematian',
    'file_sk_pensiun',
    'file_surat_pernyataan_ahli_waris',
    'file_kartu_keluarga',
    'file_e_ktp'
  ];

  const missing = requiredDocs.filter(doc => !claim[doc]);

  return {
    is_valid: missing.length === 0,
    missing_documents: missing,
    can_proceed: missing.length === 0
  };
};

// Status Transition Validation
const canTransition = (
  from: StatusProsesDakemEnum,
  to: StatusProsesDakemEnum,
  actor_role: 'cabang' | 'pusat'
): boolean => {
  const transitions: Record<string, string[]> = {
    'dilaporkan': ['pending_dokumen', 'verifikasi_cabang', 'ditolak'],
    'pending_dokumen': ['verifikasi_cabang', 'ditolak'],
    'verifikasi_cabang': ['proses_pusat', 'ditolak'],
    'proses_pusat': ['penyaluran', 'selesai', 'ditolak'],
    'penyaluran': ['selesai'],
    'selesai': [],
    'ditolak': []
  };

  // Role-based authorization
  const rolePermissions = {
    'cabang': ['dilaporkan', 'pending_dokumen', 'verifikasi_cabang'],
    'pusat': ['verifikasi_cabang', 'proses_pusat', 'penyaluran', 'selesai', 'ditolak']
  };

  const validTransitions = transitions[from] || [];
  const hasPermission = rolePermissions[actor_role].includes(to);

  return validTransitions.includes(to) && hasPermission;
};

// Financial Validation
const calculateBenefit = (member: Anggota, deathDate: Date): number => {
  // Base amount based on member category
  const baseAmounts: Record<string, number> = {
    'pegawai': 10000000,
    'istri': 7500000,
    'suami': 7500000,
    'anak': 5000000,
    'meninggal': 0
  };

  let base = baseAmounts[member.kategori_anggota] || 0;

  // Add MPS bonus if applicable
  if (member.status_mps === 'mps') {
    base += 2000000;
  }

  // Add service year bonus
  const serviceYears = calculateServiceYears(member);
  if (serviceYears > 20) {
    base += 1000000;
  } else if (serviceYears > 10) {
    base += 500000;
  }

  return base;
};

// Heir Eligibility Validation
const validateHeir = (
  heir_status: StatusAhliWarisEnum,
  member_category: string,
  member_gender: string
): ValidationResult => {
  // Rules based on inheritance hierarchy
  const validCombinations = {
    'istri': ['pegawai', ...],
    'suami': ['istri', ...],
    'anak': [...],
    'orang_tua': [...],
    'saudara_kandung': [...],
    'keluarga_lainnya': [...]
  };

  const isValid = validCombinations[heir_status]?.includes(member_category);

  return {
    is_valid: isValid,
    message: isValid ? 'Valid heir' : 'Invalid heir relationship'
  };
};
```

---

## 7. NOTIFICATION SYSTEM

### 7.1. Notification Triggers

```typescript
interface NotificationTrigger {
  event: string;
  recipients: string[];
  template: string;
  data: Record<string, any>;
}

const notificationEvents = [
  {
    event: 'claim_created',
    recipients: ['cabang_admin', 'family'],
    template: 'dana_kematian_claim_created',
    subject: 'Klaim Dana Kematian Baru - {nama_anggota}'
  },
  {
    event: 'documents_verified',
    recipients: ['central_office'],
    template: 'dana_kematian_docs_verified',
    subject: 'Berkas Lengkap - {no_klaim}'
  },
  {
    event: 'claim_approved',
    recipients: ['branch', 'family'],
    template: 'dana_kematian_approved',
    subject: 'Klaim Disetujui - Rp{besaran_dana}'
  },
  {
    event: 'funds_transferred',
    recipients: ['branch'],
    template: 'dana_kematian_transferred',
    subject: 'Dana Transfer - Rp{besaran_dana}'
  },
  {
    event: 'claim_completed',
    recipients: ['all'],
    template: 'dana_kematian_completed',
    subject: 'Klaim Selesai - {no_klaim}'
  },
  {
    event: 'claim_rejected',
    recipients: ['branch', 'family'],
    template: 'dana_kematian_rejected',
    subject: 'Klaim Ditolak - {alasan}'
  },
  {
    event: 'documents_incomplete',
    recipients: ['family'],
    template: 'dana_kematian_docs_incomplete',
    subject: 'Dokumen Kurang - {dokumen_kurang}'
  }
];
```

---

## 8. REPORTING & ANALYTICS

### 8.1. Key Metrics

```typescript
interface DanaKematianMetrics {
  // Volume Metrics
  total_claims: number;
  new_claims_this_month: number;
  completed_claims_this_month: number;

  // Financial Metrics
  total_funds_approved: number;
  total_funds_distributed: number;
  pending_funds: number;

  // Performance Metrics
  average_processing_time_days: number;
  fastest_processing_time_days: number;
  slowest_processing_time_days: number;

  // Status Distribution
  by_status: Record<StatusProsesDakemEnum, number>;

  // Branch Performance
  by_branch: Array<{
    cabang: string;
    total: number;
    completed: number;
    avg_time: number;
    total_amount: number;
  }>;

  // Monthly Trend
  monthly_trend: Array<{
    bulan: string;
    baru: number;
    selesai: number;
    nominal: number;
  }>;
}
```

### 8.2. Sample Reports

```sql
-- Monthly Report
SELECT
    DATE_TRUNC('month', tanggal_lapor_keluarga) as bulan,
    COUNT(*) as total_klaim,
    COUNT(*) FILTER (WHERE status_proses = 'selesai') as selesai,
    SUM(besaran_dana_kematian) FILTER (WHERE status_proses = 'selesai') as total_dana,
    AVG(Age(tanggal_lapor_keluarga, pusat_tanggal_selesai)) as rata_rata_hari
FROM dana_kematian
WHERE deleted_at IS NULL
GROUP BY DATE_TRUNC('month', tanggal_lapor_keluarga)
ORDER BY bulan DESC;

-- Outstanding by Branch
SELECT
    cabang_asal_melapor,
    COUNT(*) FILTER (WHERE status_proses = 'dilaporkan') as dilaporkan,
    COUNT(*) FILTER (WHERE status_proses = 'verifikasi_cabang') as verifikasi_cabang,
    COUNT(*) FILTER (WHERE status_proses = 'proses_pusat') as proses_pusat,
    COUNT(*) FILTER (WHERE status_proses = 'penyaluran') as penyaluran
FROM dana_kematian
WHERE deleted_at IS NULL
    AND status_proses != 'selesai'
GROUP BY cabang_asal_melapor
ORDER BY cabang_asal_melapor;

-- Processing Time Analysis
SELECT
    status_proses,
    COUNT(*) as jumlah,
    AVG(EXTRACT(EPOCH FROM (updated_at - created_at))/86400) as rata_rata_hari
FROM dana_kematian
WHERE deleted_at IS NULL
    AND status_proses = 'selesai'
GROUP BY status_proses;
```

---

## 9. SECURITY & ACCESS CONTROL

### 9.1. Role-Based Access

```typescript
type UserRole = 'admin' | 'cabang_staff' | 'cabang_admin' | 'pusat_staff' | 'pusat_admin';

interface Permission {
  role: UserRole;
  permissions: string[];
}

const rolePermissions: Record<UserRole, Permission> = {
  admin: {
    role: 'admin',
    permissions: ['*'] // Full access
  },
  cabang_staff: {
    role: 'cabang_staff',
    permissions: [
      'claims:create',
      'claims:read:own_branch',
      'claims:update:documents',
      'claims:transition:dilaporkan',
      'claims:transition:verifikasi_cabang'
    ]
  },
  cabang_admin: {
    role: 'cabang_admin',
    permissions: [
      'claims:create',
      'claims:read:own_branch',
      'claims:update:all',
      'claims:delete:dilaporkan',
      'claims:transition:dilaporkan',
      'claims:transition:verifikasi_cabang',
      'reports:read:own_branch'
    ]
  },
  pusat_staff: {
    role: 'pusat_staff',
    permissions: [
      'claims:read:all',
      'claims:update:all',
      'claims:transition:proses_pusat',
      'claims:calculate',
      'documents:verify',
      'reports:read:all'
    ]
  },
  pusat_admin: {
    role: 'pusat_admin',
    permissions: [
      'claims:read:all',
      'claims:update:all',
      'claims:transition:all',
      'claims:approve',
      'claims:reject',
      'claims:delete',
      'reports:read:all',
      'reports:export',
      'settings:manage'
    ]
  }
};
```

---

## 10. IMPLEMENTATION CHECKLIST

### Phase 1: Core System
- [x] Database schema (dana_kematian table)
- [ ] API endpoints (CRUD)
- [ ] State machine implementation
- [ ] Document upload system
- [ ] Basic validation rules

### Phase 2: Workflow Management
- [ ] Status transition logic
- [ ] Role-based access control
- [ ] Process history tracking
- [ ] Notification system
- [ ] Approval workflow

### Phase 3: Financial Management
- [ ] Benefit calculation engine
- [ ] Fund transfer tracking
- [ ] Distribution management
- [ ] Financial reporting

### Phase 4: Reporting & Analytics
- [ ] Dashboard metrics
- [ ] Monthly reports
- [ ] Branch performance
- [ ] Processing time analysis
- [ ] Export functionality

### Phase 5: Integration & Testing
- [ ] Integration with member data
- [ ] Integration with accounting
- [ ] Email notifications
- [ ] End-to-end testing
- [ ] User acceptance testing

---

## Appendix: Sample Scenarios

### Scenario 1: Normal Flow
```
1. Member dies on 2024-01-15
2. Family reports to branch on 2024-01-20
3. Branch verifies documents (2024-01-22)
4. Branch sends to center (2024-01-25)
5. Center receives and validates (2024-01-28)
6. Center approves: Rp 10.000.000 (2024-02-01)
7. Center transfers to branch (2024-02-02)
8. Branch distributes to heir (2024-02-05)
9. Branch reports completion (2024-02-06)
10. Case closed (2024-02-06)

Total processing time: 17 days
```

### Scenario 2: Incomplete Documents
```
1. Member dies on 2024-02-01
2. Family reports (missing: SK Pensiun)
3. Status: pending_dokumen
4. Branch requests missing document
5. Family submits document (2024-02-10)
6. Status changes to: verifikasi_cabang
7. Process continues...
```

### Scenario 3: Rejected Claim
```
1. Claim submitted
2. Verification reveals: Member not eligible (wrong category)
3. Center rejects with reason
4. Family informed
5. Case closed as: ditolak
```

---

*Document Version: 1.0*
*Last Updated: 2026-03-11*
*Author: Claude & P2TEL Team*
