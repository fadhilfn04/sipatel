# SIPATEL — Anggota Module Audit & Implementation Status

> Updated audit reflecting the **current** state of the codebase.
> This document distinguishes **already-implemented** backend changes from **remaining** frontend work.

---

## 1. CURRENT IMPLEMENTATION (VERIFIED)

### 1.1 Database Tables (Supabase PostgreSQL)

| Table | Purpose | Key Columns |
|---|---|---|
| `anggota` | Main member table | `nik UNIQUE NOT NULL`, `nama_anggota`, `kategori_anggota`, `status_anggota`, `status_mps`, `status_iuran`, `urutan_keluarga INT` (NEW), `foto_anggota TEXT` (NEW), `nama_cabang`, `kode_cabang`, `cabang_kelas`, `cabang_area_regional`, `cabang_area_witel`, `gambar_kondisi_tempat_tinggal`, mutasi fields, soft delete `deleted_at` |
| `anggota_history` | Audit trail (trigger-based) | `anggota_id`, `action`, `changed_data`, `previous_data`, `changed_fields` |
| `master_cabang` | **NEW** branch master (single source of truth) | `id`, `kode_cabang UNIQUE`, `nama_cabang`, `kelas_cabang`, `area_regional`, `area_witel`, `is_active`, `created_at`, `updated_at` |
| `nik_master` | NIK records eligible for inheritance | `id`, `nik UNIQUE` |
| `nik_kepemilikan` | Ownership history of a NIK | `nik_id → nik_master`, `anggota_id VARCHAR(255)` (legacy free text), `source_anggota_id UUID → anggota` (NEW), `heir_anggota_id UUID → anggota` (NEW), `hubungan`, `status`, `tanggal_mulai/selesai`, `is_current` |
| `provinces / regencies / districts / villages` | Indonesian administrative regions (NOT branch data) | — |
| `dana_kematian` | Death benefits — **shares `status_anggota_enum`** with `anggota` | `anggota_id → anggota`, `status_anggota`, `status_mps` |

### 1.2 Enum Types — UNCHANGED (correct decision)

- `kategori_anggota_enum`: `biasa, luar_biasa, kehormatan, pegawai, istri, suami, anak` (002 added family values).
- `status_anggota_enum`: `pegawai, istri, suami, anak, meninggal` — **deprecated by 002, still shared with `dana_kematian`**. DO NOT MODIFY.
- `status_mps_enum`: `mps, non_mps`.
- `status_iuran_enum`: `iuran, tidak_iuran`.
- `status_kepemilikan_enum`: `aktif, non_aktif, meninggal, dicabut`.

### 1.3 NIK Uniqueness — SAFE

- `anggota.nik VARCHAR(20) UNIQUE NOT NULL` + index `idx_anggota_nik`.
- **NIK inheritance does NOT duplicate NIK in `anggota`** — the heir keeps their own `nik`. The shared NIK lives in `nik_master.nik UNIQUE`, and ownership chain lives in `nik_kepemilikan`.
- **No conflict with the `anggota.nik` UNIQUE constraint. Do NOT remove it.**

### 1.4 Migration 014 — ALREADY APPLIED (backward-safe, additive only)

```sql
ALTER TABLE anggota ADD COLUMN urutan_keluarga INT;      -- Istri 1, Anak 2, etc.
ALTER TABLE anggota ADD COLUMN foto_anggota TEXT;         -- Supabase Storage URL
CREATE TABLE master_cabang (...);                         -- kode_cabang UNIQUE, is_active, timestamps
ALTER TABLE nik_kepemilikan ADD COLUMN source_anggota_id UUID REFERENCES anggota(id) ON DELETE SET NULL;
ALTER TABLE nik_kepemilikan ADD COLUMN heir_anggota_id UUID REFERENCES anggota(id) ON DELETE SET NULL;
```

**Strategy**: `status_anggota` stays as `istri`/`anak`; `urutan_keluarga` carries the sequence (1,2,3…). This is extensible and does not touch the shared enum.

### 1.5 NIK Inheritance — Existing Implementation (backend complete, frontend partial)

- **Flow**: Member dies → admin clicks "Wariskan NIK" (shown only when `status_anggota = 'meninggal'`) → `WariskanNikModal` calls:
  1. `POST /api/nik-master` (creates `nik_master` row; 409 handled if exists).
  2. `POST /api/nik-kepemilikan` (creates ownership row with `source_anggota_id` + `heir_anggota_id` when resolvable).
