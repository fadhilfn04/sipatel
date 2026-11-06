'use client';

import { useEffect, useState } from 'react';
import {
  FileText,
  HeartHandshake,
  MapPin,
  Phone,
  User,
  Wallet,
} from 'lucide-react';
import type { Anggota, UpdateAnggotaInput } from '@/lib/supabase';
import { useWilayah } from '@/hooks/use-wilayah';
import { FileUpload } from '@/components/ui/FileUpload';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface PerubahanDataPribadiFormProps {
  member: Anggota;
  values: UpdateAnggotaInput;
  onChange: (values: UpdateAnggotaInput) => void;
  /** Dipanggil saat form di-submit (tombol footer type="submit"). */
  onSubmit?: () => void;
  isPending?: boolean;
  /** Slot tombol aksi; wajib berisi tombol `type="submit"`. */
  footer?: React.ReactNode;
}

interface EnumOption {
  value: string;
  label: string;
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}

interface ControlProps {
  values: UpdateAnggotaInput;
  setField: (key: keyof UpdateAnggotaInput, value: unknown) => void;
  disabled?: boolean;
}

function TextField({
  label,
  field,
  values,
  setField,
  placeholder,
  type,
  disabled,
}: ControlProps & {
  label: string;
  field: keyof UpdateAnggotaInput;
  placeholder?: string;
  type?: string;
}) {
  return (
    <Field label={label}>
      <Input
        type={type}
        placeholder={placeholder}
        value={(values[field] as string) || ''}
        onChange={(e) => setField(field, e.target.value)}
        disabled={disabled}
      />
    </Field>
  );
}

