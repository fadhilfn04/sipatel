# Panduan Sistem Pewarisan NIK

## 📋 Overview

Sistem Pewarisan NIK memungkinkan NIK pensiunan tetap sama ketika diwariskan ke ahli waris (istri/suami/anak) setelah pensiunan meninggal.

## 🎯 Konsep Utama

### 1. **NIK Tidak Berubah**
- Ketika pensiunan meninggal, NIK-nya TIDAK berubah
- Ahli waris akan mewarisi NIK yang sama
- Satu NIK bisa memiliki riwayat kepemilikan bergantian

### 2. **Struktur Tabel**

#### **nik_master**
Menyimpan NIK "master" ketika pensiunan meninggal:
```sql
- id: UUID (primary key)
- nik: VARCHAR(20) (NIK asli pensiunan)
- created_at, updated_at
```

#### **nik_kepemilikan**
Menyimpan riwayat kepemilikan NIK:
```sql
- id: UUID (primary key)
- nik_id: UUID (foreign key ke nik_master)
- anggota_id: UUID (foreign key ke anggota)
- hubungan: VARCHAR(50) (istri, suami, anak_1, anak_2, anak_3)
- status: ENUM ('aktif', 'non_aktif', 'meninggal', 'dicabut')
- tanggal_mulai: DATE (tanggal mulai mewarisi)
- tanggal_selesai: DATE (tanggal selesai mewarisi, null jika masih aktif)
- is_current: BOOLEAN (apakah kepemilikan ini sedang berlaku)
- created_at, updated_at
```

## 🚀 Cara Menggunakan

### **Metode 1: Lewat Detail Modal (Untuk Satu Anggota)**

1. **Buka halaman** Pengelolaan Data → Keanggotaan
2. **Klik tombol mata** (lihat detail) pada anggota yang statusnya "Meninggal"
3. **Klik tombol** "Wariskan NIK" (hanya muncul jika status = meninggal)
4. **Isi form**:
   - Pilih ahli waris dari dropdown
   - Pilih hubungan (istri/suami/anak_1/anak_2/anak_3)
   - Set tanggal mulai (default: hari ini)
5. **Klik** "Wariskan NIK"

### **Metode 2: Lewat Halaman Pewarisan NIK**

1. **Buka halaman** Keanggotaan → Pewarisan NIK
2. **Lihat tabel** semua riwayat pewarisan NIK
3. **Filter & search** sesuai kebutuhan
4. **Lihat detail** atau edit dari tabel

## 📊 Alur Kerja Sistem

```
1. Pensiunan Aktif (status_anggota = 'pegawai')
   ↓
2. Pensiunan Meninggal (status_anggota = 'meninggal')
   ↓
3. Admin klik "Wariskan NIK" di detail modal
   ↓
4. Sistem buat NIK Master (otomatis)
   ↓
5. Admin pilih ahli waris & hubungan
   ↓
6. Sistem buat NIK Kepemilikan (otomatis)
   ↓
7. Ahli waris sekarang memiliki NIK tersebut
   ↓
8. Tampilkan di tabel dengan expandable rows
```

## 🔧 API Endpoints

### **NIK Master**
- `GET /api/nik-master` - Get all NIK master records
- `POST /api/nik-master` - Create new NIK master
- `GET /api/nik-master/[id]` - Get single NIK master
- `PUT /api/nik-master/[id]` - Update NIK master
- `DELETE /api/nik-master/[id]` - Delete NIK master

### **NIK Kepemilikan**
- `GET /api/nik-kepemilikan` - Get all kepemilikan records
- `POST /api/nik-kepemilikan` - Create new kepemilikan
- `GET /api/anggota/[id]/pewarisan` - Get inheritance history for anggota

## 🎨 Tampilan Tabel

### **Expandable Rows**
- **Row utama**: Menampilkan data anggota
- **Jika ada pewarisan**: Muncul tombol expand (→)
- **Setelah di-expand**: Menampilkan riwayat pewarisan lengkap

### **Visual Indicators**
- ✅ **Badge hijau**: Status aktif
- ⚫ **Badge abu-abu**: Status non-aktif
- 🔵 **Icon Users**: Menandakan ada pewarisan
- 📅 **Tanggal**: Format DD MMM YYYY (Indonesian)

## 🔍 Contoh Use Case

### **Scenario 1: Pensiunan Meninggal, Istri Mewarisi**

1. **Data awal**:
   - NIK: 3201123456789012
   - Nama: Budi Santoso
   - Status: Pegawai

2. **Budi meninggal** → Status diupdate ke "Meninggal"

3. **Wariskan ke istri**:
   - NIK Master: 3201123456789012 (dibuat otomatis)
   - Ahli Waris: Siti Santoso (istri)
   - Hubungan: istri
   - Tanggal Mulai: 2024-01-15

4. **Hasil**:
   - Siti sekarang memiliki "pewarisan" NIK 3201123456789012
   - Di tabel, row Siti bisa di-expand untuk melihat riwayat
   - NIK Budi tetap sama, tidak berubah

### **Scenario 2: Istri Meninggal, Anak Mewarisi**

1. **Data awal**:
   - NIK Master: 3201123456789012
   - Current Owner: Siti Santoso (istri) - status: aktif
   - is_current: true

2. **Siti meninggal** → is_current diupdate ke false, tanggal_selesai di-set

3. **Wariskan ke anak**:
   - NIK Master: 3201123456789012 (sama)
   - Ahli Waris: Joko Santoso (anak_1)
   - Hubungan: anak_1
   - Tanggal Mulai: 2025-03-20
   - is_current: true

4. **Hasil**:
   - Joko sekarang pemilik aktif NIK tersebut
   - Riwayat lengkap: Budi → Siti → Joko
   - Semuanya dengan NIK yang sama: 3201123456789012

## ⚠️ Penting!

1. **NIK tidak boleh berubah** - itu adalah kunci sistem ini
2. **Hanya pensiunan meninggal** yang bisa diwariskan NIK-nya
3. **Satu NIK bisa multiple owners** secara bergantian (tidak simultaneously)
4. **is_current flag** penting untuk tracking siapa pemilik aktif saat ini
5. **Riwayat lengkap** selalu tersimpan di nik_kepemilikan

## 🛠️ Development Notes

### **Files Created**:
1. `supabase/migrations/008_create_nik_inheritance_tables.sql` - Database schema
2. `lib/supabase.ts` - Type definitions
3. `lib/hooks/use-nik-inheritance.ts` - React hooks
4. `lib/hooks/use-nik-inheritance-api.ts` - API hooks
5. `components/anggota/ExpandableRow.tsx` - Expandable table component
6. `components/anggota/WariskanNikModal.tsx` - Modal form pewarisan
7. `app/api/anggota/[id]/pewarisan/route.ts` - API endpoint
8. `app/api/nik-master/route.ts` - API endpoints
9. `app/api/nik-master/[id]/route.ts` - API detail endpoint
10. `app/api/nik-kepemilikan/route.ts` - API kepemilikan endpoint
11. `app/(protected)/keanggotaan/pewarasan-nik/page.tsx` - Management page

### **Database Migration**:
```bash
# Apply migration
supabase migration up

# Atau via Supabase Dashboard → SQL Editor → Paste & Run
```

### **Testing Data**:
Untuk testing, Anda bisa insert sample data:
```sql
-- Sample NIK Master
INSERT INTO nik_master (nik) VALUES ('3201123456789012');

-- Sample Kepemilikan
INSERT INTO nik_kepemilikan (nik_id, anggota_id, hubungan, status, tanggal_mulai, is_current)
VALUES (
  '<nik_master_id>',
  '<anggota_id>',
  'istri',
  'aktif',
  '2024-01-15',
  true
);
```

## 🎓 Summary

Sistem Pewarisan NIK memastikan:
- ✅ NIK pensiunan tidak berubah ketika diwariskan
- ✅ Riwayat lengkap siapa saja yang pernah memiliki NIK tersebut
- ✅ Tracking yang jelas siapa pemilik aktif saat ini
- ✅ Tampilan visual yang intuitif dengan expandable rows
- ✅ API lengkap untuk integrasi dengan fitur lain

---

*Dibuat untuk Sipatel - Sistem Pensiun Telkom*
*Last updated: April 2026*
