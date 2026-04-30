# Business Process & System Design: Dana Kematian (Death Benefit) System

## 1. Process Overview

### 1.1 Purpose
The Dana Kematian (Dakem) system manages the end-to-end process of providing death benefits to eligible members' heirs. This system ensures proper validation, documentation, fund disbursement, and reporting while maintaining audit trails for compliance and transparency.

### 1.2 Actors and Roles

| Actor | Role | Responsibilities |
|-------|------|------------------|
| **Member/Heir** | Beneficiary | Reports death, provides documents, receives funds |
| **Branch Office (PC - Pengurus Cabang)** | First-level processor | Receives reports, validates family data, compiles documents, delivers funds, submits reports |
| **Central Office (PP - Pengurus Pusat)** | Final approver & funder | Verifies applications, approves benefits, transfers funds, receives reports |

### 1.3 Process Scope
- **Trigger**: Member death (MD)
- **Completion**: All reports submitted to PP and case closed
- **Timeline**: Tracked via Waktu-0 through Waktu-7
- **Documentation**: Berkas-1 through Berkas-7

---

## 2. Detailed End-to-End Workflow

### 2.1 Phase A: Laporan Kematian (Member Death)

| Aspect | Details |
|--------|---------|
| **Actor** | Family/Heir → Branch Office (PC) |
| **Trigger** | Member passes away |
| **Input** | - Death information (date, place, cause) |
| **Process** | 1. Family reports death to PC<br>2. PC records death report<br>3. Death certificate obtained |
| **Output** | - Death report<br>- Death certificate |
| **Waktu Reference** | **Waktu-0**: `tanggal_meninggal` (Date of death) |
| **Berkas Reference** | Berkas-1 (Initial death report) |
| **System Action** | Create initial claim record with status `dilaporkan` |

### 2.2 Phase B: Pengajuan Dakem (Branch Application)

| Aspect | Details |
|--------|---------|
| **Actor** | Branch Office (PC) |
| **Input** | - Death report from Phase A<br>- Family information |
| **Process** | 1. Receive death report<br>2. Validate family data of deceased<br>3. Perform active coordination (WhatsApp/Phone)<br>4. Confirm heir eligibility<br>5. Gather required information |
| **Output** | - Validated family data<br>- Heir information confirmed<br>- Document checklist prepared |
| **Waktu Reference** | **Waktu-1**: `tanggal_lapor_keluarga` (Date family reported to PC) |
| **Berkas Reference** | Berkas-1 (Initial documents received) |
| **System Action** | Update status to `verifikasi_cabang` or `pending_dokumen` |

### 2.3 Phase C: Kompilasi Berkas (Document Compilation)

| Aspect | Details |
|--------|---------|
| **Actor** | Branch Office (PC) |
| **Input** | - Validated family data<br>- Initial document set (Berkas-1)<br>- Clarified/finalized documents |
| **Process** | 1. Receive initial documents (may be incomplete)<br>2. Request missing documents<br>3. Receive final documents after clarification (Berkas-2)<br>4. Verify all documents complete<br>5. Submit complete application to PP |
| **Output** | - Complete application package (Berkas-2)<br>- Submission to PP |
| **Waktu Reference** | **Waktu-1**: `cabang_tanggal_awal_terima_berkas` (Initial receipt)<br>**Waktu-2**: `cabang_tanggal_kirim_ke_pusat` (Final submission) |
| **Berkas Reference** | Berkas-1 → Berkas-2 (Document evolution) |
| **System Action** | Update status to `proses_pusat` when submitted to PP |

### 2.4 Phase D: Verifikasi Pengajuan (Application Verification)

| Aspect | Details |
|--------|---------|
| **Actor** | Central Office (PP) |
| **Input** | - Application package from PC (Berkas-2)<br>- Supporting documents |
| **Process** | 1. Receive initial documents from PC<br>2. Review completeness and correctness<br>3. Validate against regulations<br>4. Request clarification if needed<br>5. Receive final documents<br>6. Confirm application valid and complete |
| **Output** | - Validated application (Berkas-3)<br>- Approval recommendation |
| **Waktu Reference** | **Waktu-2**: `pusat_tanggal_awal_terima` (Initial receipt)<br>**Waktu-3**: `pusat_tanggal_validasi` (Validation complete) |
| **Berkas Reference** | Berkas-2 → Berkas-3 (Validated documents) |
| **System Action** | Update status to `verifikasi_pusat` during process, `disetujui` when validated |

### 2.5 Phase E: Finalisasi Pengajuan (Application Finalization)

