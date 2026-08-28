'use client';

import { Fragment, useEffect, useState } from 'react';
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from '@headlessui/react';
import { X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PembayaranSumbangan, CreatePembayaranSumbanganInput } from '@/lib/supabase';

interface PembayaranFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CreatePembayaranSumbanganInput) => Promise<void>;
  mode: 'create' | 'edit';
  pembayaran?: PembayaranSumbangan;
  isPending?: boolean;
  anggotaList?: Array<{ id: string; nama_anggota: string; nik: string; besaran_iuran: number | null }>;
}

export function PembayaranFormModal({
  open,
  onClose,
  onSubmit,
  mode,
  pembayaran,
  isPending,
  anggotaList = [],
}: PembayaranFormModalProps) {
  const [formData, setFormData] = useState<CreatePembayaranSumbanganInput>({
    nama_anggota: '',
    nik: '',
    tanggal_transaksi: new Date().toISOString().split('T')[0],
    jumlah_pembayaran: 0,
    tipe_sumbangan: 'sumbangan_bulanan',
    status_pembayaran: 'pending',
    nomor_referensi: '',
    keterangan_pembayaran: '',
    metode_pembayaran: '',
    bukti_pembayaran: '',
    tanggal_verifikasi: '',
    diverifikasi_oleh: '',
    catatan_verifikasi: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedAnggotaId, setSelectedAnggotaId] = useState<string>('');

  // Reset form when modal opens/closes or mode changes
  useEffect(() => {
    if (open) {
      if (mode === 'edit' && pembayaran) {
        setFormData({
          nama_anggota: pembayaran.nama_anggota,
          nik: pembayaran.nik || '',
          tanggal_transaksi: pembayaran.tanggal_transaksi,
          jumlah_pembayaran: pembayaran.jumlah_pembayaran,
          tipe_sumbangan: pembayaran.tipe_sumbangan,
          status_pembayaran: pembayaran.status_pembayaran,
          nomor_referensi: pembayaran.nomor_referensi || '',
          keterangan_pembayaran: pembayaran.keterangan_pembayaran || '',
          metode_pembayaran: pembayaran.metode_pembayaran || '',
          bukti_pembayaran: pembayaran.bukti_pembayaran || '',
          tanggal_verifikasi: pembayaran.tanggal_verifikasi || '',
          diverifikasi_oleh: pembayaran.diverifikasi_oleh || '',
          catatan_verifikasi: pembayaran.catatan_verifikasi || '',
        });
        // Find matching anggota
        const matchingAnggota = anggotaList.find(a => a.nama_anggota === pembayaran.nama_anggota);
        if (matchingAnggota) {
          setSelectedAnggotaId(matchingAnggota.id);
        }
      } else {
        setFormData({
          nama_anggota: '',
          nik: '',
          tanggal_transaksi: new Date().toISOString().split('T')[0],
          jumlah_pembayaran: 0,
          tipe_sumbangan: 'sumbangan_bulanan',
          status_pembayaran: 'pending',
          nomor_referensi: '',
          keterangan_pembayaran: '',
          metode_pembayaran: '',
          bukti_pembayaran: '',
          tanggal_verifikasi: '',
          diverifikasi_oleh: '',
          catatan_verifikasi: '',
        });
        setSelectedAnggotaId('');
      }
      setErrors({});
    }
  }, [open, mode, pembayaran, anggotaList]);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleAnggotaSelect = (anggotaId: string) => {
    setSelectedAnggotaId(anggotaId);
    const anggota = anggotaList.find(a => a.id === anggotaId);
    if (anggota) {
      setFormData(prev => ({
        ...prev,
        nama_anggota: anggota.nama_anggota,
        nik: anggota.nik,
        jumlah_pembayaran: anggota.besaran_iuran || prev.jumlah_pembayaran,
      }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.nama_anggota) newErrors.nama_anggota = 'Nama anggota wajib diisi';
    if (!formData.tanggal_transaksi) newErrors.tanggal_transaksi = 'Tanggal transaksi wajib diisi';
    if (!formData.jumlah_pembayaran || formData.jumlah_pembayaran <= 0) {
      newErrors.jumlah_pembayaran = 'Jumlah pembayaran harus lebih dari 0';
    }
    if (!formData.tipe_sumbangan) newErrors.tipe_sumbangan = 'Tipe sumbangan wajib dipilih';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    try {
      // Convert empty strings to null for date fields and optional fields
      const cleanedData: CreatePembayaranSumbanganInput = {
        ...formData,
        tanggal_verifikasi: formData.tanggal_verifikasi || undefined,
        diverifikasi_oleh: formData.diverifikasi_oleh || undefined,
        catatan_verifikasi: formData.catatan_verifikasi || undefined,
        keterangan_pembayaran: formData.keterangan_pembayaran || undefined,
        metode_pembayaran: formData.metode_pembayaran || undefined,
        bukti_pembayaran: formData.bukti_pembayaran || undefined,
        nomor_referensi: formData.nomor_referensi || undefined,
      };

      await onSubmit(cleanedData);
    } catch (error) {
      // Error is handled by parent
    }
  };

  return (
    <Dialog open={open} onClose={onClose} as={Fragment}>
      <div className="relative z-50">
        <DialogBackdrop className="fixed inset-0 bg-black/30 backdrop-blur-sm transition-opacity" />
        <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <DialogPanel className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl">
            {/* Header */}
            <div className="bg-gray-50 px-4 py-3 sm:px-6 flex items-center justify-between">
              <DialogTitle className="text-base font-semibold leading-6 text-gray-900">
                {mode === 'create' ? 'Tambah Pembayaran Sumbangan' : 'Edit Pembayaran Sumbangan'}
              </DialogTitle>
              <button
                type="button"
                onClick={onClose}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit}>
              <div className="px-4 py-5 sm:p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                {/* Anggota Selection */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Label htmlFor="anggota_id">Pilih Anggota <span className="text-red-500">*</span></Label>
                    <Select
                      value={selectedAnggotaId}
                      onValueChange={handleAnggotaSelect}
                      disabled={mode === 'edit'}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Pilih anggota" />
                      </SelectTrigger>
                      <SelectContent>
                        {anggotaList.map((anggota) => (
                          <SelectItem key={anggota.id} value={anggota.id}>
                            {anggota.nama_anggota} - {anggota.nik}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.nama_anggota && (
                      <p className="text-sm text-red-600 mt-1">{errors.nama_anggota}</p>
                    )}
                  </div>
                </div>

                {/* NIK & Nama Anggota (read-only if anggota selected) */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="nik">NIK</Label>
                    <Input
                      id="nik"
                      value={formData.nik}
                      onChange={(e) => handleInputChange('nik', e.target.value)}
                      placeholder="Nomor NIK"
                      readOnly={!!selectedAnggotaId}
                      className={selectedAnggotaId ? 'bg-gray-100' : ''}
                    />
                  </div>
                  <div>
                    <Label htmlFor="nama_anggota">Nama Anggota <span className="text-red-500">*</span></Label>
                    <Input
                      id="nama_anggota"
                      value={formData.nama_anggota}
                      onChange={(e) => handleInputChange('nama_anggota', e.target.value)}
                      placeholder="Nama anggota"
                      readOnly={!!selectedAnggotaId}
                      className={selectedAnggotaId ? 'bg-gray-100' : ''}
                    />
                  </div>
                </div>

                {/* Tanggal Transaksi & Jumlah */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="tanggal_transaksi">Tanggal Transaksi <span className="text-red-500">*</span></Label>
                    <Input
                      id="tanggal_transaksi"
                      type="date"
                      value={formData.tanggal_transaksi}
                      onChange={(e) => handleInputChange('tanggal_transaksi', e.target.value)}
                      className={errors.tanggal_transaksi ? 'border-red-500' : ''}
                    />
                    {errors.tanggal_transaksi && (
                      <p className="text-sm text-red-600 mt-1">{errors.tanggal_transaksi}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="jumlah_pembayaran">Jumlah Pembayaran (Rp) <span className="text-red-500">*</span></Label>
                    <Input
                      id="jumlah_pembayaran"
                      type="number"
                      step="0.01"
                      value={formData.jumlah_pembayaran}
                      onChange={(e) => handleInputChange('jumlah_pembayaran', parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      className={errors.jumlah_pembayaran ? 'border-red-500' : ''}
                    />
                    {errors.jumlah_pembayaran && (
                      <p className="text-sm text-red-600 mt-1">{errors.jumlah_pembayaran}</p>
                    )}
                  </div>
                </div>

                {/* Tipe Sumbangan & Status Pembayaran */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="tipe_sumbangan">Tipe Sumbangan <span className="text-red-500">*</span></Label>
                    <Select
                      value={formData.tipe_sumbangan}
                      onValueChange={(value) => handleInputChange('tipe_sumbangan', value)}
                    >
                      <SelectTrigger className={errors.tipe_sumbangan ? 'border-red-500' : ''}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sumbangan_bulanan">Sumbangan Bulanan</SelectItem>
                        <SelectItem value="sumbangan_kematian">Sumbangan Kematian</SelectItem>
                        <SelectItem value="sumbangan_khusus">Sumbangan Khusus</SelectItem>
                        <SelectItem value="sumbangan_investasi">Sumbangan Investasi</SelectItem>
                        <SelectItem value="sumbangan_lainnya">Sumbangan Lainnya</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.tipe_sumbangan && (
                      <p className="text-sm text-red-600 mt-1">{errors.tipe_sumbangan}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="status_pembayaran">Status Pembayaran</Label>
                    <Select
                      value={formData.status_pembayaran}
                      onValueChange={(value: any) => handleInputChange('status_pembayaran', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                        <SelectItem value="failed">Gagal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Metode Pembayaran & Nomor Referensi */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="metode_pembayaran">Metode Pembayaran</Label>
                    <Input
                      id="metode_pembayaran"
                      value={formData.metode_pembayaran}
                      onChange={(e) => handleInputChange('metode_pembayaran', e.target.value)}
                      placeholder="Transfer / Tunai / dll"
                    />
                  </div>
                  <div>
                    <Label htmlFor="nomor_referensi">Nomor Referensi</Label>
                    <Input
                      id="nomor_referensi"
                      value={formData.nomor_referensi}
                      onChange={(e) => handleInputChange('nomor_referensi', e.target.value)}
                      placeholder="Auto-generated jika kosong"
                    />
                  </div>
                </div>

                {/* Bukti Pembayaran */}
                <div>
                  <Label htmlFor="bukti_pembayaran">URL Bukti Pembayaran</Label>
                  <Input
                    id="bukti_pembayaran"
                    value={formData.bukti_pembayaran}
                    onChange={(e) => handleInputChange('bukti_pembayaran', e.target.value)}
                    placeholder="https://example.com/bukti.jpg"
                  />
                </div>

                {/* Keterangan */}
                <div>
                  <Label htmlFor="keterangan_pembayaran">Keterangan</Label>
                  <Textarea
                    id="keterangan_pembayaran"
                    value={formData.keterangan_pembayaran}
                    onChange={(e) => handleInputChange('keterangan_pembayaran', e.target.value)}
                    placeholder="Keterangan pembayaran..."
                    rows={3}
                  />
                </div>

                {/* Verifikasi Section (only show when editing and status is paid/failed) */}
                {(mode === 'edit' || formData.status_pembayaran === 'paid' || formData.status_pembayaran === 'failed') && (
                  <div className="border-t pt-4 mt-4">
                    <h4 className="text-sm font-medium text-gray-900 mb-3">Data Verifikasi</h4>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <Label htmlFor="tanggal_verifikasi">Tanggal Verifikasi</Label>
                        <Input
                          id="tanggal_verifikasi"
                          type="date"
                          value={formData.tanggal_verifikasi}
                          onChange={(e) => handleInputChange('tanggal_verifikasi', e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="diverifikasi_oleh">Diverifikasi Oleh</Label>
                        <Input
                          id="diverifikasi_oleh"
                          value={formData.diverifikasi_oleh}
                          onChange={(e) => handleInputChange('diverifikasi_oleh', e.target.value)}
                          placeholder="Nama verifikator"
                        />
                      </div>
                    </div>
                    <div className="mt-4">
                      <Label htmlFor="catatan_verifikasi">Catatan Verifikasi</Label>
                      <Textarea
                        id="catatan_verifikasi"
                        value={formData.catatan_verifikasi}
                        onChange={(e) => handleInputChange('catatan_verifikasi', e.target.value)}
                        placeholder="Catatan verifikasi..."
                        rows={2}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6 gap-2">
                <Button
                  type="submit"
                  disabled={isPending}
                  className="w-full sm:w-auto"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Menyimpan...
                    </>
                  ) : mode === 'create' ? (
                    'Tambah Pembayaran'
                  ) : (
                    'Simpan Perubahan'
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={isPending}
                  className="w-full sm:w-auto"
                >
                  Batal
                </Button>
              </div>
            </form>
              </DialogPanel>
            </div>
          </div>
        </div>
      </Dialog>
    );
  }
