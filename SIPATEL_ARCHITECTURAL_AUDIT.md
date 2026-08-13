# SIPATEL — Comprehensive Architectural & Business-Data Audit

> **Status:** AUDIT ONLY — No code, schema, migrations, or UI have been modified.
> **Date:** August 2026
> **Scope:** Master Data, Reference Data, Data Consistency, Database Design, Business Rules, Information-System Quality

---

## A. Executive Summary

**Rating: `Needs Improvement` (leaning toward Good)**

SIPATEL is a functional pensioner/member information system that already demonstrates several **strong production-grade patterns**, but it also contains **critical data-integrity and security gaps** that must be addressed before it can be considered a reliable, production-grade pensioner information system.

### What is already well designed ✅

1. **`master_cabang`** — A proper master-data table with unique code, active flag, and soft-delete (deactivate). The form correctly auto-fills derived branch fields (nama, kelas, regional, witel) from the master record.
2. **`anggota_history`** — A trigger-based audit trail that captures CREATE/UPDATE/DELETE with before/after JSON snapshots.
3. **NIK inheritance model** — `nik_master` + `nik_kepemilikan` with proper FKs (`source_anggota_id`, `heir_anggota_id`) added in migration 014. The backend correctly validates source must be `meninggal`, heir must be `istri/suami/anak`, prevents circular inheritance, and prevents duplicate active inheritance.
4. **Protected fields** — The `PUT /api/anggota/[id]` route enforces that `nik`, `nama_anggota`, `kategori_anggota`, `status_anggota`, `status_mps`, `status_iuran` cannot be changed through the normal edit endpoint. NIK changes must go through the inheritance workflow.
5. **Business rule: Kategori Biasa → MPS** — Enforced at **three layers**: frontend (disabled field), backend POST, backend PUT, and backend batch-import. This is exemplary defense-in-depth.
6. **Wilayah (Provinces/Regencies/Districts/Villages)** — Properly normalized external reference data with hierarchical FKs and RLS policies.
7. **Dana Kematian workflow** — A full state machine (`dana-kematian-state-machine.ts`) with role-based transitions, conditions, and audit logging via `riwayat_proses_dakem` and `audit_dana_kematian`.
8. **RBAC foundation** — Role + Permission model with `requirePermission` / `requireAnyPermission` server-side guards on the Anggota and Master Cabang APIs.

### What needs urgent attention ❌

1. **CRITICAL SECURITY: Missing authorization on Dana Kematian, NIK Kepemilikan, and Dashboard APIs** — `POST/PUT/DELETE /api/dana-kematian`, `POST /api/nik-kepemilikan`, and `GET /api/dashboard/stats` have **NO permission checks**. Any authenticated user (or potentially anyone) can create death-benefit claims, transfer NIK ownership, and read dashboard statistics.
2. **CRITICAL DATA INTEGRITY: Import bypasses all business rules** — The batch-import endpoint uses `upsert` directly, bypassing protected-field enforcement, `kode_cabang` validation against `master_cabang`, and `nama_cabang` consistency checks. It can overwrite existing members' protected fields.
3. **Role slug mismatch** — `rbac.ts` defines `KETUA_1 = 'ketua-1'` (hyphen) but migration 013 creates `'ketua_i'` (underscore). Role-based checks will silently fail for this role.
4. **Enum drift** — The TypeScript `StatusProsesDakemEnum` and the state machine include `'verified'` and `'revisi_pusat'`, but the database enum `status_proses_dakem_enum` does NOT contain these values. Attempts to set these statuses will fail at the database level.
5. **Status/Category confusion** — Migration 002 "merged" `status_anggota` into `kategori_anggota` but left both columns active. The current code uses both fields simultaneously, creating ambiguity about which is authoritative.

---

## B. Existing Master Data

