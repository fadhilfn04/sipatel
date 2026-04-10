import { useState, useEffect } from 'react';
import { User, FileText, MapPin, Loader2, Pencil, Plus, Building } from 'lucide-react';
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FileUpload } from '@/components/ui/FileUpload';
import { Anggota, CreateAnggotaInput } from '@/lib/supabase';
import { useWilayah } from '@/hooks/use-wilayah';

interface MemberFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CreateAnggotaInput) => Promise<void>;
  member?: Anggota | null;
  mode: 'create' | 'edit';
  isPending: boolean;
}

const defaultFormData: CreateAnggotaInput = {
  nik: '',
  nama_anggota: '',
  kategori_anggota: 'biasa',
  status_anggota: 'pegawai',
  status_mps: 'non_mps',
  status_iuran: 'iuran',
  nama_cabang: '',
  posisi_kepengurusan: 'anggota',
  status_kepesertaan: '',
  cabang_kelas: '',
  cabang_area_regional: '',
  cabang_area_witel: '',
  pasutri: '',
  status_perkawinan: 'kawin',
  sk_pensiun: 'pensiun',
  nomor_sk_pensiun: '',
  alamat: '',
  rt: '',
  rw: '',
  kelurahan: '',
  kecamatan: '',
  kota: '',
  provinsi: '',
  kode_pos: '',
  nomor_handphone: '',
  nomor_telepon: '',
  email: '',
  sosial_media: '',
  e_ktp: '',
  kartu_keluarga: '',
  npwp: '',
  tempat_lahir: '',
  tanggal_lahir: '',
  jenis_kelamin: 'laki_laki',
  agama: 'islam',
  golongan_darah: 'A',
  besaran_iuran: 0,
  form_kesediaan_iuran: false,
  nama_bank: '',
  norek_bank: '',
  kategori_bantuan: '',
  tanggal_terima_bantuan: '',
  gambar_kondisi_tempat_tinggal: '',
  alasan_mutasi: '',
  tanggal_mutasi: '',
  cabang_pengajuan_mutasi: '',
  pusat_pengesahan_mutasi: '',
  status_bpjs: false,
  bpjs_kelas: '',
  bpjs_insentif: false,
  kategori_datul: '',
  media_datul: '',
};

export function MemberFormModal({
  open,
  onClose,
  onSubmit,
  member,
  mode,
  isPending,
}: MemberFormModalProps) {
  const [formData, setFormData] = useState<CreateAnggotaInput>(defaultFormData);

  // Wilayah hook untuk cascading dropdowns dari Supabase
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

  // State untuk menyimpan ID wilayah yang dipilih
  const [selectedProvinceId, setSelectedProvinceId] = useState<string>('');
  const [selectedRegencyId, setSelectedRegencyId] = useState<string>('');
  const [selectedDistrictId, setSelectedDistrictId] = useState<string>('');
  const [selectedVillageId, setSelectedVillageId] = useState<string>('');

  // Reset form when modal opens/closes or member data changes
  useEffect(() => {
    if (mode === 'edit' && member) {
      setFormData({
        nik: member.nik,
        nama_anggota: member.nama_anggota,
        kategori_anggota: member.kategori_anggota,
        status_anggota: member.status_anggota,
        status_mps: member.status_mps,
        status_iuran: member.status_iuran,
        nama_cabang: member.nama_cabang,
        posisi_kepengurusan: member.posisi_kepengurusan,
        status_kepesertaan: member.status_kepesertaan || '',
        cabang_kelas: member.cabang_kelas || '',
        cabang_area_regional: member.cabang_area_regional || '',
        cabang_area_witel: member.cabang_area_witel || '',
        pasutri: member.pasutri || '',
        status_perkawinan: member.status_perkawinan || 'kawin',
        sk_pensiun: member.sk_pensiun || 'pensiun',
        nomor_sk_pensiun: member.nomor_sk_pensiun || '',
        alamat: member.alamat || '',
        rt: member.rt || '',
        rw: member.rw || '',
        kelurahan: member.kelurahan || '',
        kecamatan: member.kecamatan || '',
        provinsi: member.provinsi || '',
        kota: member.kota || '',
        kode_pos: member.kode_pos || '',
        nomor_handphone: member.nomor_handphone || '',
        nomor_telepon: member.nomor_telepon || '',
        email: member.email || '',
        sosial_media: member.sosial_media || '',
        e_ktp: member.e_ktp || '',
        kartu_keluarga: member.kartu_keluarga || '',
        npwp: member.npwp || '',
        tempat_lahir: member.tempat_lahir || '',
        tanggal_lahir: member.tanggal_lahir || '',
        jenis_kelamin: member.jenis_kelamin || 'laki_laki',
        agama: member.agama || 'islam',
        golongan_darah: member.golongan_darah || 'A',
        besaran_iuran: member.besaran_iuran || 0,
        form_kesediaan_iuran: member.form_kesediaan_iuran || false,
        nama_bank: member.nama_bank || '',
        norek_bank: member.norek_bank || '',
        kategori_bantuan: member.kategori_bantuan || '',
        tanggal_terima_bantuan: member.tanggal_terima_bantuan || '',
        gambar_kondisi_tempat_tinggal: member.gambar_kondisi_tempat_tinggal || '',
        alasan_mutasi: member.alasan_mutasi || '',
        tanggal_mutasi: member.tanggal_mutasi || '',
        cabang_pengajuan_mutasi: member.cabang_pengajuan_mutasi || '',
        pusat_pengesahan_mutasi: member.pusat_pengesahan_mutasi || '',
        status_bpjs: member.status_bpjs || false,
        bpjs_kelas: member.bpjs_kelas || '',
        bpjs_insentif: member.bpjs_insentif || false,
        kategori_datul: member.kategori_datul || '',
        media_datul: member.media_datul || '',
      });
    } else {
      setFormData(defaultFormData);
    }

    // Reset wilayah IDs saat form berubah
    setSelectedProvinceId('');
    setSelectedRegencyId('');
    setSelectedDistrictId('');
    setSelectedVillageId('');
  }, [member, mode, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(formData);
  };

  const title = mode === 'create' ? 'Tambah Anggota Baru' : 'Edit Data Anggota';
  const description = mode === 'create'
    ? 'Isi formulir di bawah ini untuk menambahkan anggota pensiunan baru'
    : 'Ubah data anggota pensiunan';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <DialogBody className="space-y-6">
            {/* Status & Kategori */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Kategori Anggota *</label>
                <Select
                  value={formData.kategori_anggota}
                  onValueChange={(value: any) => setFormData({ ...formData, kategori_anggota: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih kategori" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="biasa">Biasa</SelectItem>
                    <SelectItem value="luar_biasa">Luar Biasa</SelectItem>
                    <SelectItem value="kehormatan">Kehormatan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Status Anggota *</label>
                <Select
                  value={formData.status_anggota}
                  onValueChange={(value: any) => setFormData({ ...formData, status_anggota: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pegawai">Pegawai</SelectItem>
                    <SelectItem value="istri">Istri</SelectItem>
                    <SelectItem value="suami">Suami</SelectItem>
                    <SelectItem value="anak">Anak</SelectItem>
                    <SelectItem value="meninggal">Meninggal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Status MPS *</label>
                <Select
                  value={formData.status_mps}
                  onValueChange={(value: any) => setFormData({ ...formData, status_mps: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih MPS" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mps">MPS</SelectItem>
                    <SelectItem value="non_mps">Non-MPS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Status Iuran *</label>
                <Select
                  value={formData.status_iuran}
                  onValueChange={(value: any) => setFormData({ ...formData, status_iuran: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih iuran" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="iuran">Sudah Iuran</SelectItem>
                    <SelectItem value="tidak_iuran">Tidak Iuran</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Informasi Pribadi */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <User className="h-5 w-5" />
                Informasi Pribadi
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">NIK *</label>
                  <Input
                    placeholder="Contoh: 3201123456789012"
                    value={formData.nik}
                    onChange={(e) => setFormData({ ...formData, nik: e.target.value })}
                    required
                  />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="text-sm font-medium">Nama Lengkap *</label>
                  <Input
                    placeholder="Nama lengkap anggota"
                    value={formData.nama_anggota}
                    onChange={(e) => setFormData({ ...formData, nama_anggota: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Tempat Lahir</label>
                  <Input
                    placeholder="Kota kelahiran"
                    value={formData.tempat_lahir}
                    onChange={(e) => setFormData({ ...formData, tempat_lahir: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Tanggal Lahir</label>
                  <Input
                    type="date"
                    value={formData.tanggal_lahir}
                    onChange={(e) => setFormData({ ...formData, tanggal_lahir: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Jenis Kelamin</label>
                  <Select
                    value={formData.jenis_kelamin}
                    onValueChange={(value: any) => setFormData({ ...formData, jenis_kelamin: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih jenis kelamin" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="laki_laki">Laki-laki</SelectItem>
                      <SelectItem value="perempuan">Perempuan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Agama</label>
                  <Select
                    value={formData.agama}
                    onValueChange={(value: any) => setFormData({ ...formData, agama: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih agama" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="islam">Islam</SelectItem>
                      <SelectItem value="kristen">Kristen</SelectItem>
                      <SelectItem value="katolik">Katolik</SelectItem>
                      <SelectItem value="hindu">Hindu</SelectItem>
                      <SelectItem value="buddha">Buddha</SelectItem>
                      <SelectItem value="konghucu">Konghucu</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Golongan Darah</label>
                  <Select
                    value={formData.golongan_darah}
                    onValueChange={(value: any) => setFormData({ ...formData, golongan_darah: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih golongan darah" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A">A</SelectItem>
                      <SelectItem value="B">B</SelectItem>
                      <SelectItem value="AB">AB</SelectItem>
                      <SelectItem value="O">O</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Status Perkawinan</label>
                  <Select
                    value={formData.status_perkawinan}
                    onValueChange={(value: any) => setFormData({ ...formData, status_perkawinan: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="belum_kawin">Belum Kawin</SelectItem>
                      <SelectItem value="kawin">Kawin</SelectItem>
                      <SelectItem value="cerai_hidup">Cerai Hidup</SelectItem>
                      <SelectItem value="cerai_mati">Cerai Mati</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Informasi Organisasi */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Building className="h-5 w-5" />
                Informasi Organisasi
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nama Cabang *</label>
                  <Input
                    placeholder="Nama cabang"
                    value={formData.nama_cabang}
                    onChange={(e) => setFormData({ ...formData, nama_cabang: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Posisi Kepengurusan *</label>
                  <Select
                    value={formData.posisi_kepengurusan}
                    onValueChange={(value: any) => setFormData({ ...formData, posisi_kepengurusan: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih posisi Kepengurusan" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="anggota">Anggota</SelectItem>
                      <SelectItem value="pengurus">Pengurus</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">SK Pensiun</label>
                  <Select
                    value={formData.sk_pensiun}
                    onValueChange={(value: any) => setFormData({ ...formData, sk_pensiun: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih SK" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ada">Ada</SelectItem>
                      <SelectItem value="tidak_ada">Tidak Ada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nomor SK Pensiun</label>
                  <Input
                    placeholder="Nomor SK pensiun"
                    value={formData.nomor_sk_pensiun}
                    onChange={(e) => setFormData({ ...formData, nomor_sk_pensiun: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Status Kepesertaan</label>
                  <Input
                    placeholder="Status kepesertaan"
                    value={formData.status_kepesertaan}
                    onChange={(e) => setFormData({ ...formData, status_kepesertaan: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Pasutri</label>
                  <Input
                    placeholder="Pasutri"
                    value={formData.pasutri}
                    onChange={(e) => setFormData({ ...formData, pasutri: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Cabang Kelas</label>
                  <Input
                    placeholder="Kelas cabang"
                    value={formData.cabang_kelas}
                    onChange={(e) => setFormData({ ...formData, cabang_kelas: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Area Regional</label>
                  <Input
                    placeholder="Area regional"
                    value={formData.cabang_area_regional}
                    onChange={(e) => setFormData({ ...formData, cabang_area_regional: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Area Witel</label>
                  <Input
                    placeholder="Area witel"
                    value={formData.cabang_area_witel}
                    onChange={(e) => setFormData({ ...formData, cabang_area_witel: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Dokumen */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Dokumen
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">E-KTP</label>
                  <Input
                    placeholder="Nomor E-KTP"
                    value={formData.e_ktp}
                    onChange={(e) => setFormData({ ...formData, e_ktp: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Kartu Keluarga</label>
                  <Input
                    placeholder="Nomor KK"
                    value={formData.kartu_keluarga}
                    onChange={(e) => setFormData({ ...formData, kartu_keluarga: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">NPWP</label>
                  <Input
                    placeholder="Nomor NPWP"
                    value={formData.npwp}
                    onChange={(e) => setFormData({ ...formData, npwp: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Kontak & Alamat */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Kontak & Alamat
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nomor Handphone</label>
                  <Input
                    placeholder="08xxxxxxxxxx"
                    value={formData.nomor_handphone}
                    onChange={(e) => setFormData({ ...formData, nomor_handphone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nomor Telepon</label>
                  <Input
                    placeholder="021xxxxxxxx"
                    value={formData.nomor_telepon}
                    onChange={(e) => setFormData({ ...formData, nomor_telepon: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email</label>
                  <Input
                    type="email"
                    placeholder="email@contoh.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Sosial Media</label>
                  <Input
                    placeholder="Username sosial media"
                    value={formData.sosial_media}
                    onChange={(e) => setFormData({ ...formData, sosial_media: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Kategori Datul</label>
                  <Input
                    placeholder="Kategori datul"
                    value={formData.kategori_datul}
                    onChange={(e) => setFormData({ ...formData, kategori_datul: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Media Datul</label>
                  <Input
                    placeholder="Media datul"
                    value={formData.media_datul}
                    onChange={(e) => setFormData({ ...formData, media_datul: e.target.value })}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium">Alamat *</label>
                  <Input
                    placeholder="Nama jalan"
                    value={formData.alamat}
                    onChange={(e) => setFormData({ ...formData, alamat: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">RT</label>
                  <Input
                    placeholder="001"
                    value={formData.rt}
                    onChange={(e) => setFormData({ ...formData, rt: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">RW</label>
                  <Input
                    placeholder="001"
                    value={formData.rw}
                    onChange={(e) => setFormData({ ...formData, rw: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Provinsi</label>
                  <Select
                    value={selectedProvinceId}
                    onValueChange={(value) => {
                      setSelectedProvinceId(value);
                      const province = provinces.find((p) => p.id === value);
                      setFormData({ ...formData, provinsi: province?.name || '' });
                      // Reset child selections
                      setSelectedRegencyId('');
                      setSelectedDistrictId('');
                      setSelectedVillageId('');
                      setFormData((prev) => ({ ...prev, kota: '', kecamatan: '', kelurahan: '' }));
                      fetchRegencies(value);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={loadingProvinces ? "Loading..." : "Pilih provinsi"} />
                    </SelectTrigger>
                    <SelectContent>
                      {provinces.map((province) => (
                        <SelectItem key={province.id} value={province.id}>
                          {province.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Kota/Kabupaten</label>
                  <Select
                    value={selectedRegencyId}
                    onValueChange={(value) => {
                      setSelectedRegencyId(value);
                      const regency = regencies.find((r) => r.id === value);
                      setFormData({ ...formData, kota: regency?.name || '' });
                      // Reset child selections
                      setSelectedDistrictId('');
                      setSelectedVillageId('');
                      setFormData((prev) => ({ ...prev, kecamatan: '', kelurahan: '' }));
                      fetchDistricts(value);
                    }}
                    disabled={!selectedProvinceId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={loadingRegencies ? "Loading..." : "Pilih kota/kabupaten"} />
                    </SelectTrigger>
                    <SelectContent>
                      {regencies.map((regency) => (
                        <SelectItem key={regency.id} value={regency.id}>
                          {regency.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Kecamatan</label>
                  <Select
                    value={selectedDistrictId}
                    onValueChange={(value) => {
                      setSelectedDistrictId(value);
                      const district = districts.find((d) => d.id === value);
                      setFormData({ ...formData, kecamatan: district?.name || '' });
                      // Reset child selections
                      setSelectedVillageId('');
                      setFormData((prev) => ({ ...prev, kelurahan: '' }));
                      fetchVillages(value);
                    }}
                    disabled={!selectedRegencyId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={loadingDistricts ? "Loading..." : "Pilih kecamatan"} />
                    </SelectTrigger>
                    <SelectContent>
                      {districts.map((district) => (
                        <SelectItem key={district.id} value={district.id}>
                          {district.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Kelurahan/Desa</label>
                  <Select
                    value={selectedVillageId}
                    onValueChange={(value) => {
                      setSelectedVillageId(value);
                      const village = villages.find((v) => v.id === value);
                      setFormData({ ...formData, kelurahan: village?.name || '' });
                    }}
                    disabled={!selectedDistrictId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={loadingVillages ? "Loading..." : "Pilih kelurahan/desa"} />
                    </SelectTrigger>
                    <SelectContent>
                      {villages.map((village) => (
                        <SelectItem key={village.id} value={village.id}>
                          {village.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Kode Pos</label>
                  <Input
                    placeholder="12345"
                    value={formData.kode_pos}
                    onChange={(e) => setFormData({ ...formData, kode_pos: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Data Keuangan */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Data Keuangan
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Besaran Iuran</label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={formData.besaran_iuran}
                    onChange={(e) => setFormData({ ...formData, besaran_iuran: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Form Kesediaan Iuran</label>
                  <Select
                    value={formData.form_kesediaan_iuran ? 'true' : 'false'}
                    onValueChange={(value) => setFormData({ ...formData, form_kesediaan_iuran: value === 'true' })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Ya</SelectItem>
                      <SelectItem value="false">Tidak</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nama Bank</label>
                  <Input
                    placeholder="Nama bank"
                    value={formData.nama_bank}
                    onChange={(e) => setFormData({ ...formData, nama_bank: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nomor Rekening</label>
                  <Input
                    placeholder="Nomor rekening"
                    value={formData.norek_bank}
                    onChange={(e) => setFormData({ ...formData, norek_bank: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Data BPJS */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Data BPJS
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Status BPJS</label>
                  <Select
                    value={formData.status_bpjs ? 'true' : 'false'}
                    onValueChange={(value) => setFormData({ ...formData, status_bpjs: value === 'true' })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Aktif</SelectItem>
                      <SelectItem value="false">Tidak Aktif</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Kelas BPJS</label>
                  <Input
                    placeholder="Kelas BPJS"
                    value={formData.bpjs_kelas}
                    onChange={(e) => setFormData({ ...formData, bpjs_kelas: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Insentif BPJS</label>
                  <Select
                    value={formData.bpjs_insentif ? 'true' : 'false'}
                    onValueChange={(value) => setFormData({ ...formData, bpjs_insentif: value === 'true' })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Ya</SelectItem>
                      <SelectItem value="false">Tidak</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Bantuan Sosial */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Bantuan Sosial
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Kategori Bantuan</label>
                  <Input
                    placeholder="Kategori bantuan"
                    value={formData.kategori_bantuan}
                    onChange={(e) => setFormData({ ...formData, kategori_bantuan: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Tanggal Terima Bantuan</label>
                  <Input
                    type="date"
                    value={formData.tanggal_terima_bantuan}
                    onChange={(e) => setFormData({ ...formData, tanggal_terima_bantuan: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <FileUpload
                    label="Gambar Kondisi Tempat Tinggal"
                    value={formData.gambar_kondisi_tempat_tinggal || ''}
                    onChange={(url) => setFormData({ ...formData, gambar_kondisi_tempat_tinggal: url })}
                    bucket="anggota"
                    folder="gambar-kondisi-tempat-tinggal"
                    disabled={isPending}
                  />
                </div>
              </div>
            </div>

            {/* Data Mutasi */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Data Mutasi
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Alasan Mutasi</label>
                  <Input
                    placeholder="Alasan mutasi"
                    value={formData.alasan_mutasi}
                    onChange={(e) => setFormData({ ...formData, alasan_mutasi: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Tanggal Mutasi</label>
                  <Input
                    type="date"
                    value={formData.tanggal_mutasi}
                    onChange={(e) => setFormData({ ...formData, tanggal_mutasi: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Cabang Pengajuan Mutasi</label>
                  <Input
                    placeholder="Cabang pengajuan"
                    value={formData.cabang_pengajuan_mutasi}
                    onChange={(e) => setFormData({ ...formData, cabang_pengajuan_mutasi: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Pusat Pengesahan Mutasi</label>
                  <Input
                    placeholder="Pusat pengesahan"
                    value={formData.pusat_pengesahan_mutasi}
                    onChange={(e) => setFormData({ ...formData, pusat_pengesahan_mutasi: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="text-sm text-muted-foreground">
              * Field wajib diisi
            </div>
          </DialogBody>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Batal</Button>
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  {mode === 'create' ? (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Simpan Anggota
                    </>
                  ) : (
                    <>
                      <Pencil className="h-4 w-4 mr-2" />
                      Update Data
                    </>
                  )}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