- **API endpoints**: `/api/nik-master`, `/api/nik-master/[id]`, `/api/nik-kepemilikan`, `/api/anggota/[id]/pewarisan`.
- **Server-side validation ALREADY in `/api/nik-kepemilikan` POST**:
  - Source member must have `status_anggota = 'meninggal'`.
  - Heir must have `status_anggota` or `kategori_anggota` in `istri/suami/anak`.
  - Heir cannot equal source (prevents self/circular at 1 level).
  - Duplicate active inheritance for same heir → rejected.
  - Same NIK inherited twice by same heir → rejected.
  - Previous `is_current=true` record automatically downgraded to false with `tanggal_selesai`.
- **Tracking model**: `is_current` + `source_anggota_id` + `heir_anggota_id` + dates supports sequential chains (Budi→Siti→Joko).
- **Gaps (frontend)**:
  - `ExpandableRow` still displays raw `anggota_id` text instead of real heir name from `heir_anggota_id`.
  - `WariskanNikModal` still uses **free-text** heir name input; hardcoded `anak_1/2/3` hubungan.
  - `WariskanNikModal` does not send `source_anggota_id` / `heir_anggota_id` (only free-text `anggota_id`).
  - `/api/anggota/[id]/pewarisan` does not join `anggota` data for source/heir (returns only `nik_master.nik`).
  - `use-nik-inheritance.ts` interface lacks `source_anggota` / `heir_anggota` joined fields.

### 1.6 Photo / File Upload — Infrastructure EXISTS

- Storage: **Supabase Storage** (buckets `dana-kematian`, `anggota`), admin client via service role key (bypasses RLS).
- `lib/supabase-storage.ts`: `uploadToSupabaseStorageGeneric`, `deleteFromSupabaseStorage`, `validateFile` (5MB, PDF/JPEG/PNG).
- `AnggotaFolder` type already includes `'foto-anggota'`. `/api/upload` already whitelists it.
- `FileUpload.tsx` component: upload/preview/replace + deletes old file on replacement — reusable as-is.
- **Gap**: `MemberFormModal` does not yet render a `Foto Anggota` `FileUpload`. `DetailModal` does not display the photo.

### 1.7 Branch / Cabang — Infrastructure EXISTS, UI missing

- `master_cabang` table + full CRUD API (`/api/master-cabang`, `/api/master-cabang/[id]`) — implemented.
- `POST /api/anggota` validates `kode_cabang` exists in `master_cabang` (when provided).
- `PUT /api/anggota/[id]` validates `kode_cabang` the same way.
- **Gap**: No frontend hook to fetch `master_cabang`; `MemberFormModal` still uses 5 free-text inputs (Kode Cabang, Nama Cabang, Cabang Kelas, Area Regional, Area Witel) instead of a Kode Cabang dropdown that auto-fills the rest.

### 1.8 Backend Business Rules — ALREADY IMPLEMENTED

| Rule | Location | Status |
|---|---|---|
| Kategori `biasa` → Status MPS = `mps` | `POST /api/anggota` (force overwrite) | ✅ |
| Kategori `biasa` → Status MPS = `mps` (update) | `PUT /api/anggota/[id]` (force on create + maintain invariant) | ✅ |
| Protected fields immutable in edit (NIK, Nama, Kategori, Status Anggota, MPS, Iuran) | `PUT /api/anggota/[id]` → rejects changed values with 422; strips identical values | ✅ |
| Kode Cabang must exist in `master_cabang` | `POST` + `PUT /api/anggota` | ✅ |
| Inheritance eligibility (source must be meninggal, heir must be istri/suami/anak) | `POST /api/nik-kepemilikan` | ✅ |
| No circular / self inheritance | `POST /api/nik-kepemilikan` | ✅ |
| No duplicate active inheritance | `POST /api/nik-kepemilikan` | ✅ |

### 1.9 Data Mutasi — Usage Mapped

- **DB columns** (`alasan_mutasi`, `tanggal_mutasi`, `cabang_pengajuan_mutasi`, `pusat_pengesahan_mutasi`): remain in DB — **do not touch**.
- **Appears in**: `MemberFormModal.tsx` (Add + Edit — needs to be restricted), `DetailModal.tsx` (read-only display — keep), `ExportExcelModal` field config (keep), `batch-import` API + `ImportExcelModal` (keep).

---

## 2. REMAINING WORK (Frontend-focused)

### Change 2.1 — MemberFormModal: Kategori Biasa → MPS auto-fill + disable

| Aspect | Detail |
|---|---|
| **Current** | MPS select freely editable in create mode. |
| **Change** | In create mode, when `kategori_anggota === 'biasa'`, force `status_mps = 'mps'` and `disabled` the MPS select. Other categories keep it selectable. In edit mode, MPS is always disabled (protected field). |
| **DB impact** | None (backend already enforces this). |
| **Frontend impact** | `MemberFormModal.tsx` — `onValueChange` handler + `disabled` prop. |
| **Backend impact** | None (already enforced). |

