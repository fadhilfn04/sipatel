'use client';

import { useEffect, useState } from 'react';
import { Wallet } from 'lucide-react';
import type { PenggantianRekeningFormValues } from '@/lib/anggota-rekening';
import type { Anggota } from '@/lib/supabase';
import { FileUpload } from '@/components/ui/FileUpload';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface MasterBank {
  id: string;
  kode_bank: string;
  nama_bank: string;
  is_active: boolean;
}

interface PenggantianRekeningFormProps {
  member: Anggota;
  values: PenggantianRekeningFormValues;
  onChange: (values: PenggantianRekeningFormValues) => void;
  onSubmit?: () => void;
  isPending?: boolean;
  footer?: React.ReactNode;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Form Penggantian Rekening — hanya berisi field rekening baru (bank dari
 * master data bank, nomor rekening, nama pemilik, tanggal efektif, dokumen
 * pendukung). Rekening aktif/riwayat ditampilkan oleh halaman induk.
 *
 * Aturan bisnis: nama pemilik rekening wajib sama dengan nama anggota
 * (default aman — lihat lib/anggota-rekening.ts WAJIB_PEMILIK_SAMA_DENGAN_ANGGOTA).
 */
export function PenggantianRekeningForm({
  member,
  values,
  onChange,
  onSubmit,
  isPending = false,
  footer,
}: PenggantianRekeningFormProps) {
  const [banks, setBanks] = useState<MasterBank[]>([]);
  const [loadingBanks, setLoadingBanks] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const loadBanks = async () => {
      try {
        const res = await fetch('/api/master-bank');
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || 'Gagal memuat daftar bank');
        if (!cancelled) setBanks(json.data || []);
      } catch (err) {
        console.error('Gagal memuat daftar bank:', err);
      } finally {
        if (!cancelled) setLoadingBanks(false);
      }
    };
    loadBanks();
    return () => {
      cancelled = true;
    };
  }, []);

  const setField = <K extends keyof PenggantianRekeningFormValues>(
    key: K,
    value: PenggantianRekeningFormValues[K],
  ) => {
    onChange({ ...values, [key]: value });
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit?.();
      }}
      className="space-y-6"
    >
      {/* Rekening Baru */}
      <div>
        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <Wallet className="h-5 w-5" />
          Rekening Baru
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Bank <span className="text-destructive">*</span>
            </label>
            <Select
              value={values.nama_bank}
              onValueChange={(namaBank) => {
                const bank = banks.find((b) => b.nama_bank === namaBank);
                setField('nama_bank', namaBank);
                setField('kode_bank', bank?.kode_bank ?? null);
              }}
              disabled={isPending}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    loadingBanks ? 'Memuat daftar bank…' : 'Pilih bank'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {banks.map((bank) => (
                  <SelectItem key={bank.id} value={bank.nama_bank}>
                    {bank.nama_bank} ({bank.kode_bank})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Daftar bank dikelola pada master data bank.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Nomor Rekening Baru <span className="text-destructive">*</span>
            </label>
            <Input
              placeholder="8–16 digit angka"
              inputMode="numeric"
              value={values.norek_bank}
              onChange={(e) =>
                setField('norek_bank', e.target.value.replace(/[^\d]/g, ''))
              }
              disabled={isPending}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Nama Pemilik Rekening{' '}
              <span className="text-destructive">*</span>
            </label>
            <Input
              placeholder="Nama pemilik sesuai buku rekening"
              value={values.nama_pemilik_rekening}
              onChange={(e) => setField('nama_pemilik_rekening', e.target.value)}
              disabled={isPending}
            />
            <p className="text-xs text-muted-foreground">
              Wajib sama dengan nama anggota:{' '}
              <strong>{member.nama_anggota}</strong>.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Tanggal Efektif <span className="text-destructive">*</span>
            </label>
            <Input
              type="date"
              min={todayIso()}
              value={values.tanggal_efektif}
              onChange={(e) => setField('tanggal_efektif', e.target.value)}
              disabled={isPending}
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium">
              Dokumen Pendukung <span className="text-destructive">*</span>
            </label>
            <FileUpload
              value={values.dokumen_pendukung}
              onChange={(url) => setField('dokumen_pendukung', url)}
              bucket="anggota"
              folder="dokumen-rekening"
              label="Buku tabungan / bukti kepemilikan rekening (PDF/JPG/PNG, maks 5MB)"
              disabled={isPending}
            />
          </div>
        </div>
      </div>

      {footer && (
        <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
          {footer}
        </div>
      )}
    </form>
  );
}