| Master/Reference | Existing Table | Used By | Current Quality | Recommendation |
|---|---|---|---|---|
| **Master Cabang** | `master_cabang` | `anggota.kode_cabang` (denormalized text, NOT a FK), `dana_kematian.cabang_asal_melapor` (free text, not linked) | **Good** — unique code, active flag, soft-delete. **Gaps:** No FK constraint from anggota; no created_by/updated_by; no audit trail; no hierarchy (regional/witel are flat text). | Add FK from `anggota.kode_cabang` → `master_cabang.kode_cabang`. Add audit columns. See Section C for hierarchy discussion. |
| **Wilayah (Provinsi/Kota/Kecamatan/Kelurahan)** | `provinces`, `regencies`, `districts`, `villages` | `anggota.provinsi/kota/kecamatan/kelurahan` (stored as TEXT names, not FK IDs) | **Good** — normalized, hierarchical, RLS-enabled. **Gap:** Anggota stores the *name* text, not the ID, so there's no referential integrity. | Keep text snapshot for display, but consider storing the village/regency ID as an optional FK for data-quality validation. Low priority. |
| **User Roles** | `UserRole`, `UserPermission`, `UserRolePermission` (Prisma) | All API routes via `requirePermission` | **Good** — proper RBAC model. **Gap:** Role slug mismatch between code (`ketua-1`) and migration (`ketua_i`). | Fix slug mismatch. See Section F. |
| **NIK Master** | `nik_master` | `nik_kepemilikan.nik_id` (proper FK) | **Good** — proper master table for deceased pensioner NIKs. | No change needed. |
| **Dana Kematian Workflow States** | DB enum `status_proses_dakem_enum` | `dana_kematian.status_proses` | **Poor** — DB enum and TypeScript/state-machine are out of sync (`verified`, `revisi_pusat` missing from DB). | Sync the enum. See Section F. |

---

## C. Recommended New Master Data

> **Decision framework applied:** A master table is recommended ONLY when business users manage the values, values change over time, values have their own attributes, or referential integrity matters. Small fixed sets remain enums.

| Candidate | Why | Priority | Proposed Structure | Impact |
|---|---|---|---|---|
| **Master Bank** | `anggota.nama_bank` is free text → data quality issues ("BCA" vs "Bank BCA" vs "Bank Central Asia"). Used in anggota, dana_kematian, arus_kas. Business users need to add/modify banks. | **P1** | `kode_bank` (e.g., "014"), `nama_bank`, `is_active`, timestamps | Improves reporting, reduces duplicates, enables reliable bank-based filtering. |
| **Master Kategori Bantuan** | `anggota.kategori_bantuan` and `dana_sosial.jenis_bantuan` are free text / hardcoded CHECK. Values like "Medis", "Pendidikan" repeat but can't be managed. | **P2** | `id`, `nama`, `deskripsi`, `is_active`, timestamps | Improves social-assistance reporting consistency. |
| **Master Cabang Hierarchy (Regional / Witel)** | Currently `area_regional` and `area_witel` are flat text fields inside `master_cabang`. If regional/witel have their own attributes (contact person, code) or are used for authorization scope, they should be separate masters. **However**, if they are purely descriptive grouping attributes of a branch, they can remain as columns. | **P3** (investigate) | `master_regional`(id, kode, nama), `master_witel`(id, kode, nama, regional_id). Then `master_cabang` gets `regional_id` and `witel_id` FKs. | Only justified if reporting/filtering by regional/witel is a real business need AND the lists are managed independently. Currently the flat text approach works for simple filtering. |
| **Master Tarif Dana Kematian** | Tariff amounts (Rp 1.5M / Rp 2M) and cutoff date are in a static TypeScript config file. If tariffs change yearly or by policy, business users cannot update them without a code deployment. | **P2** | `id`, `tanggal_berlaku` (effective date), `besaran_dana`, `keterangan`, `is_active` | Allows business to manage tariffs over time without developer involvement. Enables historical tariff accuracy. |

### Candidates that should remain as-is (NOT master tables)

