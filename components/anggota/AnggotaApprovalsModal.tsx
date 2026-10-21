'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Check, X, ClipboardList } from 'lucide-react';

interface AnggotaApprovalsModalProps {
  open: boolean;
  onClose: () => void;
  isAdmin: boolean;
  onDecided?: () => void;
}

interface ApprovalRow {
  id: string;
  anggota_id: string | null;
  jenis: 'create' | 'edit' | 'hapus';
  status: 'menunggu' | 'disetujui' | 'ditolak';
  data_sebelum: Record<string, any> | null;
  data_usulan: Record<string, any> | null;
  alasan: string | null;
  diajukan_oleh: string;
  diajukan_pada: string;
  alasan_keputusan: string | null;
  anggota?: { id: string; nik: string | null; nama_anggota: string | null; nama_cabang: string | null } | null;
}

const JENIS_LABEL = { create: 'Tambah', edit: 'Edit', hapus: 'Hapus' } as const;

/** Variant badge per jenis usulan */
const JENIS_VARIANT: Record<keyof typeof JENIS_LABEL, 'success' | 'secondary' | 'destructive'> = {
  create: 'success',
  edit: 'secondary',
  hapus: 'destructive',
};

/**
 * Modal daftar usulan perubahan data anggota (edit/hapus) + keputusan admin.
 */
export function AnggotaApprovalsModal({
  open,
  onClose,
  isAdmin,
  onDecided,
}: AnggotaApprovalsModalProps) {
  const [statusFilter, setStatusFilter] = useState<'menunggu' | 'semua'>('menunggu');
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<ApprovalRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/anggota/approvals?status=${statusFilter}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Gagal memuat usulan');
      setRows(json.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat usulan');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const decide = async (id: string, keputusan: 'setujui' | 'tolak', alasan?: string) => {
    setProcessingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/anggota/approvals/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keputusan, alasan }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Gagal memutuskan usulan');
      await load();
      onDecided?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memutuskan usulan');
    } finally {
      setProcessingId(null);
    }
  };

  const handleTolak = (id: string) => {
    const alasan = window.prompt('Alasan penolakan (wajib):');
    if (!alasan || !alasan.trim()) return;
    decide(id, 'tolak', alasan.trim());
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Approval Perubahan Data Anggota
          </DialogTitle>
          <DialogDescription>
            Perubahan (edit/hapus) data utama anggota oleh cabang memerlukan
            persetujuan admin. Data utama tidak berubah sampai disetujui.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <Button
            variant={statusFilter === 'menunggu' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('menunggu')}
          >
            Menunggu
          </Button>
          <Button
            variant={statusFilter === 'semua' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('semua')}
          >
            Semua
          </Button>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Memuat usulan...
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Tidak ada usulan perubahan data anggota.
          </p>
        ) : (
          <div className="space-y-2">
            {rows.map((row) => (
              <div key={row.id} className="rounded-lg border p-3 text-sm space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {row.anggota?.nama_anggota || row.data_usulan?.nama_anggota || '(anggota)'}{' '}
                      <span className="text-muted-foreground font-mono text-xs">
                        {row.anggota?.nik || row.data_usulan?.nik || ''}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {row.anggota?.nama_cabang || row.data_usulan?.nama_cabang || '—'} · diajukan{' '}
                      {new Date(row.diajukan_pada).toLocaleString('id-ID')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={JENIS_VARIANT[row.jenis]}>
                      {JENIS_LABEL[row.jenis]}
                    </Badge>
                    <Badge
                      variant={
                        row.status === 'disetujui'
                          ? 'success'
                          : row.status === 'ditolak'
                          ? 'destructive'
                          : 'warning'
                      }
                    >
                      {row.status}
                    </Badge>
                  </div>
                </div>

                {row.alasan && (
                  <p className="text-xs text-muted-foreground">Alasan: {row.alasan}</p>
                )}
                {row.alasan_keputusan && (
                  <p className="text-xs text-muted-foreground">
                    Alasan keputusan: {row.alasan_keputusan}
                  </p>
                )}

                {isAdmin && row.status === 'menunggu' && (
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      disabled={processingId === row.id}
                      onClick={() => decide(row.id, 'setujui')}
                    >
                      {processingId === row.id ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4 mr-2" />
                      )}
                      Setujui
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={processingId === row.id}
                      onClick={() => handleTolak(row.id)}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Tolak
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

