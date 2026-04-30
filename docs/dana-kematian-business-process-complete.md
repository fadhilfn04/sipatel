# Death Benefit System (Dana Kematian / Dakem)
## Complete Business Process & System Design Document

**Version**: 2.0  
**Last Updated**: 2026-04-25  
**Status**: Implementation Ready  
**Database**: Supabase (PostgreSQL)  
**Main Entity**: `dana_kematian`

---

## 📋 Table of Contents

1. [Process Overview](#1-process-overview)
2. [Detailed End-to-End Workflow](#2-detailed-end-to-end-workflow)
3. [Document Management Design](#3-document-management-design)
4. [Validation & Decision Flow](#4-validation--decision-flow)
5. [Status Flow System](#5-status-flow-system)
6. [Timeline Tracking](#6-timeline-tracking)
7. [Database Design](#7-database-design)
8. [Financial Flow](#8-financial-flow)
9. [Reporting & Audit Trail](#9-reporting--audit-trail)
10. [Key Business Rules](#10-key-business-rules)
11. [BPMN-style Explanation](#11-bpmn-style-explanation)
12. [Implementation Roadmap](#12-implementation-roadmap)

---

## 1. Process Overview

### 1.1 Purpose

The Death Benefit (Dana Kematian) system manages the complete end-to-end workflow for processing and distributing death benefits to eligible members' heirs. This system ensures:

- **Complete audit trails** for compliance and transparency
- **Financial accountability** through tracked fund flows
- **Transparent processing** with clear status visibility
- **Efficient workflow** minimizing processing delays
- **Comprehensive reporting** for management oversight

### 1.2 Process Scope

| Aspect | Description |
|--------|-------------|
| **Trigger Event** | Member death (MD - Meninggal Dunia) |
| **Completion Condition** | All reports submitted to PP and case closed |
| **Total Duration** | Typically 2-8 weeks depending on document completeness |
| **Timeline Tracking** | Waktu-0 through Waktu-7 (8 critical milestones) |
| **Document Tracking** | Berkas-1 through Berkas-7 (document evolution stages) |

### 1.3 Key Actors

#### 1. Member / Heir (Ahli Waris)
- **Role**: Beneficiary
- **Responsibilities**:
  - Report member death to PC
  - Provide required documents
  - Receive death benefit funds
  - Provide feedback on process

#### 2. Branch Office (PC - Pimpinan Cabang)
- **Role**: First-level processor and fund deliverer
- **Responsibilities**:
  - Receive and record death reports
  - **Active validation** of family data (WhatsApp/Phone)
  - Compile and verify documents
  - Submit complete applications to PP
  - Receive funds from PP
  - Deliver funds to heir
  - Create and submit all reports

#### 3. Central Office (PP - Pimpinan Pusat)
- **Role**: Final approver and funder
- **Responsibilities**:
  - Receive applications from PC
  - Perform formal verification
  - Validate eligibility and calculate benefits
  - Approve applications
  - Process fund transfers to PC
  - Receive and acknowledge reports

### 1.4 Process Timeline Overview

```
Waktu-0  [Death Event & Initial Report]
    ↓ (0-7 days)
Waktu-1  [Initial Document Receipt - Berkas-1]
    ↓ (7-30 days)
Waktu-2  [Final Document Submission - Berkas-2]
    ↓ (0-5 days)
Waktu-3  [PP Validation Complete]
    ↓ (0-3 days)
Waktu-4  [PP Processing Complete]
    ↓ (0-2 days)
Waktu-5  [Fund Transfer to PC]
    ↓ (0-14 days)
Waktu-6  [Fund Delivery to Heir - Berkas-5,6]
    ↓ (0-7 days)
Waktu-7  [Reporting Complete - Berkas-7]
    ↓
END [Case Closed]
```

---

## 2. Detailed End-to-End Workflow

### A. Laporan Kematian (MD - Member Death)

**Phase**: Initial reporting and death certification  
**Waktu Reference**: **Waktu-0**  
**Actor**: Family/Heir → Branch Office (PC)

#### Input
- Death event information
- Oral/initial report from family member
- Preliminary death details (date, place, cause)

#### Process Details

1. **Death Event Occurs**
   - Member passes away
   - Family notifies immediate relatives

2. **Family Reports to PC**
   - Family contacts local PC office via:
     - Phone call
     - WhatsApp message
     - In-person visit
   - PC records initial death report

3. **Death Report Recording**
   - PC creates death report entry in system
   - PC records basic information:
     - Deceased member name
     - Date of death
     - Place of death
     - Reporter information
     - Contact details

4. **Death Certificate Acquisition**
   - Family obtains death certificate from:
     - Hospital (if died in medical facility)
     - Local government office (Dinas Kependudukan)
     - Police department (if required)
   - Death certificate must be:
     - Officially stamped
     - Signed by authorized personnel
     - On official letterhead

#### Output
- **System Record**: Death report created in `dana_kematian` table
- **Document**: Death certificate (Surat Kematian)
- **Status**: `dilaporkan`
- **Waktu-0**: `tanggal_meninggal` and `tanggal_lapor_keluarga` populated

#### System Actions
```typescript
// Create death report
{
  status_proses: "dilaporkan",
  waktu_0: new Date(), // tanggal_lapor_keluarga
  tanggal_meninggal: deathDate,
  cabang_asal_melapor: branchId,
  cabang_nama_pelapor: reporterName,
  cabang_nik_pelapor: reporterNIK,
  nama_anggota: memberName,
  status_anggota: memberStatus,
  status_mps: mpsStatus
}
```

#### Berkas Reference
- **Berkas-Kematian**: Initial death report and death certificate

#### Validation Rules
- [ ] Death date is not in the future
- [ ] Member exists in database
- [ ] Member status is active (not already deceased)
- [ ] Reporter information is captured

---

### B. Pengajuan Dakem (PC - Branch Application Processing)

**Phase**: Active validation and communication  
**Waktu Reference**: Transition from **Waktu-0** to **Waktu-1**  
**Actor**: Branch Office (PC)

#### Input
- Death report from Phase A
- Heir (ahli waris) information
- Contact information from family

#### Process Details

1. **Receive Death Report**
   - PC reviews death report details
   - PC identifies deceased member in system
   - PC retrieves member data:
     - Member category
     - MPS status
     - Family information on file
     - Benefit eligibility

2. **Active Validation Phase**
   
   **THIS IS AN ACTIVE, NOT PASSIVE, PHASE**
   
   PC must perform **active validation and communication**:
   
   a. **Validate Family Data of Deceased**
      - Verify family composition
      - Confirm eligible heirs
      - Check family records (Kartu Keluarga on file)
      - Identify primary heir(s)
   
   b. **Verify Heir Information**
      - Confirm heir relationship to deceased
      - Validate heir eligibility based on:
        - Spouse (suami/istri)
        - Child (anak)
        - Parent (orang tua)
        - Legal heir (ahli waris sah)
      - Check heir age and legal capacity
   
   c. **Perform Active Coordination**
      - **Contact family via WhatsApp/Phone** (MANDATORY)
      - Explain document requirements clearly
      - Provide timeline expectations
      - Answer family questions
      - Schedule document submission appointment
      - Document all communication attempts

3. **Guide Heir on Document Collection**
   - Provide document checklist
   - Explain each document's purpose
   - Specify format requirements (original/certified copy)
   - Set deadline for document submission
   - Offer assistance if needed

4. **Schedule Document Submission**
   - Set appointment for document handover
   - Confirm heir availability
   - Prepare document receipt form

#### Output
- **Validated Heir Information**:
  - `nama_ahli_waris`
  - `status_ahli_waris` (relationship)
  - `nik_ahli_waris`
  - `no_hp_ahli_waris`
  - `alamat_ahli_waris`
  
- **Communication Log**:
  - Contact attempts recorded
  - Communication status tracked
  - Next steps confirmed

- **Status**: `verifikasi_cabang`

- **Document Checklist**: Provided to heir

#### System Actions
```typescript
// Update with validated heir information
{
  status_proses: "verifikasi_cabang",
  
  // Heir information
  nama_ahli_waris: heirName,
  status_ahli_waris: heirRelationship, // istri, suami, anak, keluarga
  nik_ahli_waris: heirNIK,
  no_hp_ahli_waris: heirPhone,
  alamat_ahli_waris: heirAddress,
  
  // Communication tracking
  komunikasi_status: "completed", // pending, in_progress, completed
  komunikasi_catatan: "Family contacted via WhatsApp on [date]. " +
                     "Document requirements explained. " +
                     "Appointment scheduled for [date/time].",
  komunikasi_terakhir: new Date(),
  
  // PC validation
  cabang_petugas_verifikator: verifierName,
  cabang_catatan_verifikasi: "Heir eligibility confirmed. " +
                             "Documents checklist provided."
}
```

#### Berkas Reference
- None (preparation phase only)

#### Validation Rules
- [ ] Member data validated successfully
- [ ] Heir relationship verified
- [ ] Heir NIK matches family records (if available)
- [ ] Phone number is valid and working
- [ ] Family contacted successfully (WhatsApp/Phone)
- [ ] Document requirements explained
- [ ] Timeline agreed upon
- [ ] Next steps confirmed

#### Communication Log Template
```typescript
interface CommunicationLog {
  date: Date;
  method: "whatsapp" | "phone" | "in_person" | "email";
  contacted_by: string; // PC staff name
  contact_person: string; // Family member name
  outcome: "successful" | "unsuccessful" | "follow_up_required";
  notes: string;
  next_action: string;
  next_action_date: Date;
}
```

---

### C. Kompilasi Berkas (PC - Document Compilation)

**Phase**: Document collection and compilation  
**Waktu Reference**: **Waktu-1** (initial) → **Waktu-2** (final)  
**Actor**: Branch Office (PC) + Heir

#### Input
- Validated heir information from Phase B
- Required documents from heir
- Document checklist from Phase B

#### Process Details

This phase occurs in **two stages**:

##### Stage 1: Berkas-1 (Initial Documents) - Waktu-1

1. **Receive Initial Document Set**
   - Heir submits first batch of documents
   - PC performs preliminary document check
   - PC creates receipt for submitted documents

2. **Preliminary Document Check**
   - Verify document types
   - Check for obvious issues:
     - Missing signatures
     - Incomplete information
     - Wrong formats
     - Expired documents
   - Identify gaps or inconsistencies

3. **Gap Analysis**
   - List missing documents
   - List documents needing correction
   - List documents needing clarification
   - Prioritize required vs. conditional documents

4. **Return to Heir with Feedback**
   - PC explains what's missing/incorrect
   - PC provides specific correction instructions
   - PC sets deadline for complete submission
   - Status updated to `pending_dokumen`

5. **System Update**
```typescript
{
  status_proses: "pending_dokumen",
  waktu_1: new Date(), // Initial document receipt
  cabang_tanggal_awal_terima_berkas: new Date(),
  cabang_status_kelengkapan: "tidak_lengkap", // or "kurang"
  cabang_catatan_verifikasi: "Missing: X, Y, Z. " +
                             "Corrections needed: A, B. " +
                             "Follow-up scheduled: [date]."
}
```

##### Stage 2: Berkas-2 (Final Documents) - Waktu-2

1. **Receive Final Document Set**
   - Heir submits corrected/complete documents
   - PC performs final document verification
   - All required documents must be present

2. **Final Document Verification**
   - **Death Certificate (Surat Kematian)**
     - [ ] Official stamp present
     - [ ] Authorized signature present
     - [ ] Deceased name matches member record
     - [ ] Date of death matches report
     - [ ] No alterations or erasures
   
   - **Pension Certificate (SK Pensiun)**
     - [ ] Valid pension number
     - [ ] Member name matches
     - [ ] Document is current
     - [ ] Official stamp present
   
   - **Heir Statement (Surat Pernyataan Ahli Waris)**
     - [ ] Heir signature present
     - [ ] Statement is on proper letterhead (if applicable)
     - [ ] Notarized if required
     - [ ] Clear declaration of heir status
   
   - **Family Card (Kartu Keluarga)**
     - [ ] Includes deceased member
     - [ ] Includes heir making claim
     - [ ] Relationship is clear
     - [ ] Document is current (not expired)
     - [ ] Official stamp present
   
   - **Heir ID Card (E-KTP Ahli Waris)**
     - [ ] Heir name matches family card
     - [ ] NIK matches family card
     - [ ] ID card is valid (not expired)
     - [ ] Photo is clear and identifiable
   
   - **Conditional Documents** (if applicable):
     - **Marriage Certificate (Surat Nikah)** - if heir is spouse
     - **Bank Account Book (Buku Rekening)** - for fund transfer
     - **Power of Attorney (Surat Kuasa)** - if representative claiming

3. **Compile Complete Application Package**
   - Organize all documents in order
   - Create document index
   - Prepare submission cover letter
   - Make copies for PC records
   - Prepare package for PP submission

4. **Submit to PP**
   - Package sent to central office
   - Tracking number obtained
   - Submission recorded in system

5. **System Update**
```typescript
{
  status_proses: "proses_pusat",
  waktu_2: new Date(), // Final submission
  cabang_tanggal_kirim_ke_pusat: new Date(),
  cabang_status_kelengkapan: "lengkap",
  cabang_catatan_verifikasi: "All documents verified and complete. " +
                             "Submitted to PP via [courier/method]. " +
                             "Tracking: [number].",
  
  // Document URLs
  file_surat_kematian: "url_to_death_certificate",
  file_sk_pensiun: "url_to_pension_certificate",
  file_surat_pernyataan_ahli_waris: "url_to_heir_statement",
  file_kartu_keluarga: "url_to_family_card",
  file_e_ktp: "url_to_heir_id_card",
  file_surat_nikah: "url_to_marriage_certificate", // if applicable
  file_buku_rekening: "url_to_bank_book", // if applicable
  file_surat_kuasa: "url_to_power_of_attorney" // if applicable
}
```

#### Output

##### From Stage 1 (Waktu-1)
- Incomplete document set
- Gap analysis report
- Correction instructions for heir
- Status: `pending_dokumen`

##### From Stage 2 (Waktu-2)
- **Complete document package (Berkas-2)**
- Application submitted to PP
- All documents uploaded to system
- Status: `proses_pusat`

#### Berkas Reference

##### Berkas-1 (Waktu-1) - Initial Documents
May include:
- Partial death certificate
- Draft heir statement
- Incomplete family card
- Some ID documents

##### Berkas-2 (Waktu-2) - Final Complete Set
Must include:
1. ✅ **Surat Kematian** (Death Certificate) - Valid and complete
2. ✅ **SK Pensiun** (Pension Certificate) - Valid
3. ✅ **Surat Pernyataan Ahli Waris** (Heir Statement) - Signed
4. ✅ **Kartu Keluarga** (Family Card) - Complete and current
5. ✅ **E-KTP Ahli Waris** (Heir ID Card) - Valid
6. ⚠️ **Surat Nikah** (Marriage Certificate) - If heir is spouse
7. ⚠️ **Buku Rekening** (Bank Book) - For fund transfer
8. ⚠️ **Surat Kuasa** (Power of Attorney) - If applicable

#### Document Validation Checklist (PC Level)

```typescript
interface DocumentValidation {
  document_type: string;
  is_present: boolean;
  is_valid: boolean;
  issues: string[];
  verified_by: string;
  verification_date: Date;
}

const pcDocumentChecklist: DocumentValidation[] = [
  {
    document_type: "surat_kematian",
    is_present: true,
    is_valid: true,
    issues: [],
    verified_by: "PC Staff Name",
    verification_date: new Date()
  },
  // ... other documents
];
```

#### Validation Rules

##### Stage 1 (Waktu-1)
- [ ] Documents received and logged
- [ ] Gap analysis completed
- [ ] Heir contacted with feedback
- [ ] Follow-up scheduled

##### Stage 2 (Waktu-2)
- [ ] All 5 main documents present
- [ ] All documents verified for authenticity
- [ ] All documents match member/heir information
- [ ] All documents are current (not expired)
- [ ] Names are consistent across documents
- [ ] Dates are logical and consistent
- [ ] No obvious alterations or fraud indicators
- [ ] Package prepared for PP submission

---

### D. Verifikasi Pengajuan (PP - Central Office Verification)

**Phase**: Formal verification and validation  
**Waktu Reference**: **Waktu-2** (received) → **Waktu-3** (validated)  
**Actor**: Central Office (PP)

#### Input
- Complete application package from PC (Berkas-2)
- All required documents
- PC validation report

#### Process Details

##### Stage 1: Initial Receipt - Waktu-2

1. **Receive Application from PC**
   - Package arrives at PP office
   - Reception logs receipt in system
   - Package assigned a reference number
   - Initial document count performed

2. **Assign Validator**
   - PP assigns staff member as validator
   - Validator credentials verified
   - Case added to validator's queue

3. **Initial Document Check**
   - Verify package completeness
   - Confirm all documents from checklist present
   - Check for physical damage to documents
   - Verify PC validation was performed

4. **System Update**
```typescript
{
  status_proses: "proses_pusat", // remains in this status
  waktu_2: application.cabang_tanggal_kirim_ke_pusat, // Use PC's submission time
  pusat_tanggal_awal_terima: new Date(),
  pusat_nomor_referensi: "DAKEM-PP-2026-XXXX",
  pusat_petugas_validator: validatorName
}
```

##### Stage 2: Formal Verification - Waktu-3

1. **Document Completeness Verification**
   
   For each document:
   - [ ] Document is present
   - [ ] Document is original or certified copy
   - [ ] Document is legible
   - [ ] Document is complete (no pages missing)
   - [ ] Document has required signatures
   - [ ] Document has official stamps/seals

2. **Document Authenticity Verification**
   
   a. **Death Certificate**
      - Verify issuing authority
      - Check official stamp authenticity
      - Confirm signature belongs to authorized personnel
      - Cross-check with government records if needed
   
   b. **Pension Certificate**
      - Verify pension number in system
      - Confirm member status at time of death
      - Check document validity period
   
   c. **Heir Statement**
      - Verify signature authenticity
      - Check notarization if required
      - Confirm statement clarity
   
   d. **Family Card**
      - Verify government issuance
      - Check document number in government system (if possible)
      - Confirm all family members listed
   
   e. **Heir ID Card**
      - Verify NIK in government system (if possible)
      - Check card validity period
      - Confirm photo matches holder

3. **Eligibility Verification**
   
   a. **Member Eligibility**
      - [ ] Member was active at time of death
      - [ ] Member category is correct
      - [ ] MPS status is verified
      - [ ] No prior death claims exist
      - [ ] Member was in good standing
   
   b. **Heir Eligibility**
      - [ ] Heir relationship is legitimate
      - [ ] Heir is of legal age (or has guardian)
      - [ ] Heir is designated in family card
      - [ ] No conflicting heir claims exist
      - [ ] Heir has valid identification

4. **Benefit Calculation**
   
   a. **Determine Base Amount**
      - Based on member category:
        - PNS: Rp 15.000.000
        - Pensiunan: Rp 15.000.000
        - CPNS: Rp 10.000.000
        - THL: Rp 5.000.000
   
   b. **Apply MPS Multiplier**
      - MPS: 1.5x
      - Non-MPS: 1.0x
   
   c. **Apply Heir Relationship Adjustment**
      - Spouse (suami/istri): 1.0x
      - Child (anak): 1.0x
      - Parent (orang tua): 0.75x
      - Other family: 0.5x
   
   d. **Calculate Final Amount**
      ```
      Final Amount = Base Amount × MPS Multiplier × Heir Adjustment
      ```

5. **Generate Validation Report**
   - Summary of findings
   - List of verified documents
   - Eligibility confirmation
   - Benefit calculation details
   - Recommendation (approve/return/reject)

6. **Decision Point**

   **IF Application is Valid and Complete**:
   - Proceed to finalization phase
   - Update status to `verified`
   - Calculate and record benefit amount
   - Prepare approval documents

   **ELSE IF Issues Can Be Fixed**:
   - Return application to PC
   - Provide specific correction requirements
   - Update status to `pending_dokumen`
   - Set resubmission deadline

   **ELSE IF Application is Invalid**:
   - Reject application
   - Provide detailed rejection reasons
   - Update status to `ditolak`
   - Notify PC and heir

7. **System Update**
```typescript
// If validated
{
  status_proses: "verified", // New status
  waktu_3: new Date(), // Validation completion
  pusat_tanggal_validasi: new Date(),
  pusat_catatan_verifikasi: "All documents verified authentic. " +
                             "Member eligibility confirmed. " +
                             "Heir eligibility verified. " +
                             "Benefit calculated: Rp " + amount,
  
  // Benefit calculation
  besaran_dana_kematian: calculatedAmount,
  kategori_dana: benefitCategory, // rutin, khusus, premi
  rumus_perhitungan: baseAmount + " × " + mpsMultiplier + " × " + heirAdjustment
}

// If returned to PC
{
  status_proses: "pending_dokumen",
  waktu_3: new Date(),
  pusat_catatan_verifikasi: "Documents returned for correction: " +
                             "[specific issues]. " +
                             "Resubmit by: [deadline].",
  rejection_reason: "[Specific reasons]",
  can_resubmit: true,
  resubmission_deadline: deadlineDate
}

// If rejected
{
  status_proses: "ditolak",
  waktu_3: new Date(),
  rejection_reason: "[Detailed reasons]",
  rejection_category: "eligibility" | "document" | "fraud" | "timeout",
  can_resubmit: false
}
```

#### Output

##### If Validated
- **Validation Report**: Complete verification summary
- **Benefit Calculation**: Confirmed amount
- **Recommendation**: Approved for finalization
- **Status**: `verified`

##### If Returned
- **Correction Requirements**: Specific issues list
- **Resubmission Deadline**: Date for resubmission
- **Status**: `pending_dokumen` (returned to PC)

##### If Rejected
- **Rejection Notice**: Detailed reasons
- **Rejection Category**: Type of rejection
- **Status**: `ditolak`

#### Berkas Reference
- **Review of Berkas-2**: All documents from PC submission

#### PP Validation Checklist

```typescript
interface PPValidationChecklist {
  // Document Verification
  document_completeness: boolean;
  document_authenticity: boolean;
  document_legibility: boolean;
  
  // Eligibility Verification
  member_status_valid: boolean;
  member_category_correct: boolean;
  mps_status_verified: boolean;
  heir_relationship_confirmed: boolean;
  heir_eligibility_verified: boolean;
  no_duplicate_claims: boolean;
  
  // Benefit Calculation
  base_amount_correct: boolean;
  mps_multiplier_correct: boolean;
  heir_adjustment_correct: boolean;
  final_amount_accurate: boolean;
  
  // Overall
  can_proceed: boolean;
  validation_notes: string;
}
```

#### Validation Rules

##### Mandatory Approvals
- [ ] All required documents present and authentic
- [ ] Member eligibility confirmed
- [ ] Heir eligibility verified
- [ ] Benefit calculation verified by senior staff
- [ ] No duplicate claims in system

##### Return Conditions
- Missing documents that can be obtained
- Correctable information errors
- Expired documents that can be renewed
- Clarification needed on specific points

##### Rejection Conditions
- Member was not eligible
- Fraudulent documents detected
- Duplicate claim exists
- Time limit for claiming has expired
- Heir is not eligible
- Documents cannot be authenticated

---

### E. Finalisasi Pengajuan (PP - Application Finalization)

**Phase**: Approval and fund processing  
**Waktu Reference**: **Waktu-4** (processing complete) → **Waktu-5** (transfer)  
**Actor**: Central Office (PP) + Finance Department

#### Input
- Validated application from Phase D
- Benefit calculation confirmation
- Validation report with approval recommendation

#### Process Details

##### Stage 1: Approval Process - Waktu-4

1. **List Approved Dakem**
   - PP compiles list of approved applications
   - List includes:
     - Application reference number
     - Deceased member name
     - Heir name
     - Approved benefit amount
     - PC branch for fund transfer
   - List reviewed by management

2. **Management Approval**
   
   For claims **under Rp 100 million**:
   - Approved by PP department head
   - Single signature required
   
   For claims **Rp 100 million and above**:
   - Approved by PP director
   - Additional signature required
   - Finance department review required

3. **Assign Approver**
   - Management assigns approver
   - Approver reviews application package
   - Approver verifies benefit calculation
   - Approver confirms eligibility

4. **Record Approval**
   - Approval date recorded
   - Approver name recorded
   - Approval reference number generated
   - Application marked as approved

5. **System Update**
```typescript
{
  status_proses: "penyaluran", // Ready for fund transfer
  waktu_4: new Date(), // Approval and finance coordination complete
  pusat_tanggal_selesai: new Date(),
  pusat_petugas_approver: approverName,
  is_approved: true,
  approval_date: new Date(),
  approval_reference: "APPROVAL-DAKEM-2026-XXXX"
}
```

##### Stage 2: Fund Processing

1. **Send to Finance Department**
   - Approved list sent to finance
   - Supporting documents attached:
     - Approved applications list
     - Benefit calculations summary
     - PC bank account details
     - Total fund requirement

2. **Finance Processing**
   
   a. **Verify Fund Availability**
      - Check account balance
      - Confirm funds available
      - Plan fund disbursement schedule
   
   b. **Prepare Transfer Instructions**
      - List PC bank accounts
      - Specify amounts per PC
      - Include reference numbers
      - Generate transfer batch

3. **Execute Fund Transfer**
   
   a. **PP → PC Bank Transfer**
      - Finance initiates bank transfers
      - Transfer method: Bank transfer (electronic)
      - Transfer reference: "DAKEM-[dana_kematian_id]-[member_nik]"
      - Amount: Calculated benefit amount
   
   b. **Transfer Confirmation**
      - Bank confirms transfer
      - Transfer reference number obtained
      - Transfer date recorded
      - PC notified of incoming funds

4. **System Update**
```typescript
{
  status_proses: "penyaluran", // Still in this status until delivery
  waktu_5: new Date(), // Transfer to PC completed
  tanggal_transfer_dana: new Date(),
  is_funds_transferred: true,
  
  // Transfer details
  metode_penyaluran: "transfer_bank",
  rekening_tujuan: pcBankAccountNumber,
  bank_tujuan: pcBankName,
  jumlah_transfer: benefitAmount,
  referensi_transfer: "DAKEM-" + danaKematianId + "-" + memberNIK,
  
  // Finance tracking
  finance_processed_by: financeStaffName,
  finance_approved_by: financeManagerName,
  finance_reference: "FIN-DAKEM-2026-XXXX"
}
```

5. **Notify PC**
   - PP sends notification to PC
   - Notification includes:
     - Transfer confirmation
     - Amount transferred
     - Transfer reference
     - Expected delivery timeline
     - Reporting requirements

#### Output

##### From Stage 1 (Waktu-4)
- **Approved Dakem List**: All approved applications
- **Management Approval**: Signed approval document
- **Benefit Confirmation**: Final calculated amounts

##### From Stage 2 (Waktu-5)
- **Fund Transfer Executed**: PP → PC transfer completed
- **Transfer Confirmation**: Bank transfer details
- **PC Notification**: PC informed of fund receipt

#### Berkas Reference
- **Internal Finance Documents**:
  - Approved applications list
  - Fund transfer instructions
  - Bank transfer confirmations
  - Reconciliation reports

#### Financial Flow Diagram

```
PP Bank Account
    ↓ (Transfer)
PC Bank Account
    ↓ (Held in account)
    ↓ (Later: Delivery to heir)
Heir (receives funds)
```

#### Validation Rules

##### Before Approval
- [ ] Validation complete and successful
- [ ] Benefit calculation verified
- [ ] Management approval obtained
- [ ] Funds available in PP account

##### Before Transfer
- [ ] PC bank account details verified
- [ ] Transfer amount matches benefit amount
- [ ] Transfer reference generated
- [ ] Finance approval obtained

##### After Transfer
- [ ] Bank confirmation received
- [ ] Transfer recorded in system
- [ ] PC notified successfully

---

### F. Laporan Dakem (PC - Reporting & Fund Delivery)

**Phase**: Fund delivery and completion reporting  
**Waktu Reference**: **Waktu-6** (delivery) → **Waktu-7** (reporting)  
**Actor**: Branch Office (PC) + Heir

#### Input
- Fund transfer from PP (Waktu-5)
- Approved application documents
- Heir contact information

#### Process Details

##### Stage 1: Fund Receipt & Coordination

1. **Receive Fund Transfer**
   - PC confirms fund receipt from PP
   - PC verifies amount received
   - PC records transfer in system
   - PC matches transfer to specific claim

2. **Contact Heir**
   - PC contacts heir to schedule delivery
   - PC explains delivery process:
     - Delivery method (cash or transfer)
     - Required identification
     - Witness requirements (if any)
     - Delivery location
     - Delivery date and time

3. **Prepare Delivery**
   - Prepare cash (if delivering cash)
   - Prepare transfer form (if transferring)
   - Prepare receipt documents
   - Arrange witnesses (if required)

##### Stage 2: Fund Delivery - Waktu-6

1. **Meet with Heir**
   - Verify heir identity:
     - Check E-KTP
     - Confirm name matches records
     - Confirm relationship to deceased
   
2. **Deliver Funds**
   
   **Method A: Cash Delivery**
   - Count cash in front of heir
   - Obtain heir signature on receipt
   - Obtain witness signatures (if required)
   - Take photos of delivery (if required)
   - Provide copy of receipt to heir
   
   **Method B: Bank Transfer**
   - Transfer to heir's bank account
   - Obtain transfer confirmation
   - Email receipt to heir
   - Confirm heir receipt of funds

3. **Obtain Delivery Proof**
   - Signed receipt from heir
   - Witness signatures (if applicable)
   - Photos of delivery (if cash)
   - Transfer confirmation (if bank transfer)

4. **System Update**
```typescript
{
  status_proses: "penyaluran", // Still here until reports done
  waktu_6: new Date(), // Fund delivered to heir
  tanggal_penyaluran_actual: new Date(),
  is_delivered: true,
  
  // Delivery details
  metode_penyaluran_actual: "cash" | "transfer",
  penerima_dana: heirName,
  cabang_tanggal_serah_ke_ahli_waris: new Date(),
  cabang_petugas_penyerah: deliveryStaffName,
  
  // Delivery proof
  file_bukti_penyerahan: "url_to_receipt_document",
  delivery_photos: ["url_to_photo1", "url_to_photo2"], // if cash
  transfer_confirmation: "url_to_transfer_confirmation" // if transfer
}
```

##### Stage 3: Report Creation

PC must create **three mandatory reports**:

#### Report 1: Berita Acara Penyerahan (Handover Report) - Berkas-3

**Purpose**: Document fund delivery to heir  
**Content**:
```typescript
interface BeritaAcaraPenyerahan {
  // Report identification
  nomor_berita_acara: string; // BA/DAKEM/2026/XXXX
  tanggal_pembuatan: Date;
  dana_kematian_id: string;
  
  // Deceased information
  nama_almarhum: string;
  nik_almarhum: string;
  nomor_anggota: string;
  tanggal_meninggal: Date;
  
  // Heir information
  nama_ahli_waris: string;
  nik_ahli_waris: string;
  status_hubungan: string;
  alamat_ahli_waris: string;
  no_hp_ahli_waris: string;
  
  // Benefit information
  besaran_dana: number;
  kategori_dana: string;
  
  // Delivery information
  tanggal_penyerahan: Date;
  metode_penyerahan: string; // tunai or transfer
  tempat_penyerahan: string;
  
  // PC information
  nama_cabang: string;
  nama_petugas: string;
  jabatan_petugas: string;
  
  // Witnesses
  saksi_satu: {
    nama: string;
    nik: string;
    tanda_tangan: string;
  };
  saksi_dua: {
    nama: string;
    nik: string;
    tanda_tangan: string;
  };
  
  // Acknowledgments
  tanda_tangan_ahli_waris: string;
  tanda_tangan_petugas: string;
  tanda_tangan_saksi: string[];
  
  // Attachments
  foto_penyerahan: string[];
  fotokopi_ktp_ahli_waris: string;
  bukti_penyerahan: string;
}
```

#### Report 2: Laporan Keuangan (Financial Report) - Berkas-4

**Purpose**: Track fund disbursement and reconciliation  
**Content**:
```typescript
interface LaporanKeuangan {
  // Report identification
  nomor_laporan: string; // LK/DAKEM/2026/XXXX
  periode_laporan: {
    tanggal_mulai: Date;
    tanggal_selesai: Date;
  };
  nama_cabang: string;
  
  // Transaction details
  transaksi: {
    dana_kematian_id: string;
    nama_almarhum: string;
    nama_ahli_waris: string;
    jumlah_diterima_dari_pp: number;
    jumlah_diserahkan_ke_ahli_waris: number;
    tanggal_penyerahan: Date;
    metode_penyerahan: string;
    referensi_transfer: string;
    nomor_rekening: string;
  };
  
  // Summary
  ringkasan: {
    total_kasus: number;
    total_dana_diterima: number;
    total_dana_diserahkan: number;
    biaya_transaksi: number;
    dana_bersih: number;
  };
  
  // Prepared by
  disiapkan_oleh: {
    nama: string;
    jabatan: string;
    tanggal: Date;
    tanda_tangan: string;
  };
  
  // Approved by
  disetujui_oleh: {
    nama: string;
    jabatan: string;
    tanggal: Date;
    tanda_tangan: string;
  };
}
```

#### Report 3: Laporan Feedback (Feedback Report) - Berkas-5

**Purpose**: Heir satisfaction and process improvement  
**Content**:
```typescript
interface LaporanFeedback {
  // Report identification
  nomor_laporan: string; // LF/DAKEM/2026/XXXX
  tanggal_laporan: Date;
  nama_cabang: string;
  
  // Case details
  dana_kematian_id: string;
  nama_almarhum: string;
  nama_ahli_waris: string;
  
  // Feedback
  tingkat_kepuasan: "sangat_baik" | "baik" | "cukup" | "kurang";
  penilaian_proses: {
    keramahan_petugas: number; // 1-5
    kecepatan_proses: number; // 1-5
    kualitas_informasi: number; // 1-5
    kemudahan_prosedur: number; // 1-5
  };
  
  catatan: {
    aspek_positif: string[];
    area_perbaikan: string[];
    isu_spesifik: string[];
    saran: string[];
  };
  
  // Follow-up required
  memerlukan_tindak_lanjut: boolean;
  tindak_lanjut: string[];
  
  // Submitted by
  disusun_oleh: {
    nama: string;
    jabatan: string;
    tanggal: Date;
  };
}
```

##### Stage 4: Report Submission - Waktu-7

1. **Complete All Reports**
   - Berita Acara completed and signed
   - Laporan Keuangan prepared and approved
   - Laporan Feedback collected and compiled

2. **Submit Reports to PP**
   - Reports packaged together
   - Submitted via:
     - Physical mail (with tracking)
     - Email (with digital signatures)
     - System upload (with verification)
   
3. **PP Acknowledgment**
   - PP receives reports
   - PP verifies report completeness
   - PP acknowledges receipt
   - Case marked as complete

4. **System Update**
```typescript
{
  status_proses: "selesai", // Final status
  waktu_7: new Date(), // All reports submitted
  tanggal_laporan_lengkap: new Date(),
  is_reported: true,
  cabang_tanggal_lapor_ke_pusat: new Date(),
  
  // Report URLs
  file_berita_acara: "url_to_handover_report",
  file_laporan_keuangan: "url_to_financial_report",
  file_laporan_feedback: "url_to_feedback_report",
  
  // Completion
  completed_at: new Date(),
  completed_by: pcStaffName
}
```

#### Output

##### From Stage 2 (Waktu-6)
- **Funds Delivered**: Heir receives benefit amount
- **Delivery Proof**: Signed receipt and supporting documents
- **Berkas-6**: Bukti Penyerahan (Delivery Receipt)

##### From Stage 3 (Report Creation)
- **Berkas-3**: Berita Acara Penyerahan (Handover Report)
- **Berkas-4**: Laporan Keuangan (Financial Report)
- **Berkas-5**: Laporan Feedback (Feedback Report)

##### From Stage 4 (Waktu-7)
- **Berkas-7**: Complete report package submitted to PP
- **Case Closed**: Status updated to `selesai`

#### Berkas Reference

| Berkas | Description | Waktu | Required |
|--------|-------------|-------|----------|
| **Berkas-3** | Berita Acara Penyerahan (Handover Report) | Waktu-6 | Yes |
| **Berkas-4** | Laporan Keuangan (Financial Report) | Waktu-6 | Yes |
| **Berkas-5** | Laporan Feedback (Feedback Report) | Waktu-6 | Yes |
| **Berkas-6** | Bukti Penyerahan (Delivery Receipt) | Waktu-6 | Yes |
| **Berkas-7** | Complete Report Package (All above) | Waktu-7 | Yes |

#### Delivery Checklist

```typescript
interface DeliveryChecklist {
  // Pre-delivery
  heir_identity_verified: boolean;
  heir_contact_confirmed: boolean;
  delivery_method_confirmed: boolean;
  witnesses_arranged: boolean;
  
  // During delivery
  funds_prepared: boolean;
  receipt_document_prepared: boolean;
  identification_verified: boolean;
  explanation_provided: boolean;
  
  // Post-delivery
  receipt_signed: boolean;
  witnesses_signed: boolean;
  photos_taken: boolean;
  transfer_confirmed: boolean; // if applicable
  
  // Reporting
  berita_acara_created: boolean;
  laporan_keuangan_prepared: boolean;
  laporan_feedback_collected: boolean;
  reports_submitted: boolean;
}
```

#### Validation Rules

##### Before Delivery (Waktu-6)
- [ ] Funds received from PP
- [ ] Heir identity verified
- [ ] Delivery method determined
- [ ] Witnesses arranged (if required)
- [ ] Receipt documents prepared

##### After Delivery (Waktu-6)
- [ ] Funds successfully delivered
- [ ] Receipt signed by heir
- [ ] Proof of delivery obtained
- [ ] Transfer confirmed (if applicable)

##### Before Reporting (Waktu-7)
- [ ] Berita Acara completed and signed
- [ ] Laporan Keuangan prepared and approved
- [ ] Laporan Feedback collected and compiled
- [ ] All reports verified for completeness

##### After Reporting (Waktu-7)
- [ ] Reports submitted to PP
- [ ] PP acknowledgment received
- [ ] Case marked as complete
- [ ] All documents archived

---

## 3. Document Management Design

### 3.1 Main Documents (Required)

| Document | Purpose | Required | Waktu | Storage Field |
|----------|---------|----------|-------|---------------|
| **Surat Kematian** | Proof of death | Yes | Waktu-0 | `file_surat_kematian` |
| **SK Pensiun** | Proof of pension status | Yes | Waktu-1 | `file_sk_pensiun` |
| **Surat Pernyataan Ahli Waris** | Legal heir designation | Yes | Waktu-1 | `file_surat_pernyataan_ahli_waris` |
| **Kartu Keluarga** | Family composition proof | Yes | Waktu-1 | `file_kartu_keluarga` |
| **E-KTP Ahli Waris** | Heir identification | Yes | Waktu-1 | `file_e_ktp` |

### 3.2 Supporting Documents (Conditional)

| Document | Purpose | Required | Waktu | Storage Field |
|----------|---------|----------|-------|---------------|
| **Surat Nikah** | Marriage proof | If heir is spouse | Waktu-1 | `file_surat_nikah` |
| **Buku Rekening** | Bank account for transfer | Yes | Waktu-1 | `file_buku_rekening` |
| **Surat Kuasa** | Power of attorney | If representative | Waktu-1 | `file_surat_kuasa` |

### 3.3 Reporting Documents (Required for Completion)

| Document | Purpose | Waktu | Storage Field |
|----------|---------|-------|---------------|
| **Berita Acara Penyerahan** | Handover documentation | Waktu-6 | `file_berita_acara` |
| **Laporan Keuangan** | Financial reconciliation | Waktu-6 | `file_laporan_keuangan` |
| **Laporan Feedback** | Heir feedback | Waktu-6 | `file_laporan_feedback` |
| **Bukti Penyerahan** | Delivery receipt | Waktu-6 | `file_bukti_penyerahan` |

### 3.4 Berkas Evolution Mapping

| Berkas | Description | Waktu | Status | Documents Included |
|--------|-------------|-------|--------|-------------------|
| **Berkas-Kematian** | Initial death report | Waktu-0 | `dilaporkan` | Death report, death certificate |
| **Berkas-1** | Initial documents (may be incomplete) | Waktu-1 | `pending_dokumen` | Partial documents submitted |
| **Berkas-2** | Final complete documents | Waktu-2 | `proses_pusat` | All required documents, verified |
| **Berkas-3** | Validated by PP | Waktu-3 | `verified` | All documents with PP verification |
| **Berkas-4** | Transfer documentation | Waktu-5 | `penyaluran` | Transfer proofs, finance docs |
| **Berkas-5** | Delivery documentation | Waktu-6 | `penyaluran` | Receipts, photos, confirmations |
| **Berkas-6** | Handover report | Waktu-6 | `penyaluran` | Berita Acara Penyerahan |
| **Berkas-7** | Complete report package | Waktu-7 | `selesai` | All reports submitted |

### 3.5 Storage Strategy

#### Primary Storage: `dana_kematian` Table

All document URLs stored as individual fields in the main table:

```sql
-- Main document fields
file_surat_kematian TEXT
file_sk_pensiun TEXT
file_surat_pernyataan_ahli_waris TEXT
file_kartu_keluarga TEXT
file_e_ktp TEXT
file_surat_nikah TEXT
file_buku_rekening TEXT
file_surat_kuasa TEXT

-- Reporting document fields
file_berita_acara TEXT
file_laporan_keuangan TEXT
file_laporan_feedback TEXT
file_bukti_penyerahan TEXT
```

#### Supporting Table: `dokumen_kematian` (Optional but Recommended)

For detailed document tracking:

```sql
CREATE TABLE dokumen_kematian (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dana_kematian_id UUID NOT NULL REFERENCES dana_kematian(id) ON DELETE CASCADE,
  
  jenis_dokumen VARCHAR(100) NOT NULL,
  file_url TEXT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_size BIGINT,
  mime_type VARCHAR(100),
  
  upload_date TIMESTAMP DEFAULT NOW(),
  uploaded_by UUID REFERENCES users(id),
  
  status_dokumen VARCHAR(50) DEFAULT 'draft',
  keterangan TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### File Storage Architecture

```
supabase-storage/
└── dana-kematian/
    └── {dana_kematian_id}/
        ├── surat_kematian/
        │   └── {filename}
        ├── sk_pensiun/
        │   └── {filename}
        ├── surat_pernyataan_ahli_waris/
        │   └── {filename}
        ├── kartu_keluarga/
        │   └── {filename}
        ├── ktp_ahli_waris/
        │   └── {filename}
        ├── surat_nikah/
        │   └── {filename}
        ├── buku_rekening/
        │   └── {filename}
        ├── surat_kuasa/
        │   └── {filename}
        ├── berita_acara/
        │   └── {filename}
        ├── laporan_keuangan/
        │   └── {filename}
        ├── laporan_feedback/
        │   └── {filename}
        └── bukti_penyerahan/
            └── {filename}
```

### 3.6 Document Status Flow

```
draft (uploaded but not verified)
    ↓
submitted (submitted for verification)
    ↓
verified (verified by PC/PP)
    ↓
final (final accepted version)
    ↓
rejected (rejected - requires re-upload)
```

---

## 4. Validation & Decision Flow

### 4.1 PC Validation (Branch Level)

#### Data Validation

```typescript
interface PCValidation {
  // Member Data Validation
  validateMemberData: {
    memberExists: boolean;
    memberIsActive: boolean;
    memberCategoryValid: boolean;
    mpsStatusCorrect: boolean;
  };
  
  // Heir Data Validation
  validateHeirData: {
    heirRelationshipValid: boolean;
    heirNIKMatchesFamilyCard: boolean;
    heirContactValid: boolean;
    heirAddressComplete: boolean;
  };
  
  // Communication Validation
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
Death Report Received (Waktu-0)
    ↓
Validate Member Data
    ↓
[Member Invalid] → Reject / Request Clarification
    ↓
[Member Valid]
    ↓
Contact Family (Active Communication)
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

### 4.2 PP Validation (Central Level)

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
Application Received from PC (Waktu-2)
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

### 4.3 Rejection Loops

#### Rejection Types

**1. Temporary Rejection (Fixable)**
- Missing documents
- Invalid document format
- Incorrect information
- **Action**: Return to previous step for correction
- **Status**: `pending_dokumen`

**2. Permanent Rejection (Not Fixable)**
- Member not eligible
- Fraud detected
- Duplicate claim
- Time limit exceeded
- **Action**: Mark as `ditolak` with reason
- **Status**: `ditolak`

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

## 5. Status Flow System

### 5.1 Complete Status Lifecycle

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
  - **Active communication performed**

#### 3. **pending_dokumen** (Pending Documents)
- **Trigger**: Initial documents received but incomplete
- **Waktu**: `waktu_1`
- **Actor**: PC + Heir
- **Next**: `proses_pusat` (when complete)
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

### 5.2 Status Transition Matrix

| Current Status | Next Status | Trigger | Actor | Waktu Change |
|---------------|-------------|---------|-------|--------------|
| dilaporkan | verifikasi_cabang | PC starts validation | PC | - |
| verifikasi_cabang | pending_dokumen | Initial docs incomplete | PC | waktu_1 set |
| verifikasi_cabang | proses_pusat | Complete app submitted | PC | waktu_2 set |
| pending_dokumen | proses_pusat | Docs re-submitted & complete | PC | waktu_2 set |
| proses_pusat | verified | Validation successful | PP | waktu_3 set |
| proses_pusat | pending_dokumen | Docs returned to PC | PP | - |
| proses_pusat | ditolak | Validation failed | PP | waktu_3 set |
| verified | penyaluran | Fund transfer initiated | PP | waktu_4 set |
| penyaluran | selesai | Reports completed | PC | waktu_7 set |
| *any* | ditolak | Rejection condition | PC/PP | varies |

### 5.3 Status Transition Rules

```typescript
const statusTransitions: Record<string, string[]> = {
  dilaporkan: ["verifikasi_cabang", "ditolak"],
  verifikasi_cabang: ["pending_dokumen", "proses_pusat", "ditolak"],
  pending_dokumen: ["proses_pusat", "ditolak"],
  proses_pusat: ["verified", "pending_dokumen", "ditolak"],
  verified: ["penyaluran", "ditolak"],
  penyaluran: ["selesai", "ditolak"],
  selesai: [], // Terminal state
  ditolak: [] // Terminal state
};
```

---

## 6. Timeline Tracking

### 6.1 Waktu Field Mapping

#### Waktu-0: Death Event & Reporting
```sql
ALTER TABLE dana_kematian ADD COLUMN waktu_0 TIMESTAMP;
UPDATE dana_kematian SET waktu_0 = tanggal_lapor_keluarga;
```
- **Field**: `waktu_0`
- **Display**: `tanggal_lapor_keluarga`
- **Purpose**: Initial death report timestamp
- **Validation**: Required, must be before `waktu_1`
- **Business Rule**: Process starts here

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

### 6.2 Timeline Validation Rules

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

### 7.1 Enhanced dana_kematian Table

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
CREATE INDEX IF NOT EXISTS idx_dana_kematian_komunikasi_status ON dana_kematian(komunikasi_status);
CREATE INDEX IF NOT EXISTS idx_dana_kematian_sla_status ON dana_kematian(sla_status);
```

### 7.2 Key Field Mappings

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
| Communication Status | `komunikasi_status` | VARCHAR(50) | Yes |
| PC Validated | `is_validated_pc` | BOOLEAN | Yes |
| PP Validated | `is_validated_pp` | BOOLEAN | Yes |
| Approved | `is_approved` | BOOLEAN | Yes |
| Funds Transferred | `is_funds_transferred` | BOOLEAN | Yes |
| Delivered | `is_delivered` | BOOLEAN | Yes |
| Reported | `is_reported` | BOOLEAN | Yes |

---

## 8. Financial Flow

### 8.1 Fund Transfer Flow (PP → PC)

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

### 8.2 Fund Delivery Flow (PC → Heir)

#### Delivery Methods
1. **Cash Delivery**
2. **Bank Transfer**

### 8.3 Financial Reconciliation

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

### 9.1 Report Types

1. **Berita Acara Penyerahan** (Handover Report) - Berkas-3
2. **Laporan Keuangan** (Financial Report) - Berkas-4
3. **Laporan Feedback** (Feedback Report) - Berkas-5

### 9.2 Audit Trail System

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

---

## 10. Key Business Rules

### 10.1 Eligibility Rules

#### Member Eligibility
1. Member must be active at time of death
2. Member must have valid MPS status
3. Member category determines benefit amount
4. Death must be reported within 90 days

#### Heir Eligibility
1. Heir must be legitimate family member
2. Heir must provide valid identification
3. Heir must be listed in family card
4. Minor heirs require legal guardian

### 10.2 Benefit Calculation Rules

```typescript
const benefitMatrix = {
  baseAmounts: {
    "PNS": 15000000,
    "Pensiunan": 15000000,
    "CPNS": 10000000,
    "THL": 5000000
  },
  mpsMultipliers: {
    "MPS": 1.5,
    "Non-MPS": 1.0
  },
  heirAdjustments: {
    "suami": 1.0,
    "istri": 1.0,
    "anak": 1.0,
    "orang_tua": 0.75,
    "ahli_waris_lain": 0.5
  }
};
```

### 10.3 Timeline Rules

Maximum processing times:
- Waktu-0 to Waktu-1: 14 days
- Waktu-1 to Waktu-2: 30 days
- Waktu-2 to Waktu-3: 7 days
- Waktu-3 to Waktu-4: 5 days
- Waktu-4 to Waktu-5: 3 days
- Waktu-5 to Waktu-6: 14 days
- Waktu-6 to Waktu-7: 7 days
- Total: 80 days absolute maximum

---

## 11. BPMN-style Explanation

### 11.1 Process Flow Diagram

```
START: Member Death Event
    ↓
┌─────────────────────────────────────────────┐
│ A. LAPORAN KEMATIAN (MD)                    │
│ Actor: Family + Branch Office (PC)          │
│ Status: dilaporkan                          │
│ Waktu: waktu_0                              │
└─────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────┐
│ B. PENGAJUAN DAKEM (PC)                     │
│ Actor: Branch Office (PC)                   │
│ Status: verifikasi_cabang                   │
│ Waktu: waktu_0 → waktu_1                    │
│ Active: WhatsApp/Phone communication        │
└─────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────┐
│ C. KOMPILASI BERKAS (PC)                    │
│ Actor: PC + Heir                            │
│ Berkas-1: waktu_1 (initial)                 │
│ Berkas-2: waktu_2 (final)                   │
│ Status: pending_dokumen → proses_pusat      │
└─────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────┐
│ D. VERIFIKASI PENGAJUAN (PP)                │
│ Actor: Central Office (PP)                  │
│ Waktu: waktu_2 → waktu_3                    │
│ Status: proses_pusat → verified             │
└─────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────┐
│ E. FINALISASI PENGAJUAN (PP)                │
│ Actor: PP + Finance                         │
│ Waktu: waktu_4 → waktu_5                    │
│ Status: verified → penyaluran               │
└─────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────┐
│ F. LAPORAN DAKEM (PC)                       │
│ Actor: PC + Heir                            │
│ Waktu: waktu_6 → waktu_7                    │
│ Berkas-3 to Berkas-7                        │
│ Status: penyaluran → selesai                │
└─────────────────────────────────────────────┘
    ↓
END: Process Complete
```

---

## 12. Implementation Roadmap

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
1. Report generation
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

**Document End**

This document provides a complete, implementation-ready business process design for the Death Benefit (Dana Kematian) system, strictly following the Waktu-0 through Waktu-7 timeline with comprehensive documentation of all phases, actors, validations, and system requirements.