| Candidate | Recommendation | Reason |
|---|---|---|
| Kategori Anggota (`biasa`, `luar_biasa`, `kehormatan`) | **Remain Enum** | Small fixed set, developer-controlled, no additional attributes. |
| Status Anggota (`pegawai`, `istri`, `suami`, `anak`, `meninggal`) | **Remain Enum** | Small fixed set tied to business logic. |
| Status MPS (`mps`, `non_mps`) | **Remain Enum** | Binary, rarely changes. |
| Status Iuran (`iuran`, `tidak_iuran`) | **Remain Enum** | Binary. |
| Jenis Kelamin | **Remain Enum** | Universal fixed set. |
| Agama | **Remain Enum** | Indonesian government-recognized set (6 values), rarely changes. |
| Golongan Darah | **Remain Enum** | Medical fixed set (A/B/AB/O). |
| Status Perkawinan | **Remain Enum** | Legal fixed set. |
| SK Pensiun (`ada`/`tidak_ada`) | **Remain Enum** | Binary flag. |
| Posisi Kepengurusan (`anggota`/`pengurus`) | **Remain Enum** | Binary, rarely changes. |
| Dana Kematian Workflow Status | **Remain Enum (after sync)** | Fixed workflow states controlled by the state machine. |
| Dana Sosial Status | **Remain Enum / CHECK** | Move from inline CHECK to enum for consistency, but no master table needed. |
| Arus Kas Kategori | **Remain Enum** | Accounting categories, developer/controller-managed. |

---

## D. Hardcoded Values

| Value/Concept | Location | Current Implementation | Recommendation | Reason |
|---|---|---|---|---|
| Kategori Biasa → MPS rule | `app/api/anggota/route.ts`, `app/api/anggota/[id]/route.ts`, `batch-import/route.ts`, `MemberFormModal.tsx` | String literal `'biasa'` / `'mps'` checked in 4+ places | **Extract to shared constant + backend-only enforcement** | If the rule changes, 4 files must be updated. The value should remain an enum, but the rule should live in one place. |
| Dana Kematian tariff amounts | `lib/config/dana-kematian-config.ts` | Static TypeScript config: Rp 1.5M (old), Rp 2M (new), cutoff 2023-03-01 | **Move to Master Tarif (P2)** OR keep as config if changes are rare | If tariffs change annually, business needs to manage this without redeployment. |
| Status Ahli Waris (`istri`, `suami`, `anak`, `keluarga`) | DB enum `status_ahli_waris_enum` + `DanaKematianFormModal.tsx` SelectItems | DB enum + hardcoded `<SelectItem>` values | **Remain Enum** — but centralize the labels in one shared constant | Currently the dropdown options are hand-written in JSX. If an enum value changes, the JSX won't auto-update. |
| Dana Sosial jenis_bantuan (`Medis`, `Pendidikan`, etc.) | DB CHECK constraint + `DanaSosialFormModal.tsx` | CHECK constraint + hardcoded JSX | **Remain CHECK/Enum** — extract labels to shared constant | Same issue: duplicate definition in DB and UI. |
| `validHeirStatuses = ['istri', 'suami', 'anak']` | `app/api/nik-kepemilikan/route.ts` line 172 | Inline array in API route | **Extract to shared constant** | Business rule is in one place (backend) which is good, but the value should be shared with the frontend for display. |
| Dana Kematian document list | `DanaKematianFormModal.tsx` `DOCUMENT_STEPS` + `lib/config/dana-kematian-documents.ts` + DB `dokumen_kematian.jenis_dokumen` CHECK | Three separate definitions | **Consolidate to one shared config** | The form, the document validator, and the DB CHECK all define the document types independently. |
| Status labels & badge colors | `ExpandableRow.tsx` STATUS_LABELS, `dana-kematian-state-machine.ts` getStateColor/getStateBadgeVariant | Hardcoded maps in multiple files | **Extract to shared label/color constants** | Every component redefines status-to-label/color mapping. |

---

## E. Free-Text Risks