| Aspect | Details |
|--------|---------|
| **Actor** | Central Office (PP) |
| **Input** | - Validated application (Berkas-3)<br>- Approved Dakem list |
| **Process** | 1. Compile approved Dakem list<br>2. Send documents to finance department<br>3. Calculate benefit amount<br>4. Process fund transfer to PC<br>5. Generate transfer documentation |
| **Output** | - Approved Dakem list<br>- Fund transfer to PC (Berkas-4)<br>- Transfer documentation |
| **Waktu Reference** | **Waktu-4**: `pusat_tanggal_selesai` (Process completed)<br>**Waktu-5**: `tanggal_transfer_pp_ke_pc` (Transfer to PC) |
| **Berkas Reference** | Berkas-4 (Transfer documentation) |
| **System Action** | Update status to `penyaluran` when funds transferred |

### 2.6 Phase F: Laporan Dakem (Completion Reporting)

| Aspect | Details |
|--------|---------|
| **Actor** | Branch Office (PC) |
| **Input** | - Fund transfer from PP (Berkas-4)<br>- Heir information |
| **Process** | 1. Receive fund transfer from PP<br>2. Coordinate with heir for delivery<br>3. Deliver funds to heir<br>4. Create handover report (Berita/Edusus)<br>5. Create financial report<br>6. Create feedback report<br>7. Send all reports to PP |
| **Output** | - Funds delivered to heir (Berkas-5)<br>- Handover report (Berkas-6)<br>- Financial & feedback reports (Berkas-7) |
| **Waktu Reference** | **Waktu-6**: `cabang_tanggal_serah_ke_ahli_waris` (Funds delivered)<br>**Waktu-7**: `cabang_tanggal_lapor_ke_pusat` (Reports submitted) |
| **Berkas Reference** | Berkas-5 (Delivery proof), Berkas-6 (Handover report), Berkas-7 (Final reports) |
| **System Action** | Update status to `selesai` when all reports submitted |

---

## 3. Document Management Design

### 3.1 Main Documents (Required)

| Document | Purpose | Required | Waktu | Storage |
|----------|---------|----------|-------|---------|
| Death Certificate (Surat Kematian) | Proof of death | Yes | Waktu-0 | `file_surat_kematian` |
| Pension Decree (SK Pensiun) | Proof of pension status | Yes | Waktu-1 | `file_sk_pensiun` |
| Heir Certificate (Surat Ahli Waris) | Legal heir designation | Yes | Waktu-1 | `file_surat_pernyataan_ahli_waris` |
| Family Card (KK Ahli Waris) | Family composition | Yes | Waktu-1 | `file_kartu_keluarga` |
| Heir ID Card (KTP) | Heir identification | Yes | Waktu-1 | `file_e_ktp` |

### 3.2 Supporting Documents (Optional)

| Document | Purpose | Required | Storage |
|----------|---------|----------|---------|
| Marriage Certificate | Marriage proof | Conditional | `file_surat_nikah` |
| Bank Account Book | For transfer | Yes | `file_buku_rekening` |
| Power of Attorney (Surat Kuasa) | If heir not direct | Conditional | `file_surat_kuasa` |
| Other Documents | Additional proof | No | `file_lainnya[]` |

### 3.3 Berkas Evolution Mapping

| Berkas | Description | Waktu | Status |
|--------|-------------|-------|--------|
| **Berkas-1** | Initial documents received (may be incomplete) | Waktu-1 | `pending_dokumen` |
| **Berkas-2** | Final documents after clarification (complete) | Waktu-2 | `verifikasi_cabang` |
| **Berkas-3** | Validated documents at PP level | Waktu-3 | `proses_pusat` |
| **Berkas-4** | Transfer documentation from PP to PC | Waktu-5 | `penyaluran` |
| **Berkas-5** | Proof of fund delivery to heir | Waktu-6 | `penyaluran` |
| **Berkas-6** | Handover report (Berita/Edusus) | Waktu-6 | `penyaluran` |
| **Berkas-7** | Financial & feedback reports to PP | Waktu-7 | `selesai` |

### 3.4 Storage Strategy

**Primary Storage**: `dana_kematian` table
- Direct file URL fields for main documents
- Array field for additional documents
- Document metadata tracked in separate `dokumen_kematian` table (optional but recommended)

**Recommended Structure**:
```
dana_kematian (main entity)
├── file_surat_kematian (URL)
├── file_sk_pensiun (URL)
├── file_surat_pernyataan_ahli_waris (URL)
├── file_kartu_keluarga (URL)
├── file_e_ktp (URL)
├── file_surat_nikah (URL)
├── file_buku_rekening (URL)
├── file_surat_kuasa (URL)
└── file_lainnya (URL array)

dokumen_kematian (detailed tracking - optional)
├── id
├── dana_kematian_id (FK)
├── jenis_dokumen
├── nama_file
├── url_file
├── status_verifikasi
└── tanggal_upload
```