function EnumSelect({
  label,
  field,
  values,
  setField,
  options,
  placeholder,
  disabled,
}: ControlProps & {
  label: string;
  field: keyof UpdateAnggotaInput;
  options: EnumOption[];
  placeholder?: string;
}) {
  return (
    <Field label={label}>
      <Select
        value={(values[field] as string) || ''}
        onValueChange={(v) => setField(field, v)}
        disabled={disabled}
      >
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

const OPTIONS = {
  jenisKelamin: [
    { value: 'laki_laki', label: 'Laki-laki' },
    { value: 'perempuan', label: 'Perempuan' },
  ],
  agama: [
    { value: 'islam', label: 'Islam' },
    { value: 'kristen', label: 'Kristen' },
    { value: 'katolik', label: 'Katolik' },
    { value: 'hindu', label: 'Hindu' },
    { value: 'buddha', label: 'Buddha' },
    { value: 'konghucu', label: 'Konghucu' },
  ],
  golonganDarah: [
    { value: 'A', label: 'A' },
    { value: 'B', label: 'B' },
    { value: 'AB', label: 'AB' },
    { value: 'O', label: 'O' },
  ],
  statusPerkawinan: [
    { value: 'belum_kawin', label: 'Belum Kawin' },
    { value: 'kawin', label: 'Kawin' },
    { value: 'cerai_hidup', label: 'Cerai Hidup' },
    { value: 'cerai_mati', label: 'Cerai Mati' },
  ],
  skPensiun: [
    { value: 'ada', label: 'Ada' },
    { value: 'tidak_ada', label: 'Tidak Ada' },
  ],
} as const;

/**
 * Form Perubahan Data Pribadi — hanya berisi field yang BOLEH diubah
 * (lihat `PERSONAL_DATA_EDITABLE_FIELDS` di `lib/anggota-perubahan.ts`).
 *
 * Field identitas inti (NIK, nama, cabang, status) TIDAK dimuat di sini —
 * ditampilkan read-only pada kartu informasi anggota di halaman induk, sehingga
 * proses bisnis Mutasi Cabang / Data Meninggal Dunia / Pengakhiran Keanggotaan
 * tidak dapat diambil alih lewat menu ini.
 */
export function PerubahanDataPribadiForm({
  member,
  values,
  onChange,
  onSubmit,
  isPending = false,
  footer,
}: PerubahanDataPribadiFormProps) {
  const {
    provinces,
    regencies,
    districts,
    villages,
    loadingProvinces,
    loadingRegencies,
    loadingDistricts,
    loadingVillages,
    fetchRegencies,
    fetchDistricts,
    fetchVillages,
  } = useWilayah();

  const [selectedProvinceId, setSelectedProvinceId] = useState('');
  const [selectedRegencyId, setSelectedRegencyId] = useState('');
  const [selectedDistrictId, setSelectedDistrictId] = useState('');
  const [selectedVillageId, setSelectedVillageId] = useState('');

  // Reset pilihan wilayah ketika berganti anggota.
  useEffect(() => {
    setSelectedProvinceId('');
    setSelectedRegencyId('');
    setSelectedDistrictId('');
    setSelectedVillageId('');
  }, [member.id]);

  const setField = (key: keyof UpdateAnggotaInput, value: unknown) => {
    onChange({ ...values, [key]: value } as UpdateAnggotaInput);
  };

  const boolSelectValue = (key: 'status_bpjs' | 'bpjs_insentif') => {
    const value = values[key];
    if (value === null || value === undefined) return '';
    return value ? 'true' : 'false';
  };

  const controlProps = { values, setField, disabled: isPending };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit?.();
      }}
      className="space-y-6"
    >
      {/* Identitas Pribadi */}
      <div>
        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <User className="h-5 w-5" />
          Identitas Pribadi
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <TextField
            label="Tempat Lahir"
            field="tempat_lahir"
            placeholder="Kota kelahiran"
            {...controlProps}
          />
          <TextField
            label="Tanggal Lahir"
            field="tanggal_lahir"
            type="date"
            {...controlProps}
          />
          <EnumSelect
            label="Jenis Kelamin"
            field="jenis_kelamin"
            options={[...OPTIONS.jenisKelamin]}
            placeholder="Pilih jenis kelamin"
            {...controlProps}
          />
          <EnumSelect
            label="Agama"
            field="agama"
            options={[...OPTIONS.agama]}
            placeholder="Pilih agama"
            {...controlProps}
          />
          <EnumSelect
            label="Golongan Darah"
            field="golongan_darah"
            options={[...OPTIONS.golonganDarah]}
            placeholder="Pilih golongan darah"
            {...controlProps}
          />
          <EnumSelect
            label="Status Perkawinan"
            field="status_perkawinan"
            options={[...OPTIONS.statusPerkawinan]}
            placeholder="Pilih status"
            {...controlProps}
          />
          <TextField
            label="Pasutri"
            field="pasutri"
            placeholder="Nama pasangan"
            {...controlProps}
          />
        </div>
      </div>

      {/* Kontak */}
      <div>
        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <Phone className="h-5 w-5" />
          Kontak
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TextField
            label="Nomor Handphone"
            field="nomor_handphone"
            placeholder="08xxxxxxxxxx"
            {...controlProps}
          />
          <TextField
            label="Nomor Telepon"
            field="nomor_telepon"
            placeholder="021xxxxxxxx"
            {...controlProps}
          />
          <TextField
            label="Email"
            field="email"
            type="email"
            placeholder="email@contoh.com"
            {...controlProps}
          />
          <TextField
            label="Sosial Media"
            field="sosial_media"
            placeholder="Username sosial media"
            {...controlProps}
          />
        </div>
      </div>

      {/* Alamat */}
      <div>
        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <MapPin className="h-5 w-5" />
          Alamat
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-2 md:col-span-3">
            <label className="text-sm font-medium">Alamat</label>
            <Input
              placeholder="Nama jalan"
              value={(values.alamat as string) || ''}
              onChange={(e) => setField('alamat', e.target.value)}
              disabled={isPending}
            />
          </div>
          <TextField
            label="RT"
            field="rt"
            placeholder="001"
            {...controlProps}
          />
          <TextField
            label="RW"
            field="rw"
            placeholder="001"
            {...controlProps}
          />
          <TextField
            label="Kode Pos"
            field="kode_pos"
            placeholder="12345"
            {...controlProps}
          />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Field label="Provinsi">
            <Select
              value={selectedProvinceId}
              onValueChange={(value) => {
                setSelectedProvinceId(value);
                const province = provinces.find((p) => p.id === value);
                onChange({
                  ...values,
                  provinsi: province?.name || '',
                  kota: '',
                  kecamatan: '',
                  kelurahan: '',
                });
                setSelectedRegencyId('');
                setSelectedDistrictId('');
                setSelectedVillageId('');
                fetchRegencies(value);
              }}
              disabled={isPending}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    loadingProvinces ? 'Memuat...' : 'Pilih provinsi'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {provinces.map((province) => (
                  <SelectItem key={province.id} value={province.id}>
                    {province.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Kota/Kabupaten">
            <Select
              value={selectedRegencyId}
              onValueChange={(value) => {
                setSelectedRegencyId(value);
                const regency = regencies.find((r) => r.id === value);
                onChange({
                  ...values,
                  kota: regency?.name || '',
                  kecamatan: '',
                  kelurahan: '',
                });
                setSelectedDistrictId('');
                setSelectedVillageId('');
                fetchDistricts(value);
              }}
              disabled={!selectedProvinceId || isPending}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    loadingRegencies ? 'Memuat...' : 'Pilih kota/kabupaten'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {regencies.map((regency) => (
                  <SelectItem key={regency.id} value={regency.id}>
                    {regency.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Kecamatan">
            <Select
              value={selectedDistrictId}
              onValueChange={(value) => {
                setSelectedDistrictId(value);
                const district = districts.find((d) => d.id === value);
                onChange({
                  ...values,
                  kecamatan: district?.name || '',
                  kelurahan: '',
                });
                setSelectedVillageId('');
                fetchVillages(value);
              }}
              disabled={!selectedRegencyId || isPending}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    loadingDistricts ? 'Memuat...' : 'Pilih kecamatan'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {districts.map((district) => (
                  <SelectItem key={district.id} value={district.id}>
                    {district.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Kelurahan/Desa">
            <Select
              value={selectedVillageId}
              onValueChange={(value) => {
                setSelectedVillageId(value);
                const village = villages.find((v) => v.id === value);
                setField('kelurahan', village?.name || '');
              }}
              disabled={!selectedDistrictId || isPending}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    loadingVillages ? 'Memuat...' : 'Pilih kelurahan/desa'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {villages.map((village) => (
                  <SelectItem key={village.id} value={village.id}>
                    {village.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <p className="mt-2 text-xs text-muted-foreground">
          Wilayah tersimpan saat ini:{' '}
          {[member.provinsi, member.kota, member.kecamatan, member.kelurahan]
            .filter(Boolean)
            .join(' / ') || '—'}
          . Pilih ulang hanya bila alamat berubah.
        </p>
      </div>

      {/* Dokumen & Data Pensiun */}
      <div>
        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <FileText className="h-5 w-5" />
          Dokumen & Data Pensiun
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TextField
            label="Nomor E-KTP"
            field="e_ktp"
            placeholder="16 digit"
            {...controlProps}
          />
          <TextField
            label="Nomor Kartu Keluarga"
            field="kartu_keluarga"
            placeholder="16 digit"
            {...controlProps}
          />
          <TextField
            label="NPWP"
            field="npwp"
            placeholder="15 digit"
            {...controlProps}
          />
          <EnumSelect
            label="SK Pensiun"
            field="sk_pensiun"
            options={[...OPTIONS.skPensiun]}
            placeholder="Pilih SK"
            {...controlProps}
          />
          <TextField
            label="Nomor SK Pensiun"
            field="nomor_sk_pensiun"
            placeholder="Nomor SK pensiun"
            {...controlProps}
          />
        </div>
      </div>

      {/* Bank & BPJS */}
      <div>
        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <Wallet className="h-5 w-5" />
          Bank & BPJS
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <TextField
            label="Nama Bank"
            field="nama_bank"
            placeholder="Nama bank"
            {...controlProps}
          />
          <TextField
            label="Nomor Rekening"
            field="norek_bank"
            placeholder="Nomor rekening"
            {...controlProps}
          />
          <Field label="Status BPJS">
            <Select
              value={boolSelectValue('status_bpjs')}
              onValueChange={(v) => setField('status_bpjs', v === 'true')}
              disabled={isPending}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih status BPJS" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Aktif</SelectItem>
                <SelectItem value="false">Tidak Aktif</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <TextField
            label="Kelas BPJS"
            field="bpjs_kelas"
            placeholder="Kelas BPJS"
            {...controlProps}
          />
          <Field label="Insentif BPJS">
            <Select
              value={boolSelectValue('bpjs_insentif')}
              onValueChange={(v) => setField('bpjs_insentif', v === 'true')}
              disabled={isPending}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih insentif" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Ya</SelectItem>
                <SelectItem value="false">Tidak</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
      </div>

      {/* Bantuan Sosial & Datul */}
      <div>
        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <HeartHandshake className="h-5 w-5" />
          Bantuan Sosial & Datul
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <TextField
            label="Kategori Bantuan"
            field="kategori_bantuan"
            placeholder="Kategori bantuan"
            {...controlProps}
          />
          <TextField
            label="Tanggal Terima Bantuan"
            field="tanggal_terima_bantuan"
            type="date"
            {...controlProps}
          />
          <TextField
            label="Kategori Datul"
            field="kategori_datul"
            placeholder="Kategori datul"
            {...controlProps}
          />
          <TextField
            label="Media Datul"
            field="media_datul"
            placeholder="Media datul"
            {...controlProps}
          />
          <div className="space-y-2">
            <FileUpload
              label="Gambar Kondisi Tempat Tinggal"
              value={(values.gambar_kondisi_tempat_tinggal as string) || ''}
              onChange={(url) => setField('gambar_kondisi_tempat_tinggal', url)}
              bucket="anggota"
              folder="gambar-kondisi-tempat-tinggal"
              disabled={isPending}
            />
          </div>
        </div>
      </div>

      {footer}
    </form>
  );
}
