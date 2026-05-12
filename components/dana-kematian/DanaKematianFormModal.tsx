'use client';

import { useState, useEffect, useRef } from 'react';
import {
  User,
  FileText,
  Loader2,
  Plus,
  Pencil,
  Building,
  Search,
  Upload,
  Sparkles,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Phone,
  Circle,
} from 'lucide-react';
import {
  Dialog,
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
import { calculateTariff, formatTariffLabel, getTariffDisplayLabel } from '@/lib/utils/tariff-calculator';
import { useCurrentUserAnggota } from '@/lib/hooks/use-anggota-api';

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

const DOCUMENT_STEPS = [
  {
    label: 'Surat Kematian',
    field: 'file_surat_kematian' as keyof CreateDanaKematianInput,
    folder: 'surat-kematian',
    description: 'Upload surat kematian resmi yang dikeluarkan oleh pejabat berwenang (kelurahan/RS/dsb)',
    required: true,
  },
  {
    label: 'SK Pensiun',
    field: 'file_sk_pensiun' as keyof CreateDanaKematianInput,
    folder: 'sk-pensiun',
    description: 'Upload Surat Keputusan Pensiun anggota yang bersangkutan',
    required: true,
  },
  {
    label: 'Surat Ahli Waris',
    field: 'file_surat_pernyataan_ahli_waris' as keyof CreateDanaKematianInput,
    folder: 'surat-pernyataan-ahli-waris',
    description: 'Upload surat pernyataan ahli waris yang telah dilegalisir',
    required: true,
  },
  {
    label: 'Kartu Keluarga',
    field: 'file_kartu_keluarga' as keyof CreateDanaKematianInput,
    folder: 'kartu-keluarga',
    description: 'Upload kartu keluarga yang masih berlaku',
    required: true,
  },
  {
    label: 'E-KTP',
    field: 'file_e_ktp' as keyof CreateDanaKematianInput,
    folder: 'e-ktp',
    description: 'Upload fotokopi E-KTP ahli waris yang masih berlaku',
    required: false,
  },
  {
    label: 'Surat Nikah',
    field: 'file_surat_nikah' as keyof CreateDanaKematianInput,
    folder: 'surat-nikah',
    description: 'Upload surat nikah (diperlukan jika ahli waris adalah istri atau suami)',
    required: false,
  },
];

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
  const [documentStep, setDocumentStep] = useState(0);
  const [memberSearchModalOpen, setMemberSearchModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Anggota | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [manualTariffOverride, setManualTariffOverride] = useState(false);
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({});
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const { data: currentUserAnggota } = useCurrentUserAnggota();

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

      if (claim.anggota_id) {
        const member = members.find(m => m.id === claim.anggota_id);
        if (member) setSelectedMember(member);
      }
    } else {
      setFormData({
        ...defaultFormData,
        cabang_nama_pelapor: currentUserAnggota?.nama_anggota ?? '',
        cabang_nik_pelapor: currentUserAnggota?.nik ?? '',
        cabang_asal_melapor: currentUserAnggota?.nama_cabang ?? '',
      });
      setSelectedMember(null);
    }

    setValidationErrors({});
    setActiveTab('informasi-utama');
    setDocumentStep(0);
    setManualTariffOverride(false);
  }, [claim, mode, open, members, currentUserAnggota]);

  useEffect(() => {
    if (mode === 'create' && formData.tanggal_meninggal && formData.status_mps && !manualTariffOverride) {
      const calculation = calculateTariff(formData.tanggal_meninggal, formData.status_mps);
      setFormData(prev => ({ ...prev, besaran_dana_kematian: calculation.amount }));
    }
  }, [formData.tanggal_meninggal, formData.status_mps, manualTariffOverride, mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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
      // Auto-navigate to the tab that contains the first error
      const dokumenTabFields = ['cabang_asal_melapor', 'cabang_tanggal_awal_terima_berkas'];
      const hasInformasiError = ['member', 'tanggal_meninggal', 'nama_ahli_waris'].some(f => errors[f]);
      const hasDokumenError = dokumenTabFields.some(f => errors[f]);
      if (hasDokumenError && !hasInformasiError) {
        setActiveTab('workspace-dokumen');
      } else {
        setActiveTab('informasi-utama');
      }
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
      status_proses: 'verifikasi_cabang',
    });

    setValidationErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors.member;
      return newErrors;
    });

    setManualTariffOverride(false);
  };

  const handleFieldChange = (field: keyof CreateDanaKematianInput, value: any) => {
    setFormData({ ...formData, [field]: value });

    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleFileSelect = async (
    field: keyof CreateDanaKematianInput,
    folder: string,
    file: File
  ) => {
    setUploadingField(field as string);
    setUploadErrors(prev => { const e = { ...prev }; delete e[field as string]; return e; });

    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('bucket', 'dana-kematian');
      fd.append('folder', folder);

      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const json = await res.json();

      if (!res.ok) throw new Error(json.error || 'Upload gagal');

      handleFieldChange(field, json.url);
    } catch (err) {
      setUploadErrors(prev => ({
        ...prev,
        [field as string]: err instanceof Error ? err.message : 'Upload gagal',
      }));
    } finally {
      setUploadingField(null);
    }
  };

  const currentDocStep = DOCUMENT_STEPS[documentStep];

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
              <TabsList className="shrink-0 grid grid-cols-2 w-full h-auto p-1 bg-muted mb-4 mx-2">
                <TabsTrigger value="informasi-utama" className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <span className="hidden sm:inline">Informasi</span>
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
                              Cari Anggota
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
                            if (value !== 'auto') setManualTariffOverride(true);
                            handleFieldChange(
                              'besaran_dana_kematian',
                              value === 'auto'
                                ? calculateTariff(formData.tanggal_meninggal || '', formData.status_mps).amount
                                : parseFloat(value)
                            );
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

                  {/* Tab 2: Dokumen */}
                  <TabsContent value="workspace-dokumen" className="mt-0 space-y-8">

                    {/* Forms from Detail, Pelaporan, Proses tabs */}
                    <div className="space-y-6">
                      {/* Detail & Pelaporan */}
                      <div>
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                          Informasi Pelaporan
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Cabang Pelapor *</label>
                            <Input
                              value={formData.cabang_asal_melapor}
                              readOnly
                              className="bg-muted cursor-not-allowed"
                            />
                            {validationErrors.cabang_asal_melapor && (
                              <p className="text-sm text-destructive">{validationErrors.cabang_asal_melapor}</p>
                            )}
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Nama Pelapor</label>
                            <Input
                              value={formData.cabang_nama_pelapor}
                              readOnly
                              className="bg-muted cursor-not-allowed"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium">NIK Pelapor</label>
                            <Input
                              value={formData.cabang_nik_pelapor}
                              readOnly
                              className="bg-muted cursor-not-allowed"
                            />
                          </div>
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
                          <div className="space-y-2">
                            <label className="text-sm font-medium">
                              Tanggal Terima Berkas dari Ahli Waris *
                            </label>
                            <Input
                              type="date"
                              value={formData.cabang_tanggal_awal_terima_berkas}
                              onChange={(e) => handleFieldChange('cabang_tanggal_awal_terima_berkas', e.target.value)}
                              required
                            />
                            {validationErrors.cabang_tanggal_awal_terima_berkas && (
                              <p className="text-sm text-destructive">
                                {validationErrors.cabang_tanggal_awal_terima_berkas}
                              </p>
                            )}
                          </div>
                          {mode === 'edit' && (
                            <>
                              <div className="space-y-2">
                                <label className="text-sm font-medium">Tanggal Kirim ke Pusat</label>
                                <Input
                                  type="date"
                                  value={formData.cabang_tanggal_kirim_ke_pusat}
                                  onChange={(e) => handleFieldChange('cabang_tanggal_kirim_ke_pusat', e.target.value)}
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="text-sm font-medium">Tanggal Serah ke Ahli Waris</label>
                                <Input
                                  type="date"
                                  value={formData.cabang_tanggal_serah_ke_ahli_waris}
                                  onChange={(e) => handleFieldChange('cabang_tanggal_serah_ke_ahli_waris', e.target.value)}
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="text-sm font-medium">Tanggal Lapor ke Pusat</label>
                                <Input
                                  type="date"
                                  value={formData.cabang_tanggal_lapor_ke_pusat}
                                  onChange={(e) => handleFieldChange('cabang_tanggal_lapor_ke_pusat', e.target.value)}
                                />
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Keterangan */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Keterangan</label>
                        <Textarea
                          placeholder="Keterangan tambahan mengenai pengajuan"
                          value={formData.keterangan}
                          onChange={(e) => handleFieldChange('keterangan', e.target.value)}
                          rows={3}
                        />
                      </div>
                    </div>

                    {/* Divider */}
                    <div className="border-t pt-2">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-6">
                        Upload Dokumen Persyaratan
                      </h3>

                      {/* Stepper Header */}
                      <div className="flex items-center justify-between mb-8 overflow-x-auto pb-2">
                        {DOCUMENT_STEPS.map((step, index) => {
                          const fileValue = formData[step.field] as string;
                          const isCompleted = !!fileValue;
                          const isActive = index === documentStep;
                          const isPast = index < documentStep;

                          return (
                            <div key={step.field} className="flex items-center flex-1 min-w-0">
                              {/* Step button */}
                              <button
                                type="button"
                                onClick={() => setDocumentStep(index)}
                                className="flex flex-col items-center gap-1.5 flex-shrink-0"
                              >
                                <div
                                  className={`
                                    w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all font-semibold text-sm
                                    ${isCompleted
                                      ? 'bg-green-500 border-green-500 text-white'
                                      : isActive
                                        ? 'bg-primary border-primary text-primary-foreground'
                                        : 'bg-background border-muted-foreground/30 text-muted-foreground'
                                    }
                                  `}
                                >
                                  {isCompleted
                                    ? <CheckCircle2 className="h-5 w-5" />
                                    : <span>{index + 1}</span>
                                  }
                                </div>
                                <span
                                  className={`text-xs font-medium text-center leading-tight max-w-16 ${
                                    isActive ? 'text-primary' : isCompleted ? 'text-green-600' : 'text-muted-foreground'
                                  }`}
                                >
                                  {step.label}
                                  {step.required && <span className="text-destructive"> *</span>}
                                </span>
                              </button>

                              {/* Connector line */}
                              {index < DOCUMENT_STEPS.length - 1 && (
                                <div
                                  className={`flex-1 h-0.5 mx-2 -mt-5 transition-colors ${
                                    isPast || isCompleted ? 'bg-green-400' : 'bg-muted-foreground/20'
                                  }`}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Step Content Card */}
                      <div className="border rounded-xl p-6 bg-card shadow-sm space-y-5">
                        {/* Step header */}
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                Langkah {documentStep + 1} dari {DOCUMENT_STEPS.length}
                              </span>
                              {currentDocStep.required && (
                                <Badge variant="destructive" className="text-xs px-1.5 py-0">Wajib</Badge>
                              )}
                              {!currentDocStep.required && (
                                <Badge variant="secondary" className="text-xs px-1.5 py-0">Opsional</Badge>
                              )}
                            </div>
                            <h4 className="text-lg font-semibold">{currentDocStep.label}</h4>
                            <p className="text-sm text-muted-foreground mt-0.5">{currentDocStep.description}</p>
                          </div>
                          {(formData[currentDocStep.field] as string) && (
                            <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50 shrink-0">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Terupload
                            </Badge>
                          )}
                        </div>

                        {/* Nama & Tanggal Meninggal */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Nama Meninggal</label>
                            <Input
                              placeholder="Nama yang meninggal"
                              value={formData.nama_anggota}
                              onChange={(e) => handleFieldChange('nama_anggota', e.target.value)}
                              readOnly={!!selectedMember}
                              className={selectedMember ? 'bg-muted cursor-not-allowed' : ''}
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Tanggal Meninggal</label>
                            <Input
                              type="date"
                              value={formData.tanggal_meninggal}
                              onChange={(e) => handleFieldChange('tanggal_meninggal', e.target.value)}
                            />
                          </div>
                        </div>

                        {/* File Upload Zone */}
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Dokumen Pendukung</label>
                          <div
                            className={`
                              border-2 border-dashed rounded-lg p-8 text-center transition-all
                              ${uploadingField === currentDocStep.field
                                ? 'border-primary/50 bg-primary/5 cursor-wait'
                                : uploadErrors[currentDocStep.field]
                                  ? 'border-destructive/50 bg-destructive/5 cursor-pointer hover:bg-destructive/10'
                                  : (formData[currentDocStep.field] as string)
                                    ? 'border-green-400 bg-green-50 hover:bg-green-100 cursor-pointer'
                                    : 'border-muted-foreground/25 hover:border-primary hover:bg-primary/5 cursor-pointer'
                              }
                            `}
                            onClick={() => {
                              if (uploadingField !== currentDocStep.field) {
                                fileInputRefs.current[currentDocStep.field]?.click();
                              }
                            }}
                          >
                            <input
                              ref={(el) => { fileInputRefs.current[currentDocStep.field] = el; }}
                              type="file"
                              className="hidden"
                              accept=".pdf,.jpg,.jpeg,.png"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleFileSelect(currentDocStep.field, currentDocStep.folder, file);
                                // Reset so the same file can be re-selected after an error
                                e.target.value = '';
                              }}
                            />

                            {uploadingField === currentDocStep.field ? (
                              <div className="space-y-2">
                                <Loader2 className="h-10 w-10 mx-auto text-primary animate-spin" />
                                <p className="font-medium text-primary">Mengupload dokumen...</p>
                              </div>
                            ) : uploadErrors[currentDocStep.field] ? (
                              <div className="space-y-2">
                                <Upload className="h-10 w-10 mx-auto text-destructive/60" />
                                <p className="font-medium text-destructive">
                                  {uploadErrors[currentDocStep.field]}
                                </p>
                                <p className="text-xs text-destructive/70">Klik untuk coba lagi</p>
                              </div>
                            ) : (formData[currentDocStep.field] as string) ? (
                              <div className="space-y-2">
                                <CheckCircle2 className="h-10 w-10 mx-auto text-green-500" />
                                <p className="font-medium text-green-700 text-sm break-all">
                                  {(() => {
                                    const url = formData[currentDocStep.field] as string;
                                    try { return decodeURIComponent(new URL(url).pathname.split('/').pop() ?? url); }
                                    catch { return url; }
                                  })()}
                                </p>
                                <p className="text-xs text-green-600">Klik untuk mengganti dokumen</p>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <Upload className="h-10 w-10 mx-auto text-muted-foreground/50" />
                                <p className="font-medium text-muted-foreground">
                                  Klik untuk upload {currentDocStep.label}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Format: PDF, JPG, PNG (maks. 5MB)
                                </p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Step Navigation */}
                        <div className="flex items-center justify-between pt-2 border-t">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setDocumentStep(prev => Math.max(0, prev - 1))}
                            disabled={documentStep === 0}
                          >
                            <ChevronLeft className="h-4 w-4 mr-1" />
                            Sebelumnya
                          </Button>

                          <span className="text-xs text-muted-foreground">
                            {DOCUMENT_STEPS.filter(s => formData[s.field] as string).length} / {DOCUMENT_STEPS.length} dokumen terupload
                          </span>

                          {documentStep < DOCUMENT_STEPS.length - 1 ? (
                            <Button
                              type="button"
                              onClick={() => setDocumentStep(prev => Math.min(DOCUMENT_STEPS.length - 1, prev + 1))}
                            >
                              Selanjutnya
                              <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                          ) : (
                            <Button type="button" variant="outline" disabled>
                              <CheckCircle2 className="h-4 w-4 mr-1 text-green-500" />
                              Selesai
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>

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
                ) : mode === 'create' ? (
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
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