### Change 2.2 — MemberFormModal: Urutan Keluarga (Istri 1, Anak 2)

| Aspect | Detail |
|---|---|
| **Current** | No `urutan_keluarga` input. |
| **Change** | Show a number input `Urutan` only when `status_anggota` is `istri`, `suami`, or `anak`. Display as "Istri 1", "Anak 2" in table/detail badges. |
| **DB impact** | None (`urutan_keluarga` column already exists). |
| **Frontend impact** | `MemberFormModal.tsx` (input), `page.tsx` status badge, `DetailModal.tsx` badge, `ExpandableRow` display. |
| **Backend impact** | None (column already persisted via `...body` spread in POST/PUT). |

### Change 2.3 — MemberFormModal: Kode Cabang dropdown → auto-fill derived fields

| Aspect | Detail |
|---|---|
| **Current** | 5 free-text inputs (Kode, Nama, Kelas, Regional, Witel). |
| **Change** | `master_cabang` dropdown for selecting `kode_cabang`. On selection, auto-fill `nama_cabang`, `cabang_kelas`, `cabang_area_regional`, `cabang_area_witel` → all read-only/disabled. |
| **DB impact** | None (master table exists; anggota columns stay denormalized snapshots). |
| **Frontend impact** | New `useMasterCabang` hook; `MemberFormModal.tsx` dropdown + disabled derived fields. |
| **Backend impact** | None (validation already in POST/PUT). |

### Change 2.4 — MemberFormModal: Foto Anggota upload

| Aspect | Detail |
|---|---|
| **Current** | No `foto_anggota` field in the form. |
| **Change** | Add `<FileUpload bucket="anggota" folder="foto-anggota" label="Foto Anggota" />` to create + edit. |
| **DB impact** | None (`foto_anggota` column exists). |
| **Frontend impact** | `MemberFormModal.tsx` (add FileUpload), `DetailModal.tsx` (display image), table avatar (optional). |
| **Backend impact** | None (`/api/upload` already whitelists `foto-anggota`; storage lib validates). |

### Change 2.5 — Hide Data Mutasi from Add Anggota only

| Aspect | Detail |
|---|---|
| **Current** | "Data Mutasi" section shows in both Add and Edit. |
| **Change** | Render the section **only when `mode === 'edit'`**. |
| **DB impact** | None. |
| **Frontend impact** | `MemberFormModal.tsx` conditional render. |
| **Backend impact** | None (PostgreSQL columns + APIs untouched; batch-import/export still map fields). |

### Change 2.6 — Edit mode: disable protected + derived fields

| Aspect | Detail |
|---|---|
| **Current** | Every field editable in Edit mode (including NIK). |
| **Change** | In Edit mode, `disabled`: `nik`, `nama_anggota`, `kategori_anggota`, `status_anggota`, `status_mps`, `status_iuran`. Branch derived fields (`nama_cabang`, `cabang_kelas`, `cabang_area_regional`, `cabang_area_witel`) are read-only/disabled (derived from Kode Cabang dropdown). `kode_cabang` remains **editable** in edit mode. |
| **DB impact** | None. |
| **Frontend impact** | `MemberFormModal.tsx` — `disabled` props. |
| **Backend impact** | None (PUT already rejects protected field changes with 422). |

### Change 2.7 — NIK Inheritance frontend: real member traceability

| Aspect | Detail |
|---|---|
| **Current** | `WariskanNikModal` free-text heir; `ExpandableRow` shows raw `anggota_id`; pewarisan API doesn't join member data; hook interface lacks FK fields. |
| **Change** | 1) `WariskanNikModal`: replace free-text with member search/select (query `/api/anggota`), pass `source_anggota_id` (deceased) + `heir_anggota_id` (selected member) + `hubungan`. 2) `/api/anggota/[id]/pewarisan`: join `source_anggota` + `heir_anggota` via Supabase foreign-table select. 3) `use-nik-inheritance.ts`: add `source_anggota`/`heir_anggota` to interface. 4) `ExpandableRow`: display real heir name/status; show "diwariskan kepada" (source view) and "diwariskan oleh" (heir view) based on whether the current row is source or heir. 5) Collapse/expand triggered by clicking NIK or Nama Anggota. |
| **DB impact** | None (FK columns exist). |
| **Frontend impact** | `WariskanNikModal.tsx`, `ExpandableRow.tsx`, `DetailModal.tsx` (both-direction inheritance section), `page.tsx` (make NIK/Nama clickable to expand). |
| **Backend impact** | `/api/anggota/[id]/pewarisan` — add joins. |

### Change 2.8 — Batch Import: apply MPS rule + map new fields

| Aspect | Detail |
|---|---|
| **Current** | `applyDefaults` in `/api/anggota/batch-import` does not enforce `biasa → mps`; `ImportExcelModal` doesn't map `kode_cabang`, `urutan_keluarga`, `foto_anggota`. |
| **Change** | In `applyDefaults`: `if (kategori_anggota === 'biasa') status_mps = 'mps'`. In `ImportExcelModal` mapping: add `kode_cabang`, `urutan_keluarga`, `foto_anggota`. |
| **DB impact** | None. |
| **Frontend impact** | `ImportExcelModal.tsx` mapping object. |
| **Backend impact** | `batch-import/route.ts` `applyDefaults`. |

---

## 3. RISK ASSESSMENT

| Risk | Severity | Mitigation |
|---|---|---|
| **NIK UNIQUE constraint vs inheritance** | Low | No conflict — inheritance uses `nik_master`, not duplicated `anggota.nik`. **Do not touch the constraint.** |
| **`status_anggota_enum` shared with `dana_kematian`** | High if touched | **Do NOT modify the enum.** Use `urutan_keluarga` column (already added). |
| **`nik_kepemilikan.anggota_id` legacy free text** | Medium | New FK columns (`source_anggota_id`, `heir_anggota_id`) added; legacy column kept. |
| **Existing anggota rows with NULL `kode_cabang`** | Low | `kode_cabang` stays nullable; dropdown is opt-in; existing rows unaffected. |
| **Existing API consumers (import, dashboard, dana-kematian)** | Medium | All backend changes already applied are additive; protected-field PUT uses "reject if changed, strip if identical". |
| **Removing Data Mutasi from Add UI** | Low | Only hidden in Add mode; DB columns, Detail modal, Edit form, import/export intact. |
| **Photo storage cost / orphaned files** | Low | Reuse `FileUpload` which deletes old file on replace. |
| **Migration ordering on fresh DB** | Low | Migration 014 is additive `IF NOT EXISTS` + `CREATE TABLE IF NOT EXISTS`. |
| **Inheritance display correctness** | Medium | Joined source/heir data via new FK columns; legacy rows (FK null) fall back to `anggota_id` text. |

---

## 4. ASSUMPTIONS

1. **Only `Kategori = Biasa` forces `Status MPS = MPS`.** Other categories remain user-selectable.
2. **`urutan_keluarga` (sequence INT)** approach is final — no enum changes.
3. **`master_cabang`** is the single source of truth; `anggota` branch fields remain cached denormalized snapshots for historical integrity.
4. **Foto Anggota** uses existing Supabase Storage + FileUpload (5MB, JPEG/PNG/PDF). Photo is optional.
5. **Data Mutasi** removed only from Add form; kept in Edit + Detail + DB + import/export.
6. **Protected fields in Edit**: NIK, Nama, Kategori, Status Anggota, Status MPS, Status Iuran. `kode_cabang` remains editable; branch derived fields read-only.
7. **NIK inheritance**: sequential chain model retained (one active owner per NIK at a time); no arbitrarily long chain restriction unless business confirms otherwise.
8. **Max 4 istri** is a business validation rule, not a schema constraint (consistent with the extensibility requirement).

---

## 5. IMPLEMENTATION ORDER (REMAINING)

1. `lib/hooks/use-master-cabang.ts` — new hook (GET `/api/master-cabang`).
2. `components/anggota/MemberFormModal.tsx` — MPS auto-fill/disable, `urutan_keluarga` input, Kode Cabang dropdown + derived fields, Foto Anggota FileUpload, hide Data Mutasi in create, disable protected fields in edit.
3. `app/api/anggota/[id]/pewarisan/route.ts` — join source/heir member data.
4. `lib/hooks/use-nik-inheritance.ts` — add `source_anggota`/`heir_anggota` types.
5. `components/anggota/WariskanNikModal.tsx` — member search/select + send FKs.
6. `components/anggota/ExpandableRow.tsx` — real heir/source display + click NIK/Nama to expand.
7. `components/anggota/DetailModal.tsx` — foto display + inheritance both-direction section.
8. `app/(protected)/keanggotaan/pengelolaan-data/page.tsx` — status badge with urutan ("Istri 1"); make NIK/Nama clickable for expand.
9. `app/api/anggota/batch-import/route.ts` — MPS rule in `applyDefaults`.
10. `components/anggota/ImportExcelModal.tsx` — map `kode_cabang`, `urutan_keluarga`, `foto_anggota`.
11. `components/anggota/ExportExcelModal.tsx` — add `urutan_keluarga`, `foto_anggota` fields.
12. Build + manual tests per §17 of the task.

---

_End of updated audit. Backend is implemented; frontend work remains and is scoped above._