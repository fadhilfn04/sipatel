# Death Benefit System (Dana Kematian / Dakem)
## Complete Business Process & System Design Document

---

## 1. Process Overview

The Death Benefit (Dana Kematian) system manages the end-to-end workflow for processing and distributing death benefits to eligible members' heirs. The process involves three main actors across multiple stages with strict timeline tracking.

### Process Scope
- **Trigger**: Member death event
- **End**: Fund delivery to heir + complete reporting
- **Duration**: Typically 2-8 weeks depending on document completeness
- **Value**: Financial benefit based on member category and MPS status

### Key Actors
1. **Member/Heir (Ahli Waris)** - Beneficiary who receives the death benefit
2. **Branch Office (PC - Pimpinan Cabang)** - Local office handling initial processing and fund delivery
3. **Central Office (PP - Pimpinan Pusat)** - Head office handling verification and fund disbursement

### Process Timeline
- **Waktu-0**: Death event reporting
- **Waktu-1**: Initial document submission
- **Waktu-2**: Final document submission
- **Waktu-3**: PP validation completion
- **Waktu-4**: PP processing completion
- **Waktu-5**: Fund transfer to PC
- **Waktu-6**: Fund delivery to heir
- **Waktu-7**: Reporting completion

---

## 2. Detailed End-to-End Workflow

### A. Laporan Kematian (MD - Member Death)
**Actor**: Family/Member + Branch Office (PC)

**Input**:
- Death event information
- Oral/initial report from family
- Death certificate (optional at this stage)

**Process**:
1. Family reports member death to local PC (via phone, WhatsApp, or in-person)
2. PC records initial death report in system
3. PC creates death report entry with basic information
4. Death certificate obtained/submitted

**Output**:
- Death report record in `dana_kematian` table
- Death certificate document
- Initial status: `dilaporkan`

**Waktu Reference**: `waktu_0` - `tanggal_meninggal`, `tanggal_lapor_keluarga`

**Berkas Reference**: Berkas-Kematian (Death Certificate)

**System Action**:
```typescript
{
  status: "dilaporkan",
  waktu_0: new Date(), // tanggal_lapor_keluarga
  tanggal_meninggal: deathDate,
  cabang_asal_melapor: branchId
}
```

---

### B. Pengajuan Dakem (PC - Branch Application Processing)
**Actor**: Branch Office (PC)

**Input**:
- Death report from step A
- Heir (ahli waris) information
- Contact information

**Process**:
1. PC receives death report
2. **Active validation phase**:
   - Validate family data of deceased member
   - Verify heir relationship and eligibility
   - Contact family via WhatsApp/Phone for:
     - Document requirements explanation
     - Heir information verification
     - Timeline expectations
     - Next steps guidance
3. Guide heir on required document collection
4. Schedule document submission timeline

**Output**:
- Validated heir information
- Document requirement checklist sent to heir
- Status update to `verifikasi_cabang`
- Communication log recorded

**Waktu Reference**: `waktu_0` to `waktu_1` transition period

**Berkas Reference**: None (preparation phase)

**System Action**:
```typescript
{
  status: "verifikasi_cabang",
  nama_ahli_waris: heirName,
  status_ahli_waris: heirRelationship,
  nik_ahli_waris: heirNIK,
  no_hp_ahli_waris: heirPhone,
  alamat_ahli_waris: heirAddress,
  cabang_catatan_verifikasi: validationNotes
}
```

**Validation Rules**:
- Heir must be legitimate family member (spouse, child, parent)
- NIK must match family records (Kartu Keluarga)
- Phone number must be valid for communication

---

### C. Kompilasi Berkas (PC - Document Compilation)
**Actor**: Branch Office (PC) + Heir

**Input**:
- Validated heir information from step B
- Required documents from heir

**Process**:
1. **Berkas-1 (Initial Documents)**:
   - PC receives initial document set from heir
   - PC performs preliminary document check
   - PC identifies missing or incorrect documents
   - PC returns documents to heir with clarification requests
   - Status: `pending_dokumen`

2. **Berkas-2 (Final Documents)**:
   - PC receives corrected/complete document set
   - PC performs final document verification
   - PC validates all required documents are present
   - PC compiles complete application package
   - Status: `verifikasi_cabang` → `proses_pusat`
   - PC submits application to PP

**Output**:
- Complete document package
- Application submitted to PP
- All documents uploaded to system
- Status: `proses_pusat`

**Waktu Reference**:
- `waktu_1`: Initial document receipt
- `waktu_2`: Final document receipt & submission to PP

**Berkas Reference**:
- **Berkas-1**: Surat Kematian, SK Pensiun (initial versions)
- **Berkas-2**: Complete set including:
  - Surat Kematian (Death Certificate) - Valid
  - SK Pensiun (Pension Certificate) - Valid
  - Surat Pernyataan Ahli Waris (Heir Statement) - Signed
  - Kartu Keluarga (Family Card) - Complete
  - E-KTP Ahli Waris (Heir ID Card) - Valid
  - Surat Nikah (Marriage Certificate) - If applicable
  - Buku Rekening (Bank Book) - Active account
  - Surat Kuasa (Power of Attorney) - If applicable

**System Action**:
```typescript
// Berkas-1 received
{
  status: "pending_dokumen",
  waktu_1: new Date(), // Initial document receipt
  cabang_status_kelengkapan: "tidak_lengkap",
  cabang_catatan_verifikasi: "Missing documents: X, Y, Z"
}

// Berkas-2 received & submitted
{
  status: "proses_pusat",
  waktu_2: new Date(), // Final submission
  cabang_tanggal_kirim_ke_pusat: new Date(),
  cabang_status_kelengkapan: "lengkap",
  documents: { /* all documents uploaded */ }
}
```

**Document Validation Checklist**:
- [ ] Death certificate shows correct member name
- [ ] Pension certificate is valid
- [ ] Heir statement is signed by correct heir
- [ ] Family card includes deceased and heir
- [ ] Heir ID card matches family card
- [ ] Bank account is active and in heir's name
- [ ] All documents are current (not expired)

---

### D. Verifikasi Pengajuan (PP - Central Office Verification)
**Actor**: Central Office (PP)

**Input**:
- Complete application package from PC
- All documents (Berkas-2)

**Process**:
1. **Initial Receipt**:
   - PP receives application from PC
   - PP logs receipt in system
   - PP assigns validator

2. **Formal Verification**:
   - PP validates document completeness
   - PP verifies document authenticity
   - PP checks benefit calculation accuracy
   - PP validates member status and eligibility
   - PP verifies heir eligibility
   - PP cross-references with member database

3. **Validation Outcomes**:
   - **Valid & Complete**: Proceed to finalization
   - **Incomplete**: Return to PC for additional documents
   - **Invalid**: Reject with specific reasons

**Output**:
- Validation report
- Benefit calculation confirmation
- Status: `proses_pusat` → `verified` (or back to pending)
- Assigned validator and approver

**Waktu Reference**:
- `waktu_2`: Application received from PC
- `waktu_3`: Validation completed

**Berkas Reference**: Review of Berkas-2 documents