---

## 4. Validation & Decision Flow

### 4.1 Branch Level (PC) Validation

**Active Validation Phase** (Phase B):
1. **Family Data Validation**
   - Verify family relationship
   - Confirm heir eligibility
   - Contact via WhatsApp/Phone
   - Document communication attempts

2. **Document Completeness Check**
   - All main documents present
   - Documents legible and valid
   - Names match across documents
   - Dates are consistent

3. **Decision Points**:
   ```
   IF documents complete AND family validated
   → Proceed to Phase C (Document Compilation)
   ELSE
   → Request missing documents
   → Status: pending_dokumen
   ```

### 4.2 Central Level (PP) Validation

**Formal Verification Phase** (Phase D):
1. **Application Completeness**
   - All required documents present
   - PC validation completed
   - Benefit calculation verified

2. **Regulatory Compliance**
   - Meets organization regulations
   - Heir eligibility confirmed
   - Supporting documentation adequate

3. **Decision Points**:
   ```
   IF application valid AND compliant
   → Approve for finalization
   → Status: disetujui
   ELSE IF issues can be fixed
   → Return to PC for clarification
   → Status: dikembalikan
   ELSE
   → Reject application
   → Status: ditolak
   ```

### 4.3 Rejection & Revision Loops

| Stage | Rejection Reason | Return To | Action Required |
|-------|-----------------|-----------|-----------------|
| PC Validation | Incomplete documents | Phase B | Complete documents |
| PC Validation | Invalid family data | Phase B | Provide correct information |
| PP Verification | PC validation incomplete | Phase C | Re-validate at PC |
| PP Verification | Non-compliant application | Phase C | Correct application |
| PP Finalization | Calculation error | Phase D | Recalculate |
| Any Stage | Fraud suspicion | Special | Investigate |

---

## 5. Status Flow (System Perspective)

### 5.1 Status Definitions

| Status | Description | Phase | Actor |
|--------|-------------|-------|-------|
| `dilaporkan` | Death reported, initial claim created | A | Family/PC |
| `verifikasi_cabang` | PC actively validating family data | B | PC |
| `pending_dokumen` | Waiting for complete documents | B-C | PC |
| `berkas_lengkap` | All documents received at PC | C | PC |
| `proses_pusat` | Submitted to PP, under review | D | PP |
| `verifikasi_pusat` | PP validating application | D | PP |
| `disetujui` | Approved by PP, awaiting finance | E | PP |
| `penyaluran` | Funds transferred to PC | E-F | PP/PC |
| `diserahkan` | Funds delivered to heir | F | PC |
| `pelaporan` | Reports being prepared | F | PC |
| `selesai` | All reports submitted, case closed | F | PC |
| `ditolak` | Application rejected | Any | PP/PC |
| `dikembalikan` | Returned for clarification | D | PP |

### 5.2 Status Transition Diagram

```
[dilaporkan]
    ↓
[verifikasi_cabang] ←→ [pending_dokumen]
    ↓
[berkas_lengkap]
    ↓
[proses_pusat]
    ↓
[verifikasi_pusat]
    ↓
[disetujui]
    ↓
[penyaluran]
    ↓
[diserahkan]
    ↓
[pelaporan]
    ↓
[selesai]

Branch points:
- [ditolak] (from any stage)
- [dikembalikan] (from verifikasi_pusat → berkas_lengkap)
```

### 5.3 Transition Rules

| From | To | Condition | Actor |
|------|-----|-----------|-------|
| dilaporkan | verifikasi_cabang | Family validation started | PC |
| verifikasi_cabang | pending_dokumen | Documents incomplete | PC |
| pending_dokumen | berkas_lengkap | All documents received | PC |
| berkas_lengkap | proses_pusat | Submitted to PP | PC |
| proses_pusat | verifikasi_pusat | PP review started | PP |
| verifikasi_pusat | disetujui | Application valid | PP |
| verifikasi_pusat | dikembalikan | Needs clarification | PP |
| verifikasi_pusat | ditolak | Invalid application | PP |
| disetujui | penyaluran | Funds transferred | PP |
| penyaluran | diserahkan | Funds delivered to heir | PC |
| diserahkan | pelaporan | Reports preparation | PC |
| pelaporan | selesai | All reports submitted | PC |

---

## 6. Timeline Tracking

### 6.1 Waktu Mapping to Database Fields

| Waktu | Description | Database Field | Data Type | Required |
|-------|-------------|----------------|-----------|----------|
| **Waktu-0** | Date of death | `tanggal_meninggal` | DATE | Yes |
| **Waktu-1** | Initial report to PC | `tanggal_lapor_keluarga` | DATE | Yes |
| **Waktu-1** | Initial documents received | `cabang_tanggal_awal_terima_berkas` | DATE | Yes |
| **Waktu-2** | Final submission to PP | `cabang_tanggal_kirim_ke_pusat` | DATE | Yes |
| **Waktu-2** | PP receives application | `pusat_tanggal_awal_terima` | DATE | Yes |
| **Waktu-3** | PP validation complete | `pusat_tanggal_validasi` | DATE | Yes |
| **Waktu-4** | PP process complete | `pusat_tanggal_selesai` | DATE | Yes |
| **Waktu-5** | Transfer PP to PC | `tanggal_transfer_pp_ke_pc` | DATE | Yes |
| **Waktu-6** | Delivery to heir | `cabang_tanggal_serah_ke_ahli_waris` | DATE | Yes |
| **Waktu-7** | Reports to PP | `cabang_tanggal_lapor_ke_pusat` | DATE | Yes |

### 6.2 Duration Calculations

| Metric | Formula | Purpose |
|--------|---------|---------|
| Total Processing Time | Waktu-7 - Waktu-1 | Overall efficiency |
| PC Processing Time | Waktu-2 - Waktu-1 | Branch efficiency |
| PP Processing Time | Waktu-4 - Waktu-2 | Central efficiency |
| Fund Transfer Time | Waktu-6 - Waktu-5 | Disbursement speed |
| Reporting Time | Waktu-7 - Waktu-6 | Compliance timeliness |

### 6.3 Implementation Notes

- All Waktu fields should be NULLABLE (not all claims complete all phases)
- Populate Waktu fields during status transitions
- Use database triggers or application logic to auto-populate where appropriate
- Index Waktu fields for reporting and performance analysis

---

## 7. Database Design

### 7.1 Core Table: `dana_kematian`

#### Primary Fields
```sql
-- IDENTITY & REFERENCES
id UUID PRIMARY KEY DEFAULT gen_random_uuid()
anggota_id UUID REFERENCES anggota(id) ON DELETE SET NULL

-- MEMBER INFORMATION
nama_anggota VARCHAR(200) NOT NULL
nikap VARCHAR(25)  -- Nomor Induk Karyawan Anggota Pensiun
status_anggota status_anggota_enum NOT NULL
status_mps status_mps_enum NOT NULL
```

#### Death Information (Waktu-0)
```sql
tanggal_meninggal DATE NOT NULL  -- Waktu-0
tempat_meninggal VARCHAR(255)
penyebab_meninggal TEXT
```

#### Reporting & PC Processing (Waktu-1)
```sql
tanggal_lapor_keluarga DATE  -- Waktu-1
cabang_asal_melapor VARCHAR(120) NOT NULL
cabang_nama_pelapor VARCHAR(150)
cabang_nik_pelapor VARCHAR(25)
cabang_kontak_pelapor VARCHAR(50)

-- PC Validation Phase
cabang_tanggal_awal_terima_berkas DATE  -- Waktu-1 (Berkas-1)
cabang_petugas_verifikator VARCHAR(255)
cabang_status_kelengkapan VARCHAR(50) CHECK (cabang_status_kelengkapan IN ('lengkap', 'kurang', 'tidak_lengkap'))
cabang_catatan_verifikasi TEXT
```

#### Submission & PP Processing (Waktu-2, Waktu-3)
```sql
-- Submission to PP
cabang_tanggal_kirim_ke_pusat DATE  -- Waktu-2 (Berkas-2)

-- PP Processing
pusat_tanggal_awal_terima DATE  -- Waktu-2
pusat_tanggal_validasi DATE  -- Waktu-3
pusat_petugas_validator VARCHAR(255)
pusat_petugas_approver VARCHAR(255)
pusat_nomor_referensi VARCHAR(100) UNIQUE
```

#### Finalization & Transfer (Waktu-4, Waktu-5)
```sql
-- Finalization
pusat_tanggal_selesai DATE  -- Waktu-4

-- Financial
besaran_dana_kematian NUMERIC(14,2) NOT NULL
kategori_dana VARCHAR(50) CHECK (kategori_dana IN ('rutin', 'khusus', 'premi', 'lainnya'))
metode_penyaluran VARCHAR(50) CHECK (metode_penyaluran IN ('transfer', 'tunai'))
tanggal_transfer_pp_ke_pc DATE  -- Waktu-5
rekening_tujuan VARCHAR(100)
bank_tujuan VARCHAR(100)
```