| Field | Table | Current | Risk | Recommendation |
|---|---|---|---|---|
| `nama_bank` | `anggota`, `dana_kematian.bank_tujuan` | Free text | "BCA", "Bank BCA", "Bank Central Asia" become separate values → broken grouping/reports | **P1: Master Bank** |
| `kategori_bantuan` | `anggota` | Free text | Inconsistent categories, impossible to aggregate | **P2: Master Kategori Bantuan** or controlled dropdown |
| `kategori_datul` / `media_datul` | `anggota` | Free text | Unknown vocabulary, no validation | Investigate if these have a fixed vocabulary. If yes → enum/dropdown. If truly free → keep. |
| `status_kepesertaan` | `anggota` | Free text | No validation | Likely should be derived from kategori/status. Investigate. |
| `pasutri` | `anggota` | Free text | Spouse name? Unclear semantics | Clarify field meaning. If it's a name, keep free text. If it's a relationship code, make enum. |
| `bpjs_kelas` | `anggota` | Free text | Should be `I` / `II` / `III` only | **Enum** (low effort) |
| `cabang_asal_melapor` | `dana_kematian` | Free text VARCHAR(120) | **NOT linked to master_cabang** → typos create phantom branches, reporting by branch is unreliable | **P1: FK to master_cabang** (or at least validate against master on submit) |
| `metode_pembayaran` | `arus_kas`, `pembayaran_sumbangan` | Free text VARCHAR(50) | "transfer", "Transfer", "TRANSFER" become different | Enum: `transfer`, `tunai`, `cek` |
| `akun_bank` | `arus_kas` | Free text | Same as nama_bank issue | Link to Master Bank (P1) |
| `nama_pemohon` / `disetujui_oleh` / `diverifikasi_oleh` | `dana_sosial`, `laporan_periode` | Free text (names) | No link to User table → can't audit who actually did it | Store `user_id` FK alongside the name snapshot |

---

## F. Database Design Issues

### Critical

1. **Missing FK: `anggota.kode_cabang` → `master_cabang.kode_cabang`**
   - `kode_cabang` is a free VARCHAR with no database-level referential integrity.
   - An anggota can have a `kode_cabang` that doesn't exist in `master_cabang`.
   - The API validates it on create/update, but import and direct DB access bypass this.
   - **Fix:** Add FK constraint (after data cleanup).

2. **Missing FK: `dana_kematian.cabang_asal_melapor` → `master_cabang`**
   - `cabang_asal_melapor` is free text VARCHAR(120) with no link to master_cabang.
   - This is the **primary branch grouping field** for death-benefit reporting.
   - **Fix:** Either add `kode_cabang` FK column to dana_kematian, or validate cabang_asal_melapor against master_cabang.nama_cabang on submit.

3. **Enum drift: `status_proses_dakem_enum`**
   - DB enum: `dilaporkan, pending_dokumen, verifikasi_cabang, proses_pusat, penyaluran, selesai, ditolak`
   - TypeScript + state machine: adds `verified`, `revisi_pusat`
   - **Any attempt to set status to `verified` or `revisi_pusat` will throw a database error.**
   - **Fix:** Add missing values to the DB enum.

4. **Role slug mismatch**
   - `lib/rbac.ts`: `KETUA_1 = 'ketua-1'`
   - Migration 013: `'ketua_i'`, `'ketua_ii'`
   - **Fix:** Standardize on one convention across code and DB.

### High

5. **`status_anggota` vs `kategori_anggota` confusion (Migration 002)**
   - Migration 002 "merged" status into category but left both columns active.
   - The API, frontend, and TypeScript types all use both fields.
   - The `get_kategori_with_status()` function and the combined index suggest the merge was never completed.
   - **Recommendation:** Decide on ONE authoritative field, deprecate the other, and clean up. This requires business discussion.

6. **`nik_kepemilikan.anggota_id` is VARCHAR(255)**
   - Original design used free text; migration 014 added proper FKs (`source_anggota_id`, `heir_anggota_id`).
   - The old VARCHAR column remains for "backward compatibility."
   - **Risk:** New code might accidentally use the wrong column.
   - **Recommendation:** Migrate all data to FK columns, then drop or deprecated-mark the VARCHAR column.

7. **`dana_sosial` uses inline CHECK constraints instead of enums**
   - `check_jenis_bantuan`, `check_status_pengajuan`, `check_status_penyaluran`
   - Inconsistent with the rest of the schema (which uses CREATE TYPE enum).
   - Harder to discover, harder to extend.
   - **Recommendation:** Convert to proper enums for consistency (low priority).

8. **No database-level protection for `anggota.nik` uniqueness across soft deletes**
   - `nik` has a UNIQUE constraint, but soft-deleted records still occupy the NIK.
   - Re-importing a previously deleted member via upsert will resurrect the soft-deleted record.
   - **Recommendation:** Partial unique index `WHERE deleted_at IS NULL`.

