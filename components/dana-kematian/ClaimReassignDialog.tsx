'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, ArrowLeftRight } from 'lucide-react';
import { useMasterCabangList } from '@/lib/hooks/use-master-cabang';

interface ClaimReassignDialogProps {
  open: boolean;
  onClose: () => void;
  claimId: string | null;
  currentOwner: string | null;
  onDone: () => void;
}

/**
 * Dialog pengalihan kepemilikan pengajuan — khusus Pusat/admin.
 * Pengalihan tercatat di riwayat audit (riwayat_proses_dakem).
 */
export function ClaimReassignDialog({
  open,
  onClose,
  claimId,
  currentOwner,
  onDone,
}: ClaimReassignDialogProps) {
  const [targetKode, setTargetKode] = useState<string>('');
  const [catatan, setCatatan] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: cabangData, isLoading: loadingCabang } = useMasterCabangList({
    page: 1,
    limit: 500,
  });

  useEffect(() => {
    if (open) {
      setTargetKode('');
      setCatatan('');
      setError(null);
    }
  }, [open]);

  const handleReassign = async () => {
    if (!claimId || !targetKode) {
      setError('Pilih cabang tujuan terlebih dahulu.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/dana-kematian/${claimId}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reassign: targetKode, catatan: catatan || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Gagal mengalihkan kepemilikan');
      onDone();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengalihkan kepemilikan');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5" />
            Alihkan Kepemilikan Pengajuan
          </DialogTitle>
          <DialogDescription>
            Pengalihan hanya dapat dilakukan Pusat dan akan tercatat pada audit trail.
            Cabang pemilik saat ini:{' '}
            <span className="font-medium">{currentOwner || '—'}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">Cabang Tujuan</label>
            <Select value={targetKode} onValueChange={setTargetKode} disabled={loadingCabang || submitting}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={loadingCabang ? 'Memuat cabang...' : 'Pilih cabang'} />
              </SelectTrigger>
              <SelectContent>
                {(cabangData?.data || [])
                  .filter((c) => c.is_active !== false)
                  .map((c) => (
                    <SelectItem key={c.kode_cabang} value={c.kode_cabang}>
                      {c.kode_cabang} — {c.nama_cabang}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Catatan (opsional)</label>
            <Textarea
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              placeholder="Alasan pengalihan kepemilikan (mis. mutasi penanggung jawab)"
              rows={3}
              disabled={submitting}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Batal
          </Button>
          <Button onClick={handleReassign} disabled={submitting || !targetKode}>
            {submitting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <ArrowLeftRight className="h-4 w-4 mr-2" />
            )}
            Alihkan
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