**System Action**:
```typescript
// Initial receipt
{
  status: "proses_pusat",
  waktu_2: application.cabang_tanggal_kirim_ke_pusat,
  pusat_tanggal_awal_terima: new Date(),
  pusat_petugas_validator: assignedValidator
}

// Validation completed
{
  status: "verified", // or "pending_dokumen" if returned
  waktu_3: new Date(), // Validation completion
  pusat_tanggal_validasi: new Date(),
  pusat_catatan_verifikasi: validationNotes,
  besaran_dana_kematian: calculatedAmount,
  kategori_dana: benefitCategory
}
```

**PP Validation Checklist**:
- [ ] All required documents present
- [ ] Documents are authentic and valid
- [ ] Member was in good standing
- [ ] Member category correct
- [ ] MPS status verified
- [ ] Heir relationship confirmed
- [ ] Benefit calculation correct
- [ ] Bank account information valid
- [ ] No duplicate claims exist
- [ ] Within claim timeframe limits

---

### E. Finalisasi Pengajuan (PP - Application Finalization)
**Actor**: Central Office (PP)

**Input**:
- Validated application from step D
- Benefit calculation confirmation

**Process**:
1. **Approval Process**:
   - PP lists approved Dakem in batch
   - PP obtains management approval
   - PP assigns approver
   - PP records approval decision

2. **Fund Processing**:
   - PP sends approved documents to finance department
   - Finance processes fund transfer
   - Funds transferred from PP account to PC account
   - Transfer confirmation recorded

3. **Completion Notification**:
   - PP notifies PC of fund transfer
   - PP provides transfer details
   - PP updates system status

**Output**:
- Approved Dakem list
- Fund transfer executed
- Transfer confirmation
- Status: `penyaluran`

**Waktu Reference**:
- `waktu_4`: Processing completion (approval + finance coordination)
- `waktu_5`: Fund transfer to PC

**Berkas Reference**: Internal finance documents (not part of main berkas)

**System Action**:
```typescript
// Processing completion
{
  status: "penyaluran",
  waktu_4: new Date(), // Approval & finance coordination complete
  pusat_tanggal_selesai: new Date(),
  pusat_petugas_approver: approverId
}

// Fund transfer executed
{
  status: "penyaluran",
  waktu_5: new Date(), // Transfer to PC completed
  metode_penyaluran: "transfer_bank",
  rekening_tujuan: pcBankAccount,
  jumlah_transfer: benefitAmount
}
```

**Finance Flow**:
```
PP Bank Account → PC Bank Account
Amount: Calculated benefit amount
Reference: Dakem ID + Member NIK
Method: Bank transfer
```

---

### F. Laporan Dakem (PC - Reporting & Fund Delivery)
**Actor**: Branch Office (PC) + Heir

**Input**:
- Fund transfer from PP
- Approved application documents

**Process**:
1. **Fund Receipt**:
   - PC receives fund transfer notification
   - PC confirms receipt in system
   - PC contacts heir for delivery arrangement

2. **Fund Delivery**:
   - PC schedules meeting with heir
   - PC delivers funds to heir (cash or transfer)
   - PC obtains heir receipt confirmation
   - PC records delivery details

3. **Reporting**:
   - **Berita Acara / Edusus** (Handover Report):
     - Details of fund delivery
     - Heir confirmation signature
     - Delivery date and method
     - Witness information

   - **Laporan Keuangan** (Financial Report):
     - Amount received from PP
     - Amount delivered to heir
     - Transaction fees (if any)
     - Bank reconciliation

   - **Laporan Feedback** (Feedback Report):
     - Heir satisfaction
     - Process feedback
     - Issues encountered
     - Recommendations

4. **Report Submission**:
   - PC submits all reports to PP
   - PP reviews and acknowledges reports
   - Case marked as complete

**Output**:
- Funds delivered to heir
- Complete report package
- Status: `selesai`

**Waktu Reference**:
- `waktu_6`: Fund delivery to heir
- `waktu_7`: Reporting completion

**Berkas Reference**:
- **Berkas-3**: Berita Acara Penyerahan (Handover Report)
- **Berkas-4**: Laporan Keuangan (Financial Report)
- **Berkas-5**: Laporan Feedback (Feedback Report)
- **Berkas-6**: Bukti Penyerahan (Delivery Receipt)
- **Berkas-7**: Dokumen Pendukung (Supporting Documents)

**System Action**:
```typescript
// Fund delivery
{
  status: "penyaluran",
  waktu_6: new Date(), // Fund delivered to heir
  tanggal_penyaluran: new Date(),
  metode_penyaluran_actual: "cash" | "transfer",
  penerima_dana: heirName,
  bukti_penyerahan: receiptDocumentUrl
}

// Reporting completion
{
  status: "selesai",
  waktu_7: new Date(), // All reports submitted
  laporan_keuangan: financialReportUrl,
  laporan_feedback: feedbackReportUrl,
  berita_acara: handoverReportUrl
}
```

**Delivery Checklist**:
- [ ] Heir identity verification
- [ ] Fund amount confirmation
- [ ] Delivery method executed
- [ ] Receipt signed by heir
- [ ] Witnesses present (if required)
- [ ] Photos taken (if applicable)
- [ ] Handover report created
- [ ] Financial report prepared
- [ ] Feedback collected

---

## 3. Document Management Design

### Main Documents (Stored in `dana_kematian` table)

#### Berkas-1: Initial Documents (Waktu-1)
- `file_surat_kematian` - Death Certificate
- `file_sk_pensiun` - Pension Certificate
- `file_kartu_keluarga` - Family Card

#### Berkas-2: Final Documents (Waktu-2)
Complete set including:
1. `file_surat_kematian` - Death Certificate (validated)
2. `file_sk_pensiun` - Pension Certificate (validated)
3. `file_surat_pernyataan_ahli_waris` - Heir Statement (signed)
4. `file_kartu_keluarga` - Family Card (complete)
5. `file_ktp_ahli_waris` - Heir ID Card (valid)
6. `file_surat_nikah` - Marriage Certificate (if applicable)
7. `file_buku_rekening` - Bank Book (active)
8. `file_surat_kuasa` - Power of Attorney (if applicable)

#### Berkas-3 to Berkas-7: Reporting Documents (Waktu-6 to Waktu-7)
3. `file_berita_acara` - Handover Report (Edusus)
4. `file_laporan_keuangan` - Financial Report
5. `file_laporan_feedback` - Feedback Report
6. `file_bukti_penyerahan` - Delivery Receipt
7. `file_dokumen_pendukung` - Supporting Documents

### Storage Strategy

**Primary Storage**: `dana_kematian` table
- All document URLs stored as individual columns
- Direct file references in main record
- Fast access and query performance

**Supporting Table**: `dokumen_kematian` (if needed)
```sql
CREATE TABLE dokumen_kematian (
  id UUID PRIMARY KEY,
  dana_kematian_id UUID REFERENCES dana_kematian(id),
  jenis_dokumen VARCHAR(100), -- surat_kematian, sk_pensiun, etc.
  file_url TEXT,
  file_name VARCHAR(255),
  file_size BIGINT,
  mime_type VARCHAR(100),
  upload_date TIMESTAMP,
  uploaded_by UUID,
  status_dokumen VARCHAR(50), -- draft, final, verified
  keterangan TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**File Storage Architecture**:
```
supabase-storage/
├── dana-kematian/
│   ├── {dana_kematian_id}/
│   │   ├── surat_kematian/
│   │   ├── sk_pensiun/
│   │   ├── surat_pernyataan_ahli_waris/
│   │   ├── kartu_keluarga/
│   │   ├── ktp_ahli_waris/
│   │   ├── surat_nikah/
│   │   ├── buku_rekening/
│   │   ├── surat_kuasa/
│   │   ├── berita_acara/
│   │   ├── laporan_keuangan/
│   │   ├── laporan_feedback/
│   │   ├── bukti_penyerahan/
│   │   └── dokumen_pendukung/
```

### Document Status Flow
1. **draft** - Document uploaded but not verified
2. **submitted** - Document submitted for verification
3. **verified** - Document verified by PC/PP
4. **rejected** - Document rejected (requires re-upload)
5. **final** - Final accepted version

---

## 4. Validation & Decision Flow

### PC Validation (Branch Level)

#### Data Validation
```typescript
interface PCValidation {
  // Member Data
  validateMemberData: {
    memberExists: boolean;
    memberIsActive: boolean;
    memberCategoryValid: boolean;
    mpsStatusCorrect: boolean;
  };

  // Heir Data
  validateHeirData: {
    heirRelationshipValid: boolean;
    heirNIKMatchesFamilyCard: boolean;
    heirContactValid: boolean;
    heirAddressComplete: boolean;
  };

  // Communication
  validateCommunication: {
    familyContacted: boolean;
    requirementsExplained: boolean;
    timelineAgreed: boolean;
    nextStepsConfirmed: boolean;
  };
}
```

#### PC Decision Flow
```
Death Report Received
    ↓
Validate Member Data
    ↓
[Member Invalid] → Reject/Request Clarification
    ↓
[Member Valid]
    ↓
Contact Family
    ↓
[Cannot Contact] → Follow-up Scheduled
    ↓
[Contacted] → Validate Heir Data
    ↓
[Heir Invalid] → Request Correct Information
    ↓
[Heir Valid] → Guide Document Collection
    ↓
Status: verifikasi_cabang
```

### PP Validation (Central Level)

#### Formal Verification
```typescript
interface PPValidation {
  // Document Completeness
  validateDocumentCompleteness: {
    allRequiredDocumentsPresent: boolean;
    documentsCurrent: boolean;
    documentsLegible: boolean;
    documentsAuthentic: boolean;
  };

  // Eligibility Verification
  validateEligibility: {
    memberStatusAtDeath: boolean;
    benefitCategoryCorrect: boolean;
    mpsStatusVerified: boolean;
    heirEligibilityConfirmed: boolean;
    noDuplicateClaims: boolean;
  };

  // Benefit Calculation
  validateCalculation: {
    baseAmountCorrect: boolean;
    mpsMultiplierCorrect: boolean;
    categoryAdjustmentCorrect: boolean;
    finalAmountAccurate: boolean;
  };
}
```

#### PP Decision Flow
```
Application Received from PC
    ↓
Initial Document Check
    ↓
[Incomplete] → Return to PC (status: pending_dokumen)
    ↓
[Complete]
    ↓
Formal Verification
    ↓
[Documents Invalid] → Reject (status: ditolak)
    ↓
[Documents Valid]
    ↓
Verify Eligibility
    ↓
[Not Eligible] → Reject with Reason (status: ditolak)
    ↓
[Eligible]
    ↓
Calculate Benefit
    ↓
[Calculation Error] → Recalculate
    ↓
[Calculation Correct]
    ↓
Approve Application
    ↓
Status: verified → penyaluran
```

### Rejection Loops

#### Rejection Types
1. **Temporary Rejection** (Fixable)
   - Missing documents
   - Invalid document format
   - Incorrect information
   - Action: Return to previous step for correction

2. **Permanent Rejection** (Not fixable)
   - Member not eligible
   - Fraud detected
   - Duplicate claim
   - Time limit exceeded
   - Action: Mark as `ditolak` with reason

#### Rejection Handling
```typescript
interface RejectionHandling {
  rejectionType: "temporary" | "permanent";
  rejectionReason: string;
  rejectionCategory: "document" | "eligibility" | "fraud" | "timeout";
  canResubmit: boolean;
  resubmissionDeadline?: Date;
  requiredActions?: string[];
  status: "ditolak" | "pending_dokumen";
}
```

---

## 5. Status Flow (System)

### Complete Status Lifecycle

#### 1. **dilaporkan** (Reported)
- **Trigger**: Death report created
- **Waktu**: `waktu_0`
- **Actor**: Family/PC
- **Next**: `verifikasi_cabang`
- **Conditions**: Basic death information recorded

#### 2. **verifikasi_cabang** (Branch Verification)
- **Trigger**: PC starts validation process
- **Waktu**: `waktu_0` → `waktu_1`
- **Actor**: PC
- **Next**: `pending_dokumen` or `proses_pusat`
- **Conditions**:
  - Member data validated
  - Heir information collected
  - Family contacted and guided

#### 3. **pending_dokumen** (Pending Documents)
- **Trigger**: Initial documents received but incomplete
- **Waktu**: `waktu_1`
- **Actor**: PC + Heir
- **Next**: `verifikasi_cabang` (re-submit) or `proses_pusat`
- **Conditions**:
  - Some documents missing/invalid
  - Communication ongoing with heir
  - Awaiting complete document set

#### 4. **proses_pusat** (Central Processing)
- **Trigger**: Complete application submitted to PP
- **Waktu**: `waktu_2`
- **Actor**: PP
- **Next**: `verified` or `ditolak`
- **Conditions**:
  - All documents received and verified by PC
  - Application package complete
  - Submitted to central office

#### 5. **verified** (Verified)
- **Trigger**: PP validation completed successfully
- **Waktu**: `waktu_3`
- **Actor**: PP Validator
- **Next**: `penyaluran`
- **Conditions**:
  - Document authenticity verified
  - Eligibility confirmed
  - Benefit calculation validated

#### 6. **penyaluran** (Distribution)
- **Trigger**: Fund transfer initiated
- **Waktu**: `waktu_4` → `waktu_6`
- **Actor**: PP Finance + PC
- **Next**: `selesai`
- **Conditions**:
  - Management approval obtained
  - Fund transfer to PC completed
  - PC delivering funds to heir

#### 7. **selesai** (Completed)
- **Trigger**: All reports submitted
- **Waktu**: `waktu_7`
- **Actor**: PC + PP
- **Next**: None (terminal state)
- **Conditions**:
  - Funds delivered to heir
  - All reports submitted
  - PP acknowledges completion

#### 8. **ditolak** (Rejected)
- **Trigger**: Application rejected at any stage
- **Waktu**: Varies
- **Actor**: PC or PP
- **Next**: None (terminal state) or back to previous
- **Conditions**:
  - Ineligible for benefit
  - Fraud detected
  - Documents cannot be corrected
  - Time limit exceeded

### Status Transition Matrix

| Current Status | Next Status | Trigger | Actor |
|---------------|-------------|---------|-------|
| dilaporkan | verifikasi_cabang | PC starts validation | PC |
| verifikasi_cabang | pending_dokumen | Initial docs incomplete | PC |
| verifikasi_cabang | proses_pusat | Complete app submitted | PC |
| pending_dokumen | verifikasi_cabang | Docs re-submitted | PC |
| proses_pusat | verified | Validation successful | PP |
| proses_pusat | ditolak | Validation failed | PP |
| proses_pusat | pending_dokumen | Docs returned to PC | PP |
| verified | penyaluran | Fund transfer initiated | PP |
| penyaluran | selesai | Reports completed | PC |
| *any* | ditolak | Rejection condition | PC/PP |

### Status Validation Rules
```typescript
const statusTransitions = {
  dilaporkan: ["verifikasi_cabang", "ditolak"],
  verifikasi_cabang: ["pending_dokumen", "proses_pusat", "ditolak"],
  pending_dokumen: ["verifikasi_cabang", "ditolak"],
  proses_pusat: ["verified", "pending_dokumen", "ditolak"],
  verified: ["penyaluran", "ditolak"],
  penyaluran: ["selesai", "ditolak"],
  selesai: [], // Terminal state
  ditolak: [] // Terminal state
};
```

---

## 6. Timeline Tracking

### Waktu Field Mapping

#### Waktu-0: Death Event & Reporting
```sql
ALTER TABLE dana_kematian ADD COLUMN waktu_0 TIMESTAMP;
UPDATE dana_kematian SET waktu_0 = tanggal_lapor_keluarga;
```
- **Field**: `waktu_0`
- **Display**: `tanggal_lapor_keluarga`
- **Purpose**: Initial death report timestamp
- **Validation**: Required, must be before `waktu_1`

#### Waktu-1: Initial Document Submission
```sql
ALTER TABLE dana_kematian ADD COLUMN waktu_1 TIMESTAMP;
```
- **Field**: `waktu_1`
- **Display**: `cabang_tanggal_awal_terima_berkas`
- **Purpose**: First document receipt from heir
- **Validation**: Must be after `waktu_0`
- **Business Rule**: If documents incomplete, status = `pending_dokumen`

#### Waktu-2: Final Document Submission
```sql
ALTER TABLE dana_kematian ADD COLUMN waktu_2 TIMESTAMP;
UPDATE dana_kematian SET waktu_2 = cabang_tanggal_kirim_ke_pusat;
```
- **Field**: `waktu_2`
- **Display**: `cabang_tanggal_kirim_ke_pusat`
- **Purpose**: Complete document submission to PP
- **Validation**: Must be after `waktu_1`
- **Business Rule**: Documents must be complete before this time

#### Waktu-3: PP Validation Completion
```sql
ALTER TABLE dana_kematian ADD COLUMN waktu_3 TIMESTAMP;
UPDATE dana_kematian SET waktu_3 = pusat_tanggal_validasi;
```
- **Field**: `waktu_3`
- **Display**: `pusat_tanggal_validasi`
- **Purpose**: PP verification completion
- **Validation**: Must be after `waktu_2`
- **Business Rule**: Benefit amount finalized at this point

#### Waktu-4: PP Processing Completion
```sql
ALTER TABLE dana_kematian ADD COLUMN waktu_4 TIMESTAMP;
UPDATE dana_kematian SET waktu_4 = pusat_tanggal_selesai;
```
- **Field**: `waktu_4`
- **Display**: `pusat_tanggal_selesai`
- **Purpose**: Approval and finance coordination complete
- **Validation**: Must be after `waktu_3`
- **Business Rule**: Fund transfer initiated after this

#### Waktu-5: Fund Transfer to PC
```sql
ALTER TABLE dana_kematian ADD COLUMN waktu_5 TIMESTAMP;
```
- **Field**: `waktu_5`
- **Display**: `tanggal_transfer_dana`
- **Purpose**: Fund transfer from PP to PC completed
- **Validation**: Must be after `waktu_4`
- **Business Rule**: Amount must match calculated benefit

#### Waktu-6: Fund Delivery to Heir
```sql
ALTER TABLE dana_kematian ADD COLUMN waktu_6 TIMESTAMP;
UPDATE dana_kematian SET waktu_6 = tanggal_penyaluran;
```
- **Field**: `waktu_6`
- **Display**: `tanggal_penyaluran`
- **Purpose**: Fund delivered to heir by PC
- **Validation**: Must be after `waktu_5`
- **Business Rule**: Delivery receipt obtained

#### Waktu-7: Reporting Completion
```sql
ALTER TABLE dana_kematian ADD COLUMN waktu_7 TIMESTAMP;
```
- **Field**: `waktu_7`
- **Display**: `tanggal_laporan_lengkap`
- **Purpose**: All reports submitted and acknowledged
- **Validation**: Must be after `waktu_6`
- **Business Rule**: Case can be marked `selesai`

### Timeline Validation Rules
```typescript
interface TimelineValidation {
  validateSequence: (waktu_n: Date, waktu_n_plus_1: Date) => boolean;
  validateDuration: (waktu_start: Date, waktu_end: Date, maxDays: number) => boolean;
  calculateProcessingTime: (waktu_0: Date, waktu_7: Date) => number;
  isOverdue: (waktu_current: Date, waktu_expected: Date) => boolean;
}

// Expected durations (business days)
const expectedDurations = {
  "waktu_0 to waktu_1": 7, // 1 week for initial documents
  "waktu_1 to waktu_2": 14, // 2 weeks for complete documents
  "waktu_2 to waktu_3": 5, // 5 days for PP validation
  "waktu_3 to waktu_4": 3, // 3 days for approval
  "waktu_4 to waktu_5": 2, // 2 days for fund transfer
  "waktu_5 to waktu_6": 7, // 1 week for delivery
  "waktu_6 to waktu_7": 3, // 3 days for reporting
  "total": 41 // ~6 weeks total
};
```

---

## 7. Database Design

### A. Enhanced dana_kematian Table

```sql
-- Add new fields to existing dana_kematian table
ALTER TABLE dana_kematian
-- Timeline fields (Waktu-0 to Waktu-7)
ADD COLUMN IF NOT EXISTS waktu_0 TIMESTAMP,
ADD COLUMN IF NOT EXISTS waktu_1 TIMESTAMP,
ADD COLUMN IF NOT EXISTS waktu_2 TIMESTAMP,
ADD COLUMN IF NOT EXISTS waktu_3 TIMESTAMP,
ADD COLUMN IF NOT EXISTS waktu_4 TIMESTAMP,
ADD COLUMN IF NOT EXISTS waktu_5 TIMESTAMP,
ADD COLUMN IF NOT EXISTS waktu_6 TIMESTAMP,
ADD COLUMN IF NOT EXISTS waktu_7 TIMESTAMP,

-- Additional tracking fields
ADD COLUMN IF NOT EXISTS tanggal_transfer_dana TIMESTAMP,
ADD COLUMN IF NOT EXISTS tanggal_laporan_lengkap TIMESTAMP,
ADD COLUMN IF NOT EXISTS tanggal_penyaluran_actual TIMESTAMP,

-- Communication tracking
ADD COLUMN IF NOT EXISTS komunikasi_status VARCHAR(50) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS komunikasi_catatan TEXT,
ADD COLUMN IF NOT EXISTS komunikasi_terakhir TIMESTAMP,

-- Document validation flags
ADD COLUMN IF NOT EXISTS dokumen_surat_kematian_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS dokumen_sk_pensiun_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS dokumen_surat_pernyataan_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS dokumen_kartu_keluarga_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS dokumen_ktp_ahli_waris_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS dokumen_surat_nikah_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS dokumen_buku_rekening_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS dokumen_surat_kuasa_verified BOOLEAN DEFAULT FALSE,

-- Reporting documents
ADD COLUMN IF NOT EXISTS file_berita_acara TEXT,
ADD COLUMN IF NOT EXISTS file_laporan_keuangan TEXT,
ADD COLUMN IF NOT EXISTS file_laporan_feedback TEXT,
ADD COLUMN IF NOT EXISTS file_bukti_penyerahan TEXT,
ADD COLUMN IF NOT EXISTS file_dokumen_pendukung TEXT,

-- Validation flags
ADD COLUMN IF NOT EXISTS is_validated_pc BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_validated_pp BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_funds_transferred BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_delivered BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_reported BOOLEAN DEFAULT FALSE,

-- Rejection handling
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS rejection_category VARCHAR(50),
ADD COLUMN IF NOT EXISTS can_resubmit BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS resubmission_deadline TIMESTAMP,

-- Performance tracking
ADD COLUMN IF NOT EXISTS total_processing_days INTEGER,
ADD COLUMN IF NOT EXISTS overdue_days INTEGER,
ADD COLUMN IF NOT EXISTS sla_status VARCHAR(20) DEFAULT 'on_track';

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_dana_kematian_waktu_0 ON dana_kematian(waktu_0);
CREATE INDEX IF NOT EXISTS idx_dana_kematian_waktu_7 ON dana_kematian(waktu_7);
CREATE INDEX IF NOT EXISTS idx_dana_kematian_status_proses ON dana_kematian(status_proses);
CREATE INDEX IF NOT EXISTS idx_dana_kematian_komunikasi_status ON dana_kematian(komunikasi_status);
CREATE INDEX IF NOT EXISTS idx_dana_kematian_sla_status ON dana_kematian(sla_status);
```

### Key Field Mappings

| Business Concept | Database Field | Type | Required |
|-----------------|----------------|------|----------|
| Waktu-0 | `waktu_0` | TIMESTAMP | Yes |
| Waktu-1 | `waktu_1` | TIMESTAMP | No |
| Waktu-2 | `waktu_2` | TIMESTAMP | Yes |
| Waktu-3 | `waktu_3` | TIMESTAMP | Yes |
| Waktu-4 | `waktu_4` | TIMESTAMP | Yes |
| Waktu-5 | `waktu_5` | TIMESTAMP | Yes |
| Waktu-6 | `waktu_6` | TIMESTAMP | Yes |
| Waktu-7 | `waktu_7` | TIMESTAMP | Yes |
| Death Date | `tanggal_meninggal` | DATE | Yes |
| Report Date | `tanggal_lapor_keluarga` | DATE | Yes |
| Communication Status | `komunikasi_status` | VARCHAR(50) | Yes |
| PC Validated | `is_validated_pc` | BOOLEAN | Yes |
| PP Validated | `is_validated_pp` | BOOLEAN | Yes |
| Approved | `is_approved` | BOOLEAN | Yes |
| Funds Transferred | `is_funds_transferred` | BOOLEAN | Yes |
| Delivered | `is_delivered` | BOOLEAN | Yes |
| Reported | `is_reported` | BOOLEAN | Yes |

### B. Supporting Tables

#### 1. dokumen_kematian (Document Management)
```sql
CREATE TABLE IF NOT EXISTS dokumen_kematian (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dana_kematian_id UUID NOT NULL REFERENCES dana_kematian(id) ON DELETE CASCADE,
  jenis_dokumen VARCHAR(100) NOT NULL, -- surat_kematian, sk_pensiun, etc.
  file_url TEXT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_size BIGINT,
  mime_type VARCHAR(100),
  upload_date TIMESTAMP DEFAULT NOW(),
  uploaded_by UUID REFERENCES users(id),
  status_dokumen VARCHAR(50) DEFAULT 'draft', -- draft, submitted, verified, rejected
  keterangan TEXT,
  is_final BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_dokumen_kematian_dana_kematian_id ON dokumen_kematian(dana_kematian_id);
CREATE INDEX idx_dokumen_kematian_jenis_dokumen ON dokumen_kematian(jenis_dokumen);
CREATE INDEX idx_dokumen_kematian_status_dokumen ON dokumen_kematian(status_dokumen);
```

#### 2. riwayat_proses_dakem (Process History)
```sql
CREATE TABLE IF NOT EXISTS riwayat_proses_dakem (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dana_kematian_id UUID NOT NULL REFERENCES dana_kematian(id) ON DELETE CASCADE,
  status_sebelumnya VARCHAR(50),
  status_setelahnya VARCHAR(50) NOT NULL,
  aksi VARCHAR(100) NOT NULL, -- created, submitted, verified, approved, rejected, etc.
  pelaku VARCHAR(100) NOT NULL, -- PC, PP, System
  pelaku_id UUID REFERENCES users(id),
  keterangan TEXT,
  data_sebelumnya JSONB,
  data_setelahnya JSONB,
  waktu_timestamp TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_riwayat_proses_dakem_dana_kematian_id ON riwayat_proses_dakem(dana_kematian_id);
CREATE INDEX idx_riwayat_proses_dakem_waktu_timestamp ON riwayat_proses_dakem(waktu_timestamp);
CREATE INDEX idx_riwayat_proses_dakem_status_setelahnya ON riwayat_proses_dakem(status_setelahnya);
```

#### 3. perhitungan_dana_kematian (Benefit Calculation)
```sql
CREATE TABLE IF NOT EXISTS perhitungan_dana_kematian (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dana_kematian_id UUID NOT NULL REFERENCES dana_kematian(id) ON DELETE CASCADE,
  kategori_anggota VARCHAR(50),
  status_mps VARCHAR(50),
  hubungan_ahli_waris VARCHAR(50),
  dasar_perhitungan NUMERIC(15,2),
  pengali_mps NUMERIC(5,2),
  penyesuaian_kategori NUMERIC(5,2),
  total_dana NUMERIC(15,2),
  rumus_perhitungan TEXT,
  dihitung_oleh UUID REFERENCES users(id),
  tanggal_perhitungan TIMESTAMP DEFAULT NOW(),
  diverifikasi BOOLEAN DEFAULT FALSE,
  tanggal_verifikasi TIMESTAMP,
  diverifikasi_oleh UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_perhitungan_dana_kematian_dana_kematian_id ON perhitungan_dana_kematian(dana_kematian_id);
```

#### 4. audit_dana_kematian (Audit Trail)
```sql
CREATE TABLE IF NOT EXISTS audit_dana_kematian (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dana_kematian_id UUID REFERENCES dana_kematian(id) ON DELETE SET NULL,
  tabel_target VARCHAR(100),
  operasi VARCHAR(20), -- INSERT, UPDATE, DELETE
  data_lama JSONB,
  data_baru JSONB,
  kolom_berubah VARCHAR(255),
  dilakukan_oleh UUID REFERENCES users(id),
  alasan TEXT,
  ip_address INET,
  user_agent TEXT,
  timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_dana_kematian_dana_kematian_id ON audit_dana_kematian(dana_kematian_id);
CREATE INDEX idx_audit_dana_kematian_timestamp ON audit_dana_kematian(timestamp);
CREATE INDEX idx_audit_dana_kematian_operasi ON audit_dana_kematian(operasi);
```

### C. Database Views for Reporting

#### 1. Complete Timeline View
```sql
CREATE OR REPLACE VIEW v_dakem_timeline AS
SELECT
  dk.id,
  dk.nama_anggota,
  dk.status_proses,
  dk.waktu_0 AS "Death Report",
  dk.waktu_1 AS "Initial Docs",
  dk.waktu_2 AS "Final Docs",
  dk.waktu_3 AS "PP Validated",
  dk.waktu_4 AS "Processing Complete",
  dk.waktu_5 AS "Funds Transferred",
  dk.waktu_6 AS "Delivered",
  dk.waktu_7 AS "Reported",
  EXTRACT(DAY FROM (COALESCE(dk.waktu_7, NOW()) - dk.waktu_0)) AS "Total Days",
  dk.sla_status
FROM dana_kematian dk
WHERE dk.deleted_at IS NULL;
```

#### 2. Performance Dashboard
```sql
CREATE OR REPLACE VIEW v_dakem_performance AS
SELECT
  dk.status_proses,
  COUNT(*) AS total_cases,
  AVG(EXTRACT(DAY FROM (COALESCE(dk.waktu_7, NOW()) - dk.waktu_0))) AS avg_processing_days,
  SUM(CASE WHEN dk.sla_status = 'overdue' THEN 1 ELSE 0 END) AS overdue_cases,
  SUM(CASE WHEN dk.sla_status = 'on_track' THEN 1 ELSE 0 END) AS on_track_cases
FROM dana_kematian dk
WHERE dk.deleted_at IS NULL
GROUP BY dk.status_proses;
```

---

## 8. Financial Flow

### A. Fund Transfer Flow (PP → PC)

#### Transfer Initiation
```typescript
interface FundTransfer {
  danaKematianId: string;
  fromAccount: {
    bank: string;
    accountNumber: string;
    accountName: string;
  };
  toAccount: {
    bank: string;
    accountNumber: string;
    accountName: string; // PC Bank Account
  };
  amount: number;
  reference: string; // "DAKEM-{id}-{memberNIK}"
  initiatedAt: Date;
  initiatedBy: string;
}
```

#### Transfer Execution
1. **Approval**: Management approves fund disbursement
2. **Processing**: Finance department processes transfer
3. **Execution**: Bank transfer executed
4. **Confirmation**: Transfer confirmation received
5. **Recording**: System updated with transfer details

#### Transfer Tracking
```sql
INSERT INTO dana_kematian (
  id,
  waktu_5,
  tanggal_transfer_dana,
  is_funds_transferred,
  metode_penyaluran,
  rekening_tujuan,
  bank_tujuan
) VALUES (
  ?,
  NOW(), -- waktu_5
  NOW(), -- tanggal_transfer_dana
  TRUE, -- is_funds_transferred
  'transfer_bank',
  'PC_ACCOUNT_NUMBER',
  'PC_BANK'
);
```

### B. Fund Delivery Flow (PC → Heir)

#### Delivery Methods
1. **Cash Delivery**
   - PC withdraws funds from account
   - PC meets heir in person
   - Cash handed over with receipt
   - Witness signs receipt

2. **Bank Transfer**
   - PC transfers directly to heir's account
   - Heir provides bank account details
   - Transfer confirmation as receipt
   - Electronic receipt generated

#### Delivery Process
```typescript
interface FundDelivery {
  danaKematianId: string;
  deliveryMethod: 'cash' | 'transfer';
  amount: number;
  heirName: string;
  heirAccount?: {
    bank: string;
    accountNumber: string;
  };
  deliveryDate: Date;
  deliveredBy: string;
  witnesses?: string[];
  receiptUrl: string;
  photos?: string[];
}
```

#### Delivery Recording
```sql
UPDATE dana_kematian SET
  waktu_6 = NOW(),
  tanggal_penyaluran_actual = NOW(),
  metode_penyaluran_actual = 'cash',
  is_delivered = TRUE,
  file_bukti_penyerahan = 'receipt_url',
  penerima_dana = heir_name
WHERE id = ?;
```

### C. Financial Reconciliation

#### Reconciliation Checklist
- [ ] Amount received from PP matches calculated benefit
- [ ] Amount delivered to heir matches received amount
- [ ] Transaction fees accounted for (if any)
- [ ] Bank statements match system records
- [ ] Receipt signatures obtained
- [ ] Photos of delivery (if cash)

#### Reconciliation Report
```sql
CREATE OR REPLACE VIEW v_dakem_reconcilation AS
SELECT
  dk.id,
  dk.nama_anggota,
  dk.besaran_dana_kematian AS "Benefit Amount",
  dk.metode_penyaluran AS "Transfer Method to PC",
  dk.metode_penyaluran_actual AS "Delivery Method to Heir",
  dk.tanggal_transfer_dana AS "Transfer Date",
  dk.tanggal_penyaluran_actual AS "Delivery Date",
  (dk.besaran_dana_kematian - dk.besaran_dana_kematian) AS "Reconciliation Status",
  dk.file_laporan_keuangan AS "Financial Report"
FROM dana_kematian dk
WHERE dk.status_proses = 'selesai'
AND dk.deleted_at IS NULL;
```

---

## 9. Reporting & Audit Trail

### A. Berita Acara Penyerahan (Handover Report)

#### Template Structure
```typescript
interface HandoverReport {
  reportNumber: string; // BA/DAKEM/{YYYYMMDD}/{sequence}
  reportDate: Date;
  danaKematianId: string;

  // Deceased Information
  deceasedName: string;
  deceasedNIK: string;
  memberNumber: string;
  deathDate: Date;

  // Heir Information
  heirName: string;
  heirNIK: string;
  heirRelationship: string;
  heirAddress: string;
  heirPhone: string;

  // Benefit Information
  benefitAmount: number;
  benefitCategory: string;

  // Delivery Information
  deliveryDate: Date;
  deliveryMethod: string;
  deliveryLocation: string;

  // PC Information
  pcName: string;
  pcRepresentative: string;
  pcPosition: string;

  // Witnesses
  witnesses: Array<{
    name: string;
    idNumber: string;
    signature: string;
  }>;

  // Acknowledgments
  heirSignature: string;
  pcSignature: string;
  witnessSignatures: string[];

  // Attachments
  deliveryPhoto?: string;
  idCardCopy: string;
  powerOfAttorney?: string;
}
```

### B. Laporan Keuangan (Financial Report)

#### Report Contents
```typescript
interface FinancialReport {
  reportPeriod: {
    startDate: Date;
    endDate: Date;
  };
  pcBranch: string;

  transactions: Array<{
    danaKematianId: string;
    memberName: string;
    memberNIK: string;
    amountReceivedFromPP: number;
    amountDeliveredToHeir: number;
    transactionDate: Date;
    transferMethod: string;
    bankReference?: string;
    deliveryMethod: string;
    receiptNumber: string;
    notes?: string;
  }>;

  summary: {
    totalCases: number;
    totalAmountReceived: number;
    totalAmountDelivered: number;
    transactionFees: number;
    netAmount: number;
    averageProcessingTime: number;
  };

  preparedBy: {
    name: string;
    position: string;
    date: Date;
    signature: string;
  };

  approvedBy: {
    name: string;
    position: string;
    date: Date;
    signature: string;
  };
}
```

### C. Laporan Feedback (Feedback Report)

#### Feedback Structure
```typescript
interface FeedbackReport {
  reportDate: Date;
  pcBranch: string;
  reportingPeriod: string;

  cases: Array<{
    danaKematianId: string;
    memberName: string;
    heirName: string;
    satisfactionLevel: 'very_satisfied' | 'satisfied' | 'neutral' | 'dissatisfied';
    processRating: number; // 1-5
    communicationRating: number; // 1-5
    timelinessRating: number; // 1-5

    feedback: {
      positiveAspects: string[];
      improvementAreas: string[];
      specificIssues: string[];
      suggestions: string[];
    };

    followUpRequired: boolean;
    followUpActions?: string[];
  }>;

  summary: {
    totalCases: number;
    averageSatisfaction: number;
    commonIssues: string[];
    topSuggestions: string[];
    improvementPlan: string[];
  };

  submittedBy: {
    name: string;
    position: string;
    date: Date;
  };
}
```

### D. Audit Trail System

#### Audit Log Entry
```typescript
interface AuditLog {
  id: string;
  danaKematianId: string;
  timestamp: Date;
  user: {
    id: string;
    name: string;
    role: string;
  };
  action: string;
  table: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  changes: {
    field: string;
    oldValue: any;
    newValue: any;
  }[];
  metadata: {
    ipAddress: string;
    userAgent: string;
    source: 'web' | 'api' | 'system';
  };
  reason?: string;
}
```

#### Critical Audit Points
1. **Status Changes**: All status transitions
2. **Document Uploads**: File additions and modifications
3. **Financial Transactions**: Amount changes and transfers
4. **Approvals**: Management approval actions
5. **Rejections**: Rejection reasons and categories
6. **Data Modifications**: Critical field changes
7. **User Actions**: Login, logout, permission changes

---

## 10. Key Business Rules

### A. Eligibility Rules

#### Member Eligibility
1. Member must be active at time of death
2. Member must have valid MPS status
3. Member category determines benefit amount
4. Death must be reported within 90 days

#### Heir Eligibility
1. Heir must be legitimate family member:
   - Spouse (suami/istri)
   - Child (anak)
   - Parent (orang tua)
   - Legal heir (ahli waris sah)
2. Heir must provide valid identification
3. Heir must be listed in family card (Kartu Keluarga)
4. Minor heirs require legal guardian

### B. Benefit Calculation Rules

#### Base Amount Matrix
```typescript
const benefitMatrix = {
  // Base amounts by member category
  baseAmounts: {
    "PNS": 15000000,
    "Pensiunan": 15000000,
    "CPNS": 10000000,
    "THL": 5000000
  },

  // MPS multiplier
  mpsMultipliers: {
    "MPS": 1.5,
    "Non-MPS": 1.0
  },

  // Heir relationship adjustment
  heirAdjustments: {
    "suami": 1.0,
    "istri": 1.0,
    "anak": 1.0,
    "orang_tua": 0.75,
    "ahli_waris_lain": 0.5
  }
};

function calculateBenefit(
  memberCategory: string,
  mpsStatus: string,
  heirRelationship: string
): number {
  const base = benefitMatrix.baseAmounts[memberCategory];
  const mpsMultiplier = benefitMatrix.mpsMultipliers[mpsStatus];
  const heirAdjustment = benefitMatrix.heirAdjustments[heirRelationship];

  return base * mpsMultiplier * heirAdjustment;
}
```

### C. Document Rules

#### Required Documents (All Cases)
1. **Surat Kematian** - Death certificate from hospital/local authority
2. **SK Pensiun** - Pension certificate for retired members
3. **Surat Pernyataan Ahli Waris** - Heir statement letter
4. **Kartu Keluarga** - Family card showing relationship
5. **E-KTP Ahli Waris** - Heir's ID card
6. **Buku Rekening** - Active bank account in heir's name

#### Conditional Documents
- **Surat Nikah** - Required if heir is spouse
- **Surat Kuasa** - Required if representative claims on behalf of heir

#### Document Validity
- Documents must be original or certified copies
- Documents must be legible
- Documents must be current (not expired)
- Names must match across all documents

### D. Timeline Rules

#### Maximum Processing Times
```typescript
const maximumProcessingTimes = {
  "waktu_0 to waktu_1": 14, // 2 weeks for initial docs
  "waktu_1 to waktu_2": 30, // 1 month for complete docs
  "waktu_2 to waktu_3": 7, // 1 week for PP validation
  "waktu_3 to waktu_4": 5, // 5 days for approval
  "waktu_4 to waktu_5": 3, // 3 days for fund transfer
  "waktu_5 to waktu_6": 14, // 2 weeks for delivery
  "waktu_6 to waktu_7": 7, // 1 week for reporting
  "total": 80 // ~2.5 months absolute maximum
};
```

#### Escalation Rules
- If `waktu_1` not reached within 14 days: Escalate to PC supervisor
- If `waktu_2` not reached within 30 days: Escalate to PP
- If `waktu_3` not reached within 7 days: Escalate to PP manager
- If total time exceeds 80 days: Executive review

### E. Approval Rules

#### PC Approval Authority
- Can validate documents up to Rp 50 million
- Cannot approve final amounts
- Must submit to PP for final approval

#### PP Approval Authority
- Can approve any amount
- Requires management approval for amounts > Rp 100 million
- Finance department must verify all transfers

### F. Rejection Rules

#### Rejection Categories
1. **Document Issues**
   - Missing required documents
   - Invalid document format
   - Expired documents
   - Inconsistent information

2. **Eligibility Issues**
   - Member not active
   - Heir not eligible
   - Duplicate claim
   - Time limit exceeded

3. **Fraud Indicators**
   - Suspicious documents
   - Inconsistent information
   - Multiple claims from same heir
   - Unusual patterns

#### Rejection Process
1. Identify rejection category
2. Document specific reasons
3. Determine if resubmission allowed
4. Set resubmission deadline if applicable
5. Notify stakeholder (PC/Heir)
6. Record rejection in audit log

---

## 11. BPMN-style Explanation (Text)

### Process Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        DEATH BENEFIT PROCESS FLOW                            │
└─────────────────────────────────────────────────────────────────────────────┘

START: Member Death Event
        ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│ A. LAPORAN KEMATIAN (MD)                                                    │
│ Actor: Family + Branch Office (PC)                                         │
│ Input: Death event, oral report                                            │
│ Process: Record death report, obtain death certificate                     │
│ Output: Death report record, death certificate                             │
│ Status: dilaporkan                                                          │
│ Waktu: waktu_0 (tanggal_lapor_keluarga)                                    │
│ Berkas: Berkas-Kematian                                                   │
└─────────────────────────────────────────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│ B. PENGAJUAN DAKEM (PC)                                                     │
│ Actor: Branch Office (PC)                                                  │
│ Input: Death report from step A                                            │
│ Process: Validate member data, verify heir info, contact family            │
│          (WhatsApp/Phone), guide document collection                       │
│ Output: Validated heir info, communication log                             │
│ Status: verifikasi_cabang                                                   │
│ Waktu: Transition from waktu_0 to waktu_1                                  │
│ Berkas: None (preparation phase)                                          │
│                                                                             │
│ VALIDATION:                                                                 │
│  - Member data validation                                                  │
│  - Heir relationship verification                                          │
│  - Active communication with family                                        │
└─────────────────────────────────────────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│ C. KOMPILASI BERKAS (PC)                                                    │
│ Actor: Branch Office (PC) + Heir                                           │
│ Input: Validated heir info from step B                                     │
│ Process: Receive initial documents (Berkas-1), identify gaps               │
│          Receive final documents (Berkas-2), submit to PP                  │
│ Output: Complete document package                                         │
│ Status: pending_dokumen → proses_pusat                                     │
│ Waktu: waktu_1 (initial), waktu_2 (final)                                 │
│ Berkas: Berkas-1 (initial), Berkas-2 (final)                              │
│                                                                             │
│ DECISION POINT:                                                             │
│  [Documents Complete?] → YES: Submit to PP                                 │
│                     → NO: Request more documents, status: pending_dokumen  │
└─────────────────────────────────────────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│ D. VERIFIKASI PENGAJUAN (PP)                                                │
│ Actor: Central Office (PP)                                                 │
│ Input: Complete application from PC                                        │
│ Process: Receive application, validate documents, verify eligibility       │
│          calculate benefit, perform formal verification                    │
│ Output: Validation report, benefit confirmation                            │
│ Status: proses_pusat → verified (or ditolak)                               │
│ Waktu: waktu_2 (received), waktu_3 (validated)                            │
│ Berkas: Review of Berkas-2                                                 │
│                                                                             │
│ DECISION POINT:                                                             │
│  [Valid & Complete?] → YES: Proceed to approval                            │
│                    → NO: Return to PC (status: pending_dokumen)           │
│                               or Reject (status: ditolak)                  │
│                                                                             │
│ VALIDATION CHECKLIST:                                                       │
│  - All documents present and authentic                                     │
│  - Member eligibility confirmed                                           │
│  - Heir eligibility verified                                              │
│  - Benefit calculation accurate                                           │
└─────────────────────────────────────────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│ E. FINALISASI PENGAJUAN (PP)                                                │
│ Actor: Central Office (PP) + Finance                                       │
│ Input: Validated application from step D                                   │
│ Process: List approved Dakem, obtain management approval                   │
│          send to finance, process fund transfer to PC                      │
│ Output: Approved list, fund transfer executed                              │
│ Status: verified → penyaluran                                               │
│ Waktu: waktu_4 (processing), waktu_5 (transfer)                           │
│ Berkas: Internal finance documents                                         │
│                                                                             │
│ FINANCIAL FLOW:                                                             │
│  PP Bank Account → PC Bank Account                                        │
│  Amount: Calculated benefit amount                                        │
│  Method: Bank transfer                                                    │
└─────────────────────────────────────────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│ F. LAPORAN DAKEM (PC)                                                       │
│ Actor: Branch Office (PC) + Heir                                           │
│ Input: Fund transfer from PP                                               │
│ Process: Receive funds, deliver to heir, create reports                    │
│          (Berita Acara, Laporan Keuangan, Laporan Feedback)                │
│ Output: Funds delivered, complete reports                                  │
│ Status: penyaluran → selesai                                                │
│ Waktu: waktu_6 (delivery), waktu_7 (reporting)                            │
│ Berkas: Berkas-3 to Berkas-7                                               │
│                                                                             │
│ DELIVERY METHODS:                                                           │
│  - Cash delivery with receipt                                              │
│  - Bank transfer to heir account                                           │
│                                                                             │
│ REPORTS REQUIRED:                                                           │
│  - Berita Acara Penyerahan (Handover report)                               │
│  - Laporan Keuangan (Financial report)                                     │
│  - Laporan Feedback (Feedback report)                                      │
└─────────────────────────────────────────────────────────────────────────────┘
        ↓
      END: Process Complete

┌─────────────────────────────────────────────────────────────────────────────┐
│                           EXCEPTION HANDLING                                │
└─────────────────────────────────────────────────────────────────────────────┘

REJECTION LOOPS:
1. PC Level Rejection:
   - Invalid member data → Request clarification
   - Invalid heir info → Request correct information
   - Cannot contact family → Follow-up scheduled

2. PP Level Rejection:
   - Incomplete documents → Return to PC (status: pending_dokumen)
   - Invalid documents → Reject (status: ditolak)
   - Not eligible → Reject with reason (status: ditolak)
   - Duplicate claim → Reject (status: ditolak)

ESCALATION PATHS:
- Documents overdue → PC Supervisor → PP Manager
- Processing overdue → PP Manager → Director
- Payment issues → Finance Manager → CFO

```

### Swimlane Diagram

```
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│   FAMILY/HEIR    │  │  BRANCH (PC)     │  │  CENTRAL (PP)    │
└──────────────────┘  └──────────────────┘  └──────────────────┘
       │                      │                      │
   [Death occurs]            │                      │
       │                      │                      │
       └─────────────────────┤                      │
       Report death          │                      │
                             ▼                      │
                      [Record report]              │
                      [Create case]                │
                      Status: dilaporkan           │
                             │                      │
                             ├─────────────────────┤
                             Validate member       │
                             Contact heir          │
                             Guide documents       │
                             ▼                      │
                      [Collect documents]    │
                             │                      │
                             ├─────────────────────┤
                       [Receive docs]              │
                       [Verify docs]               │
                       [Submit to PP]              │
                       Status: proses_pusat        │
                             │                      │
                             └─────────────────────┤
                                             [Receive application]
                                             [Validate documents]
                                             [Verify eligibility]
                                             [Calculate benefit]
                                                    │
                                              ┌─────┴─────┐
                                              │           │
                                        [Valid]    [Invalid]
                                              │           │
                                              ▼           ▼
                                        [Approve]   [Return/Reject]
                                              │
                                        [Send to Finance]
                                        [Transfer to PC]
                                        Status: penyaluran
                                              │
                             ┌─────────────────┤
                             │                 │
                        [Receive funds]   [Notify heir]
                        [Contact heir]          │
                        [Schedule delivery]     │
                             │                 │
                        [Deliver funds]         │
                        [Get receipt]           │
                        [Create reports]        │
                        Status: selesai         │
                             │                 │
                             └─────────────────┤
                                             [Receive reports]
                                             [Acknowledge completion]
```

---

## Implementation Priority

### Phase 1: Core Process (Waktu-0 to Waktu-3)
1. Database schema updates (waktu fields)
2. Status flow implementation
3. PC validation workflow
4. Document upload system
5. PP verification workflow

### Phase 2: Financial Flow (Waktu-4 to Waktu-6)
1. Benefit calculation engine
2. Approval workflow
3. Fund transfer tracking
4. Delivery management
5. Receipt generation

### Phase 3: Reporting (Waktu-7)
1. Report generation (Berita Acara, Laporan Keuangan, Laporan Feedback)
2. Document management system
3. Audit trail implementation
4. Performance dashboard

### Phase 4: Optimization
1. SLA monitoring
2. Escalation automation
3. Notification system
4. Advanced reporting
5. Business intelligence

---

## Conclusion

This business process design provides a comprehensive framework for implementing the Death Benefit (Dana Kematian) system. The process flow strictly follows the Waktu-0 through Waktu-7 timeline, with clear actor responsibilities, validation rules, and status transitions.

The system is designed to:
- Maintain complete audit trails
- Ensure financial accountability
- Provide transparent processing
- Support efficient workflow
- Enable comprehensive reporting
- Facilitate regulatory compliance

The database design leverages the existing `dana_kematian` table while adding supporting tables for enhanced functionality. All business rules, validation criteria, and process flows are implementation-ready.

---

**Document Version**: 1.0
**Last Updated**: 2026-04-24
**Status**: Implementation Ready