#### Delivery & Reporting (Waktu-6, Waktu-7)
```sql
-- Delivery to Heir
cabang_tanggal_serah_ke_ahli_waris DATE  -- Waktu-6
cabang_petugas_penyerah VARCHAR(255)
cabang_bukti_penyerahan TEXT  -- URL to proof document

-- Reporting
cabang_tanggal_lapor_ke_pusat DATE  -- Waktu-7
```

#### Heir Information
```sql
nama_ahli_waris VARCHAR(200) NOT NULL
status_ahli_waris status_ahli_waris_enum NOT NULL
nik_ahli_waris VARCHAR(25)
alamat_ahli_waris TEXT
no_hp_ahli_waris VARCHAR(20)
```

#### Document Storage
```sql
-- Main Documents
file_sk_pensiun TEXT
file_surat_kematian TEXT
file_surat_pernyataan_ahli_waris TEXT
file_kartu_keluarga TEXT
file_e_ktp TEXT
file_surat_nikah TEXT

-- Supporting Documents
file_buku_rekening TEXT
file_surat_kuasa TEXT
file_lainnya TEXT[]
```

#### Status & Workflow
```sql
status_proses status_proses_dakem_enum DEFAULT 'dilaporkan'
alasan_penolakan TEXT
dokumen_kurang TEXT[]
```

#### Metadata
```sql
keterangan TEXT
created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
updated_at TIMESTAMPTZ DEFAULT timezone('utc', now())
deleted_at TIMESTAMPTZ
```

### 7.2 Supporting Tables

#### Table: `dokumen_kematian` (Document Tracking)
```sql
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
    catatan_verifikasi TEXT,
    diverifikasi_oleh UUID,
    tanggal_verifikasi TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    deleted_at TIMESTAMPTZ
);
```

**Purpose**: Track individual documents with verification status
**Relationship**: One-to-many with dana_kematian

#### Table: `riwayat_proses_dakem` (Process History)
```sql
CREATE TABLE riwayat_proses_dakem (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dana_kematian_id UUID NOT NULL REFERENCES dana_kematian(id) ON DELETE CASCADE,
    
    status_dari VARCHAR(50) NOT NULL,
    status_ke VARCHAR(50) NOT NULL,
    
    actor_id UUID NOT NULL,
    actor_role VARCHAR(20) NOT NULL,
    actor_nama VARCHAR(255) NOT NULL,
    actor_cabang VARCHAR(120),
    
    catatan TEXT,
    data_perubahan JSONB,
    
    timestamp TIMESTAMPTZ DEFAULT timezone('utc', now()),
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);
```

**Purpose**: Audit trail for status transitions
**Relationship**: One-to-many with dana_kematian

#### Table: `perhitungan_dana_kematian` (Benefit Calculation)
```sql
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
```

**Purpose**: Track benefit calculation details
**Relationship**: One-to-many with dana_kematian

#### Table: `audit_dana_kematian` (Comprehensive Audit)
```sql
CREATE TABLE audit_dana_kematian (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dana_kematian_id UUID NOT NULL REFERENCES dana_kematian(id) ON DELETE CASCADE,
    
    action VARCHAR(50) NOT NULL,
    actor_id UUID NOT NULL,
    actor_role VARCHAR(20) NOT NULL,
    actor_nama VARCHAR(255) NOT NULL,
    actor_ip VARCHAR(45),
    actor_user_agent TEXT,
    
    old_data JSONB,
    new_data JSONB,
    changes JSONB,
    
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);
```

**Purpose**: Complete audit trail for compliance
**Relationship**: One-to-many with dana_kematian

### 7.3 Database Indexes

```sql
-- Performance indexes
CREATE INDEX idx_dakem_anggota ON dana_kematian(anggota_id);
CREATE INDEX idx_dakem_cabang ON dana_kematian(cabang_asal_melapor);
CREATE INDEX idx_dakem_status ON dana_kematian(status_proses);
CREATE INDEX idx_dakem_tanggal_meninggal ON dana_kematian(tanggal_meninggal DESC);
CREATE INDEX idx_dakem_not_deleted ON dana_kematian(id) WHERE deleted_at IS NULL;

-- Document indexes
CREATE INDEX idx_dokumen_kematian_claim ON dokumen_kematian(dana_kematian_id);
CREATE INDEX idx_dokumen_kematian_jenis ON dokumen_kematian(jenis_dokumen);
CREATE INDEX idx_dokumen_kematian_status ON dokumen_kematian(status_verifikasi);

-- History indexes
CREATE INDEX idx_riwayat_dakem_claim ON riwayat_proses_dakem(dana_kematian_id, timestamp DESC);
CREATE INDEX idx_riwayat_dakem_actor ON riwayat_proses_dakem(actor_id);

-- Audit indexes
CREATE INDEX idx_audit_dakem_claim ON audit_dana_kematian(dana_kematian_id, created_at DESC);
CREATE INDEX idx_audit_dakem_action ON audit_dana_kematian(action);
```

