'use client';

import { useState, useEffect } from 'react';
import {
  User,
  FileText,
  Calendar,
  MapPin,
  Phone,
  Loader2,
  Plus,
  Pencil,
  Building,
  Search,
  Upload,
  Sparkles,
} from 'lucide-react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { DanaKematian, CreateDanaKematianInput, Anggota } from '@/lib/supabase';
import { MemberSearchModal } from './MemberSearchModal';
import { DanaKematianDocumentWorkspace } from './DanaKematianDocumentWorkspace';
import { calculateTariff, formatTariffLabel, getTariffDisplayLabel } from '@/lib/utils/tariff-calculator';

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
  status_proses: 'verifikasi_cabang',
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
  const [activeTab, setActiveTab] = useState('informasi-utama');
  const [memberSearchModalOpen, setMemberSearchModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Anggota | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [manualTariffOverride, setManualTariffOverride] = useState(false);

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

      // Set selected member if anggota_id exists
      if (claim.anggota_id) {
        const member = members.find(m => m.id === claim.anggota_id);
        if (member) {
          setSelectedMember(member);
        }
      }
    } else {
      setFormData(defaultFormData);
      setSelectedMember(null);
    }

    // Reset validation errors
    setValidationErrors({});
    setActiveTab('informasi-utama');
    setManualTariffOverride(false);
  }, [claim, mode, open, members]);

  // Auto-calculate tariff when tanggal_meninggal or status_mps changes
  useEffect(() => {
    if (mode === 'create' && formData.tanggal_meninggal && formData.status_mps && !manualTariffOverride) {
      const calculation = calculateTariff(formData.tanggal_meninggal, formData.status_mps);
      setFormData(prev => ({
        ...prev,
        besaran_dana_kematian: calculation.amount,
      }));
    }
  }, [formData.tanggal_meninggal, formData.status_mps, manualTariffOverride, mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    const errors: Record<string, string> = {};

    if (mode === 'create' && !selectedMember) {
      errors.member = 'Silakan pilih anggota terlebih dahulu';
    }

    if (!formData.tanggal_meninggal) {
      errors.tanggal_meninggal = 'Tanggal meninggal wajib diisi';
    }

    if (!formData.cabang_asal_melapor) {
      errors.cabang_asal_melapor = 'Cabang pelapor wajib diisi';
    }

    if (!formData.cabang_tanggal_awal_terima_berkas) {
      errors.cabang_tanggal_awal_terima_berkas = 'Tanggal terima berkas wajib diisi';
    }

    if (!formData.nama_ahli_waris) {
      errors.nama_ahli_waris = 'Nama ahli waris wajib diisi';
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    await onSubmit(formData);
  };

  const handleMemberSelect = (member: Anggota) => {
    setSelectedMember(member);
    setFormData({
      ...formData,
      anggota_id: member.id,
      nama_anggota: member.nama_anggota,
      status_anggota: member.status_anggota,
      status_mps: member.status_mps,
      cabang_asal_melapor: member.nama_cabang,
      status_proses: 'verifikasi_cabang', // Auto-set status
    });

    // Clear validation error for member
    setValidationErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors.member;
      return newErrors;
    });

    // Reset manual tariff override when selecting new member
    setManualTariffOverride(false);
  };

  const handleFieldChange = (field: keyof CreateDanaKematianInput, value: any) => {
    setFormData({ ...formData, [field]: value });

    // Clear validation error for this field
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const title = mode === 'create' ? 'Ajukan Dana Kematian Baru' : 'Edit Data Dana Kematian';
  const description = mode === 'create'
    ? 'Isi formulir di bawah ini untuk mengajukan dana kematian. Status akan otomatis diatur ke "Verifikasi Cabang".'
    : 'Ubah data pengajuan dana kematian. Status proses dikelola otomatis melalui workflow.';

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="w-screen h-screen max-w-[100vw] max-h-screen p-6 gap-0 overflow-hidden flex flex-col rounded-none">
          <DialogHeader className="shrink-0 px-2 pb-4">
            <DialogTitle className="text-2xl">{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
              {/* Tabs Header */}
              <TabsList className="shrink-0 grid grid-cols-5 w-full h-auto p-1 bg-muted mb-4 mx-2">
                <TabsTrigger value="informasi-utama" className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <span className="hidden sm:inline">Informasi</span>
                </TabsTrigger>
                <TabsTrigger value="informasi-tambahan" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  <span className="hidden sm:inline">Detail</span>
                </TabsTrigger>
                <TabsTrigger value="data-pelaporan" className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  <span className="hidden sm:inline">Pelaporan</span>
                </TabsTrigger>
                <TabsTrigger value="proses-cabang" className="flex items-center gap-2">
                  <Building className="h-4 w-4" />
                  <span className="hidden sm:inline">Proses</span>
                </TabsTrigger>
                <TabsTrigger value="workspace-dokumen" className="flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  <span className="hidden sm:inline">Dokumen</span>
                </TabsTrigger>
              </TabsList>

              {/* Scrollable Content Area */}
              <div className="flex-1 overflow-y-auto px-2">
                <div className="p-6">
                  {/* Tab 1: Informasi Utama */}
                  <TabsContent value="informasi-utama" className="mt-0 space-y-6">
                    {/* Member Search Section - Only in create mode */}
                    {mode === 'create' && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                          <Search className="h-4 w-4" />
                          Pilih Data Anggota
                        </h4>

                        {!selectedMember ? (
                          <div>
                            <Button
                              type="button"
                              onClick={() => setMemberSearchModalOpen(true)}
                              className="w-full"
                            >
                              <Search className="h-4 w-4 mr-2" />
                              Cari Anggota yang Meninggal
                            </Button>
                            {validationErrors.member && (
                              <p className="text-sm text-destructive mt-2">{validationErrors.member}</p>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <User className="h-5 w-5 text-blue-600" />
                                <div>
                                  <p className="font-semibold text-blue-900">{selectedMember.nama_anggota}</p>
                                  <p className="text-sm text-blue-700">NIK: {selectedMember.nik}</p>
                                </div>
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedMember(null);
                                  setFormData({
                                    ...formData,
                                    anggota_id: undefined,
                                    nama_anggota: '',
                                    status_anggota: 'pegawai',
                                    status_mps: 'non_mps',
                                    cabang_asal_melapor: '',
                                  });
                                }}
                              >
                                Ganti
                              </Button>
                            </div>
                            <div className="flex gap-2 flex-wrap">
                              <Badge variant="outline">{selectedMember.nama_cabang}</Badge>
                              <Badge>{selectedMember.status_anggota}</Badge>
                              <Badge variant="secondary">{selectedMember.status_mps}</Badge>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Auto-filled Member Data (Readonly) */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">NIK</label>
                        <Input
                          value={selectedMember?.nik || formData.nama_anggota || ''}
                          readOnly
                          className="bg-muted cursor-not-allowed"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Nama Anggota *</label>
                        <Input
                          placeholder="Nama lengkap anggota"
                          value={formData.nama_anggota}
                          onChange={(e) => handleFieldChange('nama_anggota', e.target.value)}
                          required
                          readOnly={!!selectedMember}
                          className={selectedMember ? 'bg-muted cursor-not-allowed' : ''}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Cabang</label>
                        <Input
                          value={selectedMember?.nama_cabang || ''}
                          readOnly
                          className="bg-muted cursor-not-allowed"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Status Anggota *</label>
                        <Select
                          value={formData.status_anggota}
                          onValueChange={(value) => handleFieldChange('status_anggota', value)}
                          required
                          disabled={!!selectedMember}
                        >
                          <SelectTrigger className={selectedMember ? 'bg-muted cursor-not-allowed' : ''}>
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
                          onValueChange={(value) => handleFieldChange('status_mps', value)}
                          required
                          disabled={!!selectedMember}
                        >
                          <SelectTrigger className={selectedMember ? 'bg-muted cursor-not-allowed' : ''}>
                            <SelectValue placeholder="Pilih status MPS" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="mps">MPS</SelectItem>
                            <SelectItem value="non_mps">Non-MPS</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Status Pengajuan</label>
                        <Input
                          value={formData.status_proses?.replace('_', ' ').toUpperCase() || ''}
                          readOnly
                          className="bg-muted cursor-not-allowed"
                        />
                        <p className="text-xs text-muted-foreground">
                          Status akan otomatis berubah sesuai workflow
                        </p>
                      </div>
                    </div>

                    {/* Tanggal Meninggal & Besaran Dana */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Tanggal Meninggal *</label>
                        <Input
                          type="date"
                          value={formData.tanggal_meninggal}
                          onChange={(e) => handleFieldChange('tanggal_meninggal', e.target.value)}
                          required
                        />
                        {validationErrors.tanggal_meninggal && (
                          <p className="text-sm text-destructive">{validationErrors.tanggal_meninggal}</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">Besaran Dana Kematian *</label>
                        <Select
                          value={formData.besaran_dana_kematian.toString()}
                          onValueChange={(value) => {
                            if (value !== 'auto') {
                              setManualTariffOverride(true);
                            }
                            handleFieldChange('besaran_dana_kematian', value === 'auto' ? calculateTariff(formData.tanggal_meninggal || '', formData.status_mps).amount : parseFloat(value));
                          }}
                          required
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Pilih besaran dana" />
                          </SelectTrigger>
                          <SelectContent>
                            {mode === 'create' && formData.tanggal_meninggal && (
                              <SelectItem value="auto">
                                <div className="flex items-center gap-2">
                                  <Sparkles className="h-4 w-4 text-yellow-500" />
                                  <span>
                                    Otomatis ({formatTariffLabel(calculateTariff(formData.tanggal_meninggal, formData.status_mps).amount)})
                                  </span>
                                </div>
                              </SelectItem>
                            )}
                            <SelectItem value="25000000">Rp 25.000.000 (Tarif Lama)</SelectItem>
                            <SelectItem value="50000000">Rp 50.000.000 (Tarif Baru)</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          {mode === 'create' && !manualTariffOverride && formData.tanggal_meninggal
                            ? `⚡ Otomatis dihitung berdasarkan tanggal meninggal (${getTariffDisplayLabel(calculateTariff(formData.tanggal_meninggal, formData.status_mps).tariffType)})`
                            : 'Tarif dana kematian berdasarkan tanggal meninggal dan status MPS'
                          }
                        </p>
                      </div>
                    </div>

                    {/* Data Ahli Waris */}
                    <div>
                      <h3 className="text-md font-semibold mb-4 flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Data Ahli Waris
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Nama Ahli Waris *</label>
                          <Input
                            placeholder="Nama lengkap ahli waris"
                            value={formData.nama_ahli_waris}
                            onChange={(e) => handleFieldChange('nama_ahli_waris', e.target.value)}
                            required
                          />
                          {validationErrors.nama_ahli_waris && (
                            <p className="text-sm text-destructive">{validationErrors.nama_ahli_waris}</p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Status Ahli Waris *</label>
                          <Select
                            value={formData.status_ahli_waris}
                            onValueChange={(value) => handleFieldChange('status_ahli_waris', value)}
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
                  </TabsContent>

                  {/* Tab 2: Informasi Tambahan */}
                  <TabsContent value="informasi-tambahan" className="mt-0 space-y-6">
                    <div>
                      <h3 className="text-md font-semibold mb-4 flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Detail Kematian
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Penyebab Meninggal</label>
                          <Input
                            placeholder="Penyebab meninggal"
                            value={formData.penyebab_meninggal}
                            onChange={(e) => handleFieldChange('penyebab_meninggal', e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Tanggal Lapor Keluarga</label>
                          <Input
                            type="date"
                            value={formData.tanggal_lapor_keluarga}
                            onChange={(e) => handleFieldChange('tanggal_lapor_keluarga', e.target.value)}
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-md font-semibold mb-4">Catatan Tambahan</h3>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Keterangan</label>
                        <Textarea
                          placeholder="Keterangan tambahan mengenai pengajuan"
                          value={formData.keterangan}
                          onChange={(e) => handleFieldChange('keterangan', e.target.value)}
                          rows={4}
                        />
                      </div>
                    </div>
                  </TabsContent>

                  {/* Tab 3: Data Pelaporan */}
                  <TabsContent value="data-pelaporan" className="mt-0 space-y-6">
                    <div>
                      <h3 className="text-md font-semibold mb-4 flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        Informasi Pelapor
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Cabang Pelapor *</label>
                          <Input
                            placeholder="Nama cabang"
                            value={formData.cabang_asal_melapor}
                            onChange={(e) => handleFieldChange('cabang_asal_melapor', e.target.value)}
                            required
                            readOnly={!!selectedMember}
                            className={selectedMember ? 'bg-muted cursor-not-allowed' : ''}
                          />
                          {validationErrors.cabang_asal_melapor && (
                            <p className="text-sm text-destructive">{validationErrors.cabang_asal_melapor}</p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Nama Pelapor</label>
                          <Input
                            placeholder="Nama pelapor"
                            value={formData.cabang_nama_pelapor}
                            onChange={(e) => handleFieldChange('cabang_nama_pelapor', e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">NIK Pelapor</label>
                          <Input
                            placeholder="NIK pelapor"
                            value={formData.cabang_nik_pelapor}
                            onChange={(e) => handleFieldChange('cabang_nik_pelapor', e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  {/* Tab 4: Proses Cabang */}
                  <TabsContent value="proses-cabang" className="mt-0 space-y-6">
                    <div>
                      <h3 className="text-md font-semibold mb-4 flex items-center gap-2">
                        <Building className="h-4 w-4" />
                        Proses di Cabang
                      </h3>
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-sm font-medium">
                              Tanggal Terima Berkas dari Ahli Waris *
                            </label>
                            <Input
                              type="date"
                              value={formData.cabang_tanggal_awal_terima_berkas}
                              onChange={(e) =>
                                handleFieldChange('cabang_tanggal_awal_terima_berkas', e.target.value)
                              }
                              required
                            />
                            {validationErrors.cabang_tanggal_awal_terima_berkas && (
                              <p className="text-sm text-destructive">
                                {validationErrors.cabang_tanggal_awal_terima_berkas}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              Tanggal saat PC menerima dokumen dari ahli waris
                            </p>
                          </div>

                          {mode === 'edit' && (
                            <div className="space-y-2">
                              <label className="text-sm font-medium">Tanggal Kirim ke Pusat</label>
                              <Input
                                type="date"
                                value={formData.cabang_tanggal_kirim_ke_pusat}
                                onChange={(e) =>
                                  handleFieldChange('cabang_tanggal_kirim_ke_pusat', e.target.value)
                                }
                              />
                              <p className="text-xs text-muted-foreground">
                                Diisi otomatis saat PC mengirim ke pusat
                              </p>
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium">Catatan Proses Internal</label>
                          <Textarea
                            placeholder="Catatan proses internal cabang"
                            value={formData.keterangan}
                            onChange={(e) => handleFieldChange('keterangan', e.target.value)}
                            rows={3}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Dana Kematian - Only show in edit mode */}
                    {mode === 'edit' && (
                      <div>
                        <h3 className="text-md font-semibold mb-4 flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Detail Penyaluran
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Tanggal Serah ke Ahli Waris</label>
                            <Input
                              type="date"
                              value={formData.cabang_tanggal_serah_ke_ahli_waris}
                              onChange={(e) =>
                                handleFieldChange('cabang_tanggal_serah_ke_ahli_waris', e.target.value)
                              }
                            />
                            <p className="text-xs text-muted-foreground">
                              Diisi saat dana diserahkan ke ahli waris
                            </p>
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Tanggal Lapor ke Pusat</label>
                            <Input
                              type="date"
                              value={formData.cabang_tanggal_lapor_ke_pusat}
                              onChange={(e) =>
                                handleFieldChange('cabang_tanggal_lapor_ke_pusat', e.target.value)
                              }
                            />
                            <p className="text-xs text-muted-foreground">
                              Diisi saat PC melaporkan ke pusat
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </TabsContent>

                  {/* Tab 5: Dokumen (Full-Screen Document View) */}
                  <TabsContent value="workspace-dokumen" className="mt-0 h-full">
                    <DanaKematianDocumentWorkspace
                      claim={claim || null}
                      formData={formData}
                      onFormDataChange={setFormData}
                      mode={mode}
                      userRole="cabang"
                      disabled={isPending}
                    />
                  </TabsContent>
                </div>
              </div>
            </Tabs>

            <DialogFooter className="shrink-0 border-t pt-4 px-2">
              <div className="text-sm text-muted-foreground mr-auto">
                * Field wajib diisi
              </div>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Batal
                </Button>
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

      {/* Member Search Modal */}
      {mode === 'create' && (
        <MemberSearchModal
          open={memberSearchModalOpen}
          onClose={() => setMemberSearchModalOpen(false)}
          onMemberSelect={handleMemberSelect}
          members={members}
        />
      )}
    </>
  );
}
