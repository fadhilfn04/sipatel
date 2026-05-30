'use client';

import { useState, useEffect, useCallback } from 'react';
import { LaporanPeriodeDakem, CreateLaporanPeriodeDakemInput } from '@/lib/supabase';

interface ClaimForLaporan {
  id: string;
  nama_anggota: string;
  cabang_asal_melapor: string;
  tanggal_meninggal: string;
  nama_ahli_waris: string;
  status_ahli_waris: string;
  besaran_dana_kematian: number;
  cabang_tanggal_serah_ke_ahli_waris: string | null;
  file_bukti_penyerahan: string | null;
  anggota: { nik: string } | null;
}

interface ClaimsMeta {
  periode: string;
  jumlah_klaim: number;
  total_dana: number;
  start_date: string;
  end_date: string;
}

// ── List laporan ─────────────────────────────────────────────────────────────
export function useLaporanPeriodeDakem(cabang?: string) {
  const [data, setData] = useState<LaporanPeriodeDakem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (cabang) params.set('cabang', cabang);
      const res = await window.fetch(`/api/laporan-periode-dakem?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal memuat laporan');
      setData(json.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setIsLoading(false);
    }
  }, [cabang]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, isLoading, error, refetch: fetch };
}

// ── Claims untuk preview periode ──────────────────────────────────────────────
export function useClaimsForPeriode(periode: string, cabang?: string) {
  const [data, setData] = useState<ClaimForLaporan[]>([]);
  const [meta, setMeta] = useState<ClaimsMeta | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!periode) return;
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ periode });
      if (cabang) params.set('cabang', cabang);
      const res = await window.fetch(`/api/laporan-periode-dakem/claims?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal memuat data klaim');
      setData(json.data ?? []);
      setMeta(json.meta ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setIsLoading(false);
    }
  }, [periode, cabang]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, meta, isLoading, error, refetch: fetch };
}

// ── Create laporan ────────────────────────────────────────────────────────────
export function useCreateLaporanPeriodeDakem() {
  const [isLoading, setIsLoading] = useState(false);

  const create = async (input: CreateLaporanPeriodeDakemInput): Promise<LaporanPeriodeDakem> => {
    setIsLoading(true);
    try {
      const res = await window.fetch('/api/laporan-periode-dakem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal membuat laporan');
      return json.data;
    } finally {
      setIsLoading(false);
    }
  };

  return { create, isLoading };
}

// ── Update laporan (upload file) ──────────────────────────────────────────────
export function useUpdateLaporanPeriodeDakem() {
  const [isLoading, setIsLoading] = useState(false);

  const update = async (id: string, patch: { file_laporan?: string; catatan?: string }): Promise<LaporanPeriodeDakem> => {
    setIsLoading(true);
    try {
      const res = await window.fetch(`/api/laporan-periode-dakem/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal mengupdate laporan');
      return json.data;
    } finally {
      setIsLoading(false);
    }
  };

  return { update, isLoading };
}

// ── Delete laporan ────────────────────────────────────────────────────────────
export function useDeleteLaporanPeriodeDakem() {
  const [isLoading, setIsLoading] = useState(false);

  const remove = async (id: string): Promise<void> => {
    setIsLoading(true);
    try {
      const res = await window.fetch(`/api/laporan-periode-dakem/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal menghapus laporan');
    } finally {
      setIsLoading(false);
    }
  };

  return { remove, isLoading };
}

// ── CSV Export helper ─────────────────────────────────────────────────────────
export function exportClaimsToCSV(claims: ClaimForLaporan[], periodeLabel: string, cabang: string) {
  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);

  const formatDate = (d: string | null) => {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const headers = ['No', 'NIK', 'Nama Anggota', 'Cabang', 'Tgl Meninggal', 'Nama Ahli Waris', 'Hubungan', 'Besaran Dana', 'Tgl Serah ke AW'];

  const rows = claims.map((c, i) => [
    i + 1,
    c.anggota?.nik ?? '-',
    c.nama_anggota,
    c.cabang_asal_melapor,
    formatDate(c.tanggal_meninggal),
    c.nama_ahli_waris,
    c.status_ahli_waris,
    formatCurrency(c.besaran_dana_kematian),
    formatDate(c.cabang_tanggal_serah_ke_ahli_waris),
  ]);

  const totalDana = claims.reduce((s, c) => s + c.besaran_dana_kematian, 0);

  const csvContent = [
    [`Laporan Dana Kematian - ${periodeLabel} - ${cabang}`],
    [],
    headers,
    ...rows,
    [],
    ['', '', '', '', '', '', 'TOTAL', formatCurrency(totalDana), ''],
  ]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `laporan-dakem-${periodeLabel.replace(/\s/g, '-')}-${cabang}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