---

## 8. Financial Flow

### 8.1 Fund Transfer Process (PP → PC)

| Step | Description | System Action | Database Field |
|------|-------------|---------------|----------------|
| 1 | PP approves application | Generate approval | `pusat_nomor_referensi` |
| 2 | Calculate benefit amount | Run calculation engine | `besaran_dana_kematian` |
| 3 | Send to finance department | Create finance request | `kategori_dana` |
| 4 | Process transfer | Execute bank transfer | `tanggal_transfer_pp_ke_pc` |
| 5 | Generate transfer documentation | Create transfer record | `metode_penyaluran`, `rekening_tujuan` |

**Database Fields**:
- `tanggal_transfer_pp_ke_pc` - Waktu-5
- `besaran_dana_kematian` - Amount
- `metode_penyaluran` - Transfer method
- `rekening_tujuan` - PC account
- `bank_tujuan` - PC bank
- `kategori_dana` - Fund category

### 8.2 Fund Delivery Process (PC → Heir)

| Step | Description | System Action | Database Field |
|------|-------------|---------------|----------------|
| 1 | Receive funds from PP | Confirm receipt | Status → `penyaluran` |
| 2 | Coordinate with heir | Schedule delivery | Contact tracking |
| 3 | Deliver funds | Execute delivery | `cabang_tanggal_serah_ke_ahli_waris` |
| 4 | Obtain receipt | Upload proof | `cabang_bukti_penyerahan` |
| 5 | Record delivery details | Document process | `cabang_petugas_penyerah` |

**Database Fields**:
- `cabang_tanggal_serah_ke_ahli_waris` - Waktu-6
- `cabang_petugas_penyerah` - PC staff delivering
- `cabang_bukti_penyerahan` - Proof document URL
- `metode_penyaluran` - cash or transfer to heir

### 8.3 Financial Tracking

**Calculation Table**: `perhitungan_dana_kematian`
- Base amount calculation
- Additional benefits (MPS, family)
- Final approved amount
- Calculation audit trail

**Views for Reporting**:
```sql
CREATE VIEW v_dana_kematian_financial AS
SELECT
    dk.id,
    dk.nama_anggota,
    dk.besaran_dana_kematian,
    dk.kategori_dana,
    dk.metode_penyaluran,
    dk.tanggal_transfer_pp_ke_pc,
    dk.cabang_tanggal_serah_ke_ahli_waris,
    pc.total_dana as calculated_amount,
    dk.cabang_asal_melapor
FROM dana_kematian dk
LEFT JOIN perhitungan_dana_kematian pc ON pc.dana_kematian_id = dk.id
WHERE dk.deleted_at IS NULL;
```

---

## 9. Reporting & Audit Trail

### 9.1 Report Types

#### A. Handover Report (Berita/Edusus) - Berkas-6
**Purpose**: Document fund delivery to heir
**Content**:
- Heir identification
- Amount delivered
- Delivery method
- Witness information
- Heir acknowledgment

**Storage**: 
- Document URL in separate reporting system
- Reference in `dana_kematian.cabang_bukti_penyerahan`
- Date in `dana_kematian.cabang_tanggal_serah_ke_ahli_waris`

#### B. Financial Report
**Purpose**: Track fund disbursement
**Content**:
- Total amount received from PP
- Amount delivered to heir
- Delivery method details
- Bank details (if applicable)
- PC financial reconciliation

**Storage**:
- Financial report table or document system
- Link to `dana_kematian.id`

#### C. Feedback Report
**Purpose**: Heir satisfaction and process feedback
**Content**:
- Heir feedback
- Process issues
- Suggestions for improvement
- Delivery confirmation

**Storage**:
- Feedback table or document system
- Link to `dana_kematian.id`

### 9.2 Audit Trail Components

#### System Audit (`audit_dana_kematian` table)
Tracks all system actions:
- Record creation
- Status changes
- Data modifications
- Deletions

#### Process History (`riwayat_proses_dakem` table)
Tracks workflow transitions:
- Status from/to
- Actor information
- Timestamps
- Notes

#### Document Verification (`dokumen_kematian` table)
Tracks document lifecycle:
- Upload events
- Verification status
- Verifier identity
- Verification dates

### 9.3 Audit Query Examples

```sql
-- Full audit trail for a claim
SELECT 
    'Status Change' as type,
    r.status_dari,
    r.status_ke,
    r.actor_nama,
    r.timestamp,
    r.catatan
FROM riwayat_proses_dakem r
WHERE r.dana_kematian_id = :claim_id

UNION ALL

SELECT 
    'System Action' as type,
    a.action,
    a.actor_nama,
    a.created_at,
    jsonb_pretty(a.changes) as catatan
FROM audit_dana_kematian a
WHERE a.dana_kematian_id = :claim_id

ORDER BY timestamp DESC;
```

### 9.4 Compliance Reporting

**Required Reports**:
1. **Monthly Dakem Summary** - All claims by status
2. **Processing Time Report** - Average time per stage
3. **Financial Reconciliation** - Funds received vs delivered
4. **Document Compliance** - Completeness rates
5. **Exception Report** - Rejected, delayed, or problematic claims

---

## 10. Key Business Rules

### 10.1 Mandatory Rules

1. **Document Completeness**
   - All 5 main documents MUST be present before PP submission
   - PC cannot submit to PP without complete documentation
   - PP will reject incomplete applications

2. **Validation Requirements**
   - PC MUST perform active family validation (WhatsApp/Phone)
   - PP MUST verify all documents before approval
   - Calculation MUST be documented and approved

3. **Timeline Rules**
   - Waktu-0 (death date) is immutable
   - Waktu-1 through Waktu-7 must be in chronological order
   - No Waktu can be skipped

4. **Financial Rules**
   - Funds cannot be disbursed before PP approval
   - Proof of delivery is mandatory
   - Financial reports must reconcile

5. **Reporting Rules**
   - All three reports (handover, financial, feedback) are mandatory
   - Reports must be submitted within Waktu-7
   - Case cannot be closed without reports

### 10.2 Validation Rules

```sql
-- Example: Timeline validation
CREATE OR REPLACE FUNCTION validate_timeline()
RETURNS TRIGGER AS $$
BEGIN
    -- Ensure Waktu-1 after Waktu-0
    IF NEW.tanggal_lapor_keluarga < NEW.tanggal_meninggal THEN
        RAISE EXCEPTION 'Report date cannot be before death date';
    END IF;
    
    -- Ensure submission after initial receipt
    IF NEW.cabang_tanggal_kirim_ke_pusat < NEW.cabang_tanggal_awal_terima_berkas THEN
        RAISE EXCEPTION 'Submission date cannot be before initial receipt';
    END IF;
    
    -- Ensure PP validation after receipt
    IF NEW.pusat_tanggal_validasi < NEW.pusat_tanggal_awal_terima THEN
        RAISE EXCEPTION 'Validation date cannot be before PP receipt';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### 10.3 Business Constraints

1. **Heir Eligibility**
   - Must be designated in Surat Ahli Waris
   - Must provide valid identification
   - Must be contactable (active validation)

2. **Benefit Calculation**
   - Must follow organization regulations
   - Must be documented in calculation table
   - Must be approved by authorized personnel

3. **Document Validity**
   - Documents must be current (not expired)
   - Names must match across all documents
   - Dates must be consistent

4. **Status Transitions**
   - Cannot skip status levels
   - Cannot move backward (except returns for clarification)
   - Final status can only be 'selesai' or 'ditolak'

---

## 11. BPMN-Style Process Explanation

### 11.1 Process Flow (Text-Based BPMN)

```
START EVENT: Member Death (MD)
  ↓
EVENT: Death Report Received
  ↓
TASK: Record Death Report (PC)
  OUTPUT: Waktu-0, Berkas-1
  ↓
GATEWAY: Documents Complete?
  ├─ NO → TASK: Request Missing Documents (PC)
  │         ↓
  │     TASK: Receive Additional Documents (PC)
  │         ↓
  │     GATEWAY: Documents Complete? (LOOP)
  │
  └─ YES → TASK: Validate Family Data (PC)
             OUTPUT: Active validation (WhatsApp/Phone)
             ↓
          TASK: Compile Final Documents (PC)
             OUTPUT: Berkas-2, Waktu-2
             ↓
          TASK: Submit to PP (PC)
             OUTPUT: Waktu-2
             ↓
          TASK: Receive Application (PP)
             OUTPUT: Waktu-2
             ↓
          GATEWAY: Application Valid?
             ├─ NO → TASK: Return to PC (PP)
             │         ↓
             │     TASK: Correct Application (PC)
             │         ↓
             │     GATEWAY: Application Valid? (LOOP)
             │
             └─ YES → TASK: Validate Application (PP)
                       OUTPUT: Berkas-3, Waktu-3
                       ↓
                    TASK: Approve Application (PP)
                       OUTPUT: Waktu-4
                       ↓
                    TASK: Send to Finance (PP)
                       ↓
                    TASK: Calculate Benefit (PP)
                       OUTPUT: besaran_dana_kematian
                       ↓
                    TASK: Transfer to PC (PP)
                       OUTPUT: Waktu-5, Berkas-4
                       ↓
                    TASK: Receive Funds (PC)
                       ↓
                    TASK: Coordinate Delivery (PC)
                       ↓
                    TASK: Deliver to Heir (PC)
                       OUTPUT: Waktu-6, Berkas-5
                       ↓
                    TASK: Create Handover Report (PC)
                       OUTPUT: Berkas-6
                       ↓
                    TASK: Create Financial Report (PC)
                       ↓
                    TASK: Create Feedback Report (PC)
                       ↓
                    TASK: Submit Reports to PP (PC)
                       OUTPUT: Waktu-7, Berkas-7
                       ↓