### Medium

9. **`master_cabang` lacks audit columns**
   - No `created_by`, `updated_by`. Branch master data changes are not auditable.
   - **Recommendation:** Add audit columns and/or a master_cabang_history table.

10. **`laporan_periode` typo: `dibuat_olez`**
    - Should be `dibuat_oleh`. Minor but indicates lack of review.

11. **Actor tracking in `audit_dana_kematian` and `riwayat_proses_dakem`**
    - `actor_id` was changed from UUID to VARCHAR(255) to accommodate free text.
    - Actor identity is stored as text extracted from `data_perubahan->>'actor_id'`.
    - **Risk:** No reliable link to the User table; actor identity can be spoofed if `data_perubahan` is set client-side.
    - **Recommendation:** Resolve actor from the server session, not from the request body.

12. **`dana_kematian` stores denormalized member data (`nama_anggota`, `status_anggota`, `status_mps`)**
    - This is a **valid snapshot pattern** for historical accuracy (the member's status at time of death shouldn't change if the member record is edited later).
    - **Assessment:** Keep as-is. This is correct denormalization for a financial/historical record.

### Low

13. **`SystemSetting` has e-commerce fields** (`notifyStockEmail`, `notifyNewOrderEmail`, etc.)
    - These are Metronic template leftovers, not SIPATEL business fields.
    - **Recommendation:** Clean up when convenient.

14. **Multiple `update_updated_at` trigger functions**
    - `update_updated_at_column()`, `update_dakem_updated_at()`, `update_arus_kas_updated_at()`, `update_laporan_updated_at()`, `update_pembayaran_updated_at()`
    - All do the same thing.
    - **Recommendation:** Consolidate to one shared function (low priority).

---

## G. Business Rule Issues

| Rule | Current Location | Issue | Recommendation |
|---|---|---|---|
| Kategori Biasa → Status MPS | Frontend + Backend POST + Backend PUT + Import | ✅ **Well enforced** at all layers. | No change needed. Exemplary. |
| NIK must be unique among non-deleted | Backend POST + DB UNIQUE constraint | ⚠️ DB unique includes soft-deleted records → re-import resurrects deleted members | Add partial unique index `WHERE deleted_at IS NULL`. |
| Source NIK must be `meninggal` | Backend `/api/nik-kepemilikan` POST | ✅ Enforced. But **no permission check** on this endpoint. | Add permission check (Critical). |
| Heir must be `istri/suami/anak` | Backend `/api/nik-kepemilikan` POST | ✅ Enforced. Checks both `status_anggota` and `kategori_anggota`. | No change needed. |
| Dana Kematian status transitions | Frontend state machine (`dana-kematian-state-machine.ts`) | ⚠️ State machine is **client-side only**. The backend PUT route accepts any status change without validating the transition. | Move transition validation to backend (High). |
| Cannot delete completed dana kematian | Backend DELETE route | ✅ Enforced (rejects if `status_proses === 'selesai'`). | Good. |
| Protected fields on anggota | Backend PUT route | ✅ Enforced. But **bypassed by batch-import** upsert. | Validate import records against protected fields, or strip them. |
| Dana Kematian tariff calculation | Frontend `tariff-calculator.ts` | ⚠️ Calculated on the frontend, then sent to backend as a plain number. Backend does NOT validate the amount. | Validate tariff server-side or calculate on backend. |
| Document completeness for workflow | Frontend state machine conditions | ⚠️ Checked client-side only. | Validate on backend during status transitions. |

---

## H. Protected / Immutable Fields

| Field | Entity | Current Status | Recommendation |
|---|---|---|---|
| `nik` | anggota | **Protected** — cannot change via PUT, must use inheritance workflow | ✅ Good. But import can overwrite it. |
| `nama_anggota` | anggota | **Protected** on PUT | ✅ Good. But import can overwrite it. |
| `kategori_anggota` | anggota | **Protected** on PUT | ✅ Good. But import can overwrite it. |
| `status_anggota` | anggota | **Protected** on PUT | ✅ Good. But import can overwrite it. |
| `status_mps` | anggota | **Protected** on PUT | ✅ Good. But import can overwrite it. |
| `status_iuran` | anggota | **Protected** on PUT | ✅ Good. But import can overwrite it. |
| `besaran_dana_kematian` | dana_kematian | Editable via PUT with no protection | Should be **system-calculated** (from tariff) or require approval workflow for manual override. |
| `status_proses` | dana_kematian | Editable via PUT with no transition validation | Should be **workflow-controlled** — only valid transitions allowed. |
| `nik` (in nik_master) | nik_master | Immutable (no update route) | ✅ Good. |
| Historical financial records | arus_kas, pembayaran_sumbangan | Editable/soft-deletable | Financial records should be **immutable after verification** — only allow reversal entries, not edits. |
| `kode_cabang` | master_cabang | Editable via PUT | Should be **immutable after creation** (it's referenced by anggota). Changing it would orphan references. |

---

## I. Audit Trail

| Operation | Audit Coverage | Gap |
|---|---|---|
| Anggota CREATE/UPDATE/DELETE | ✅ `anggota_history` (trigger-based, before/after JSON) | None — well covered. |
| Dana Kematian transitions | ✅ `riwayat_proses_dakem` + `audit_dana_kematian` | Actor identity comes from request body, not session — unreliable. |
| Master Cabang changes | ❌ **No audit trail** | Master data changes (adding/deactivating branches) are not logged. |
| NIK Kepemilikan changes | ❌ **No audit trail** | NIK inheritance operations (critical legal/financial events) have no history. |
| Dana Sosial changes | ❌ **No audit trail** | |
| Arus Kas changes | ❌ **No audit trail** | Financial transactions have no audit log. |
| User/Role changes | Partial — `SystemLog` exists but generic | SystemLog captures events but not before/after data. |
| Batch Import | ❌ **No specific audit** | Bulk imports (which can create/update hundreds of records) are not logged as an import event. |
| Bulk Delete | ❌ **No specific audit** | Bulk delete records individual soft-deletes via anggota trigger, but the bulk operation itself (who triggered it, what filters) is not logged. |

---

## J. Import / Export Risks

| Risk | Severity | Description |
|---|---|---|
| **Import bypasses protected fields** | **Critical** | `batch-import/route.ts` uses `upsert({ onConflict: 'nik' })` which can overwrite `nik`, `nama_anggota`, `kategori_anggota`, `status_anggota`, `status_mps`, `status_iuran` on existing records — the exact fields protected by the PUT route. |
| **Import doesn't validate kode_cabang** | **High** | The import maps `kode_cabang` from the Excel file but never checks it against `master_cabang`. Invalid branch codes are silently accepted. |
| **Import doesn't validate nama_cabang consistency** | **High** | `nama_cabang` is free text in the import. If it doesn't match the master, branch-based reporting breaks. |
| **Import resurrects soft-deleted records** | **Medium** | Upsert on `nik` will undelete a soft-deleted record (`deleted_at: null` is set in `applyDefaults`). This may be intentional, but it's undocumented. |
| **Import validation is client-side only** | **Medium** | `ImportExcelModal.tsx` validates rows client-side (checks for nik/nama/cabang presence). The backend only checks required fields, not enum validity or master-data existence. |
| **Export includes raw enum values** | **Low** | Export includes database enum values (`biasa`, `non_mps`) which may confuse non-technical users importing the file back. |

---

## K. Recommended Future Architecture

```
┌─────────────────────────────────────────────────────┐
│                  MASTER DATA LAYER                    │
│  master_cabang · master_bank · master_tarif_dakem    │
│  provinces · regencies · districts · villages        │
│  (Managed by admins, soft-deleted, audited)          │
└──────────────────────────┬──────────────────────────┘
                           │ FK references
┌──────────────────────────▼──────────────────────────┐
│              CORE MEMBER DATA LAYER                   │
│  anggota (with kode_cabang FK to master_cabang)      │
│  nik_master · nik_kepemilikan (inheritance)          │
│  (Protected fields immutable, full audit trail)      │
└──────────────────────────┬──────────────────────────┘
                           │ FK references
┌──────────────────────────▼──────────────────────────┐
│            TRANSACTION / EVENT LAYER                  │
│  dana_kematian · dana_sosial · pembayaran_sumbangan  │
│  arus_kas · laporan_periode                          │
│  (Workflow-controlled, immutable after completion)   │
└──────────────────────────┬──────────────────────────┘
                           │ Triggers
┌──────────────────────────▼──────────────────────────┐
│             HISTORY / AUDIT LAYER                    │
│  anggota_history · audit_dana_kematian               │
│  riwayat_proses_dakem · master_cabang_history        │
│  nik_kepemilikan_history · import_log                │
│  (Append-only, actor from session, before/after JSON)│
└──────────────────────────┬──────────────────────────┘
                           │ Aggregations
┌──────────────────────────▼──────────────────────────┐
│              REPORTING / DASHBOARD                   │
│  dashboard_stats · laporan_periode · exports         │
│  (Reads from all layers, never modifies data)        │
└─────────────────────────────────────────────────────┘
```

### Cross-cutting concerns

- **Authorization:** Every API route (without exception) must check permissions via `requirePermission` or `requireAnyPermission`.
- **Validation:** Business rules must be enforced at the **backend** (or database), never frontend-only.
- **Consistency:** Status labels, colors, and option lists should come from **shared constants**, not be redefined in each component.

---

## Prioritized Roadmap

### Phase 1 — Critical Security & Data Integrity (P0)

1. **Add permission checks to unprotected APIs**
   - `POST/PUT/DELETE /api/dana-kematian`
   - `POST /api/nik-kepemilikan`
   - `GET /api/dashboard/stats`

2. **Fix import bypass**
   - Strip protected fields from import upsert payloads
   - Validate `kode_cabang` against `master_cabang` in import
   - Reject rows with invalid enum values

3. **Fix role slug mismatch** (`ketua-1` vs `ketua_i`)

4. **Fix enum drift** — add `verified` and `revisi_pusat` to `status_proses_dakem_enum`

### Phase 2 — Master Data & Referential Integrity (P1)

5. **Add FK from `anggota.kode_cabang` → `master_cabang.kode_cabang`** (after data cleanup)
6. **Link `dana_kematian` to `master_cabang`** (add `kode_cabang` FK or validate `cabang_asal_melapor`)
7. **Introduce Master Bank** — replace free-text `nama_bank` across anggota, dana_kematian, arus_kas
8. **Add partial unique index on `anggota.nik` WHERE `deleted_at IS NULL`**

### Phase 3 — Business Rule Enforcement (P1-P2)

9. **Move Dana Kematian transition validation to backend** — server must reject invalid status transitions
10. **Validate Dana Kematian tariff server-side** — calculate or validate amount on backend, don't trust frontend
11. **Resolve `status_anggota` vs `kategori_anggota` confusion** — pick one, deprecate the other

### Phase 4 — Audit & History (P2)

12. **Add audit trail for `master_cabang` changes**
13. **Add audit trail for `nik_kepemilikan` (NIK inheritance operations)**
14. **Fix actor identity in dana-kematian audit** — resolve from session, not request body
15. **Add import/bulk-operation logging**

### Phase 5 — Data Quality & Consistency (P2-P3)

16. **Introduce Master Tarif Dana Kematian** — move tariff from config file to database
17. **Convert `bpjs_kelas` to enum** (`I`, `II`, `III`)
18. **Convert `metode_pembayaran` to enum** across arus_kas/pembayaran_sumbangan
19. **Extract shared status-label/color constants** — eliminate duplicate definitions
20. **Clean up `SystemSetting` e-commerce fields**

### Phase 6 — Nice-to-Have (P3)

21. **Investigate Master Regional/Witel hierarchy** — only if business needs independent management
22. **Convert dana_sosial CHECK constraints to proper enums**
23. **Consolidate duplicate `update_updated_at` trigger functions**
24. **Store wilayah IDs (not just names) on anggota for validation**

---

## Final Note

> **The most impactful improvements are NOT new tables — they are:**
> 1. Plugging the security holes (missing permission checks)
> 2. Closing the import bypass
> 3. Enforcing workflow transitions on the backend
> 4. Adding referential integrity (FKs) to master_cabang
>
> These four changes alone would move SIPATEL from "Needs Improvement" to "Good."