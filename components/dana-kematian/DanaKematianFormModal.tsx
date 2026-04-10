import { useState, useEffect } from 'react';
import { User, FileText, Calendar, MapPin, Phone, Loader2, Plus, Pencil, Building } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DanaKematian, CreateDanaKematianInput, Anggota } from '@/lib/supabase';
import { FileUpload } from '@/components/ui/FileUpload';

interface DanaKematianFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CreateDanaKematianInput) => Promise<void>;
  claim?: DanaKematian | null;
  mode: 'create' | 'edit';
  isPending: boolean;
  members: Anggota[];
}

const defaultFormData: CreateDanaKematianInput = {
  nama_anggota: '',
  status_anggota: 'pegawai',
  status_mps: 'non_mps',
  tanggal_meninggal: '',
  penyebab_meninggal: '',
  tanggal_lapor_keluarga: '',
  cabang_asal_melapor: '',
  cabang_nama_pelapor: '',
  cabang_nik_pelapor: '',
  cabang_tanggal_awal_terima_berkas: '',
  cabang_tanggal_kirim_ke_pusat: '',
  pusat_tanggal_awal_terima: '',
  pusat_tanggal_validasi: '',
  pusat_tanggal_selesai: '',
  besaran_dana_kematian: 0,
  cabang_tanggal_serah_ke_ahli_waris: '',
  cabang_tanggal_lapor_ke_pusat: '',
  nama_ahli_waris: '',
  status_ahli_waris: 'anak',
  file_sk_pensiun: '',
  file_surat_kematian: '',
  file_surat_pernyataan_ahli_waris: '',
  file_kartu_keluarga: '',
  file_e_ktp: '',
  file_surat_nikah: '',
  status_proses: 'dilaporkan',
  keterangan: '',
};

export function DanaKematianFormModal({
  open,
  onClose,
  onSubmit,
  claim,
  mode,
  isPending,
  members,
}: DanaKematianFormModalProps) {
  const [formData, setFormData] = useState<CreateDanaKematianInput>(defaultFormData);

  // Reset form when modal opens/closes or claim data changes
  useEffect(() => {
    if (mode === 'edit' && claim) {
      setFormData({
        anggota_id: claim.anggota_id || undefined,
        nama_anggota: claim.nama_anggota,
        status_anggota: claim.status_anggota,
        status_mps: claim.status_mps,
        tanggal_meninggal: claim.tanggal_meninggal,
        penyebab_meninggal: claim.penyebab_meninggal || '',
        tanggal_lapor_keluarga: claim.tanggal_lapor_keluarga || '',
        cabang_asal_melapor: claim.cabang_asal_melapor,
        cabang_nama_pelapor: claim.cabang_nama_pelapor || '',
        cabang_nik_pelapor: claim.cabang_nik_pelapor || '',
        cabang_tanggal_awal_terima_berkas: claim.cabang_tanggal_awal_terima_berkas || '',
        cabang_tanggal_kirim_ke_pusat: claim.cabang_tanggal_kirim_ke_pusat || '',
        pusat_tanggal_awal_terima: claim.pusat_tanggal_awal_terima || '',
        pusat_tanggal_validasi: claim.pusat_tanggal_validasi || '',
        pusat_tanggal_selesai: claim.pusat_tanggal_selesai || '',
        besaran_dana_kematian: claim.besaran_dana_kematian,
        cabang_tanggal_serah_ke_ahli_waris: claim.cabang_tanggal_serah_ke_ahli_waris || '',
        cabang_tanggal_lapor_ke_pusat: claim.cabang_tanggal_lapor_ke_pusat || '',
        nama_ahli_waris: claim.nama_ahli_waris,
        status_ahli_waris: claim.status_ahli_waris,
        file_sk_pensiun: claim.file_sk_pensiun || '',
        file_surat_kematian: claim.file_surat_kematian || '',
        file_surat_pernyataan_ahli_waris: claim.file_surat_pernyataan_ahli_waris || '',
        file_kartu_keluarga: claim.file_kartu_keluarga || '',
        file_e_ktp: claim.file_e_ktp || '',
        file_surat_nikah: claim.file_surat_nikah || '',
        status_proses: claim.status_proses,
        keterangan: claim.keterangan || '',
      });
    } else {
      setFormData(defaultFormData);
    }
  }, [claim, mode, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(formData);
  };

  const handleMemberSelect = (memberId: string) => {
    const member = members.find(m => m.id === memberId);
    if (member && mode === 'create') {
      setFormData({
        ...formData,
        anggota_id: memberId,
        nama_anggota: member.nama_anggota,
        status_anggota: member.status_anggota,
        status_mps: member.status_mps,
      });
    }
  };

  const title = mode === 'create' ? 'Ajukan Dana Kematian Baru' : 'Edit Data Dana Kematian';
  const description = mode === 'create'
    ? 'Isi formulir di bawah ini untuk mengajukan dana kematian'
    : 'Ubah data pengajuan dana kematian';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <DialogBody className="space-y-6">
            {/* Data Anggota Section */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <User className="h-5 w-5" />
                Data Anggota
              </h3>

              {mode === 'create' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Pilih Anggota *</label>
                    <Select
                      value={formData.anggota_id}
                      onValueChange={handleMemberSelect}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih anggota yang meninggal" />
                      </SelectTrigger>
                      <SelectContent>
                        {members.map((member) => (
                          <SelectItem key={member.id} value={member.id}>
                            {member.nama_anggota} - {member.nik}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nama Anggota *</label>
                  <Input
                    placeholder="Nama lengkap anggota"
                    value={formData.nama_anggota}
                    onChange={(e) => setFormData({ ...formData, nama_anggota: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Status Anggota *</label>
                  <Select
                    value={formData.status_anggota}
                    onValueChange={(value) => setFormData({ ...formData, status_anggota: value as any })}
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
                    onValueChange={(value) => setFormData({ ...formData, status_mps: value as any })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih status MPS" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mps">MPS</SelectItem>
                      <SelectItem value="non_mps">Non-MPS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Data Kematian Section */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <User className="h-5 w-5" />
                Data Kematian
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Tanggal Meninggal *</label>
                  <Input
                    type="date"
                    value={formData.tanggal_meninggal}
                    onChange={(e) => setFormData({ ...formData, tanggal_meninggal: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Penyebab Meninggal</label>
                  <Input
                    placeholder="Penyebab meninggal"
                    value={formData.penyebab_meninggal}
                    onChange={(e) => setFormData({ ...formData, penyebab_meninggal: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Tanggal Lapor Keluarga</label>
                  <Input
                    type="date"
                    value={formData.tanggal_lapor_keluarga}
                    onChange={(e) => setFormData({ ...formData, tanggal_lapor_keluarga: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Data Pelaporan Section */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Data Pelaporan
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Cabang Asal Melapor *</label>
                  <Input
                    placeholder="Nama cabang"
                    value={formData.cabang_asal_melapor}
                    onChange={(e) => setFormData({ ...formData, cabang_asal_melapor: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nama Pelapor</label>
                  <Input
                    placeholder="Nama pelapor"
                    value={formData.cabang_nama_pelapor}
                    onChange={(e) => setFormData({ ...formData, cabang_nama_pelapor: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">NIK Pelapor</label>
                  <Input
                    placeholder="NIK pelapor"
                    value={formData.cabang_nik_pelapor}
                    onChange={(e) => setFormData({ ...formData, cabang_nik_pelapor: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Proses Cabang Section */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Building className="h-5 w-5" />
                Proses Cabang
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Tanggal Terima Berkas</label>
                  <Input
                    type="date"
                    value={formData.cabang_tanggal_awal_terima_berkas}
                    onChange={(e) => setFormData({ ...formData, cabang_tanggal_awal_terima_berkas: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Tanggal Kirim ke Pusat</label>
                  <Input
                    type="date"
                    value={formData.cabang_tanggal_kirim_ke_pusat}
                    onChange={(e) => setFormData({ ...formData, cabang_tanggal_kirim_ke_pusat: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Proses Pusat Section */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Building className="h-5 w-5" />
                Proses Pusat
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Tanggal Terima</label>
                  <Input
                    type="date"
                    value={formData.pusat_tanggal_awal_terima}
                    onChange={(e) => setFormData({ ...formData, pusat_tanggal_awal_terima: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Tanggal Validasi</label>
                  <Input
                    type="date"
                    value={formData.pusat_tanggal_validasi}
                    onChange={(e) => setFormData({ ...formData, pusat_tanggal_validasi: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Tanggal Selesai</label>
                  <Input
                    type="date"
                    value={formData.pusat_tanggal_selesai}
                    onChange={(e) => setFormData({ ...formData, pusat_tanggal_selesai: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Dana Section */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Dana Kematian
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Besaran Dana Kematian (Rp) *</label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={formData.besaran_dana_kematian}
                    onChange={(e) => setFormData({ ...formData, besaran_dana_kematian: parseFloat(e.target.value) || 0 })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Tanggal Serah ke Ahli Waris</label>
                  <Input
                    type="date"
                    value={formData.cabang_tanggal_serah_ke_ahli_waris}
                    onChange={(e) => setFormData({ ...formData, cabang_tanggal_serah_ke_ahli_waris: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Tanggal Lapor ke Pusat</label>
                  <Input
                    type="date"
                    value={formData.cabang_tanggal_lapor_ke_pusat}
                    onChange={(e) => setFormData({ ...formData, cabang_tanggal_lapor_ke_pusat: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Data Ahli Waris Section */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <User className="h-5 w-5" />
                Data Ahli Waris
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nama Ahli Waris *</label>
                  <Input
                    placeholder="Nama lengkap ahli waris"
                    value={formData.nama_ahli_waris}
                    onChange={(e) => setFormData({ ...formData, nama_ahli_waris: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Status Ahli Waris *</label>
                  <Select
                    value={formData.status_ahli_waris}
                    onValueChange={(value) => setFormData({ ...formData, status_ahli_waris: value as any })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="istri">Istri</SelectItem>
                      <SelectItem value="suami">Suami</SelectItem>
                      <SelectItem value="anak">Anak</SelectItem>
                      <SelectItem value="keluarga">Keluarga</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* File Dokumen Section */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5" />
                File Dokumen
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FileUpload
                  label="File SK Pensiun"
                  value={formData.file_sk_pensiun || ''}
                  onChange={(url) => setFormData({ ...formData, file_sk_pensiun: url })}
                  bucket="dana-kematian"
                  folder="sk-pensiun"
                  disabled={isPending}
                />
                <FileUpload
                  label="File Surat Kematian"
                  value={formData.file_surat_kematian || ''}
                  onChange={(url) => setFormData({ ...formData, file_surat_kematian: url })}
                  bucket="dana-kematian"
                  folder="surat-kematian"
                  disabled={isPending}
                />
                <FileUpload
                  label="File Surat Pernyataan Ahli Waris"
                  value={formData.file_surat_pernyataan_ahli_waris || ''}
                  onChange={(url) => setFormData({ ...formData, file_surat_pernyataan_ahli_waris: url })}
                  bucket="dana-kematian"
                  folder="surat-pernyataan-ahli-waris"
                  disabled={isPending}
                />
                <FileUpload
                  label="File Kartu Keluarga"
                  value={formData.file_kartu_keluarga || ''}
                  onChange={(url) => setFormData({ ...formData, file_kartu_keluarga: url })}
                  bucket="dana-kematian"
                  folder="kartu-keluarga"
                  disabled={isPending}
                />
                <FileUpload
                  label="File E-KTP"
                  value={formData.file_e_ktp || ''}
                  onChange={(url) => setFormData({ ...formData, file_e_ktp: url })}
                  bucket="dana-kematian"
                  folder="e-ktp"
                  disabled={isPending}
                />
                <FileUpload
                  label="File Surat Nikah"
                  value={formData.file_surat_nikah || ''}
                  onChange={(url) => setFormData({ ...formData, file_surat_nikah: url })}
                  bucket="dana-kematian"
                  folder="surat-nikah"
                  disabled={isPending}
                />
              </div>
            </div>

            {/* Status Proses Section */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Status Proses
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Status Proses *</label>
                  <Select
                    value={formData.status_proses}
                    onValueChange={(value) => setFormData({ ...formData, status_proses: value as any })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dilaporkan">Dilaporkan</SelectItem>
                      <SelectItem value="verifikasi_cabang">Verifikasi Cabang</SelectItem>
                      <SelectItem value="proses_pusat">Proses Pusat</SelectItem>
                      <SelectItem value="selesai">Selesai</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Keterangan</label>
                  <Textarea
                    placeholder="Keterangan tambahan"
                    value={formData.keterangan}
                    onChange={(e) => setFormData({ ...formData, keterangan: e.target.value })}
                    rows={3}
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
                      Ajukan Dana
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