END EVENT: Case Closed
```

### 11.2 Swimlane Diagram Description

**Swimlane 1: Family/Heir**
- Reports death
- Provides documents
- Receives funds
- Provides feedback

**Swimlane 2: Branch Office (PC)**
- Records death report
- Validates family data
- Compiles documents
- Submits to PP
- Receives funds
- Delivers to heir
- Creates reports
- Submits reports

**Swimlane 3: Central Office (PP)**
- Receives application
- Validates application
- Approves application
- Calculates benefit
- Transfers funds
- Receives reports

### 11.3 Decision Points

1. **Documents Complete?** (PC)
   - Input: Document checklist
   - Decision: Proceed or request more
   - Output: Complete application

2. **Family Validated?** (PC)
   - Input: Validation results
   - Decision: Confirm or investigate
   - Output: Confirmed heir

3. **Application Valid?** (PP)
   - Input: Application review
   - Decision: Approve or return
   - Output: Approved application

4. **Funds Delivered?** (PC)
   - Input: Delivery confirmation
   - Decision: Complete or follow up
   - Output: Delivery proof

### 11.4 Event Types

**Start Event**: Member Death (MD)
- Type: Timer/message event
- Trigger: Death occurrence

**Intermediate Events**:
- Document receipt (message event)
- Fund transfer (message event)
- Fund delivery (message event)

**End Event**: Case Closed
- Type: termination event
- Condition: All reports submitted

---

## 12. Implementation Recommendations

### 12.1 Priority 1 (Core Functionality)
1. Implement `dana_kematian` table with all Waktu fields
2. Create basic status flow (dilaporkan → selesai)
3. Document upload and storage
4. Basic validation rules
5. Status transition logging

### 12.2 Priority 2 (Enhanced Features)
1. Separate `dokumen_kematian` table
2. Document verification workflow
3. Calculation engine and `perhitungan_dana_kematian` table
4. Enhanced validation with rejection loops
5. Comprehensive audit trail

### 12.3 Priority 3 (Advanced Features)
1. Automated notifications
2. SLA monitoring and alerts
3. Advanced reporting dashboards
4. Integration with finance system
5. Mobile app for field validation

### 12.4 Security Considerations
1. Role-based access control (PC vs PP)
2. Document encryption
3. Audit trail immutability
4. Data retention policies
5. Compliance with data protection regulations

---

## 13. Glossary

| Term | Definition |
|------|------------|
| **Dakem** | Dana Kematian - Death Benefit |
| **MD** | Meninggal Dunia - Deceased |
| **PC** | Pengurus Cabang - Branch Office |
| **PP** | Pengurus Pusat - Central Office |
| **Waktu-0 to Waktu-7** | Timeline markers for process stages |
| **Berkas-1 to Berkas-7** | Document evolution markers |
| **MPS** | Status specific to pension system |
| **Ahli Waris** | Legal heir/beneficiary |
| **Edusus** | Educational support or handover documentation |

---

## Appendix A: Quick Reference

### Status Quick Check
```
dilaporkan → Initial report
verifikasi_cabang → PC validating
pending_dokumen → Missing documents
proses_pusat → At PP for review
disetujui → Approved
penyaluran → In delivery
selesai → Complete
ditolak → Rejected
```

### Timeline Quick Check
```
Waktu-0: Death
Waktu-1: Report to PC
Waktu-2: Submit to PP
Waktu-3: PP validates
Waktu-4: PP approves
Waktu-5: Transfer to PC
Waktu-6: Deliver to heir
Waktu-7: Submit reports
```

### Document Quick Check
```
Berkas-1: Initial documents
Berkas-2: Complete submission
Berkas-3: Validated at PP
Berkas-4: Transfer documentation
Berkas-5: Delivery proof
Berkas-6: Handover report
Berkas-7: Final reports
```

---

**Document Version**: 1.0  
**Last Updated**: 2026-04-24  
**Status**: Ready for Implementation