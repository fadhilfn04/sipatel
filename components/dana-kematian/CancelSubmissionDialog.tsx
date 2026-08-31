import { AlertTriangle, Loader2, XCircle } from 'lucide-react';
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
import { DanaKematian } from '@/lib/supabase';
import { getStatusProps } from '@/lib/workflow/dana-kematian-status';

interface CancelSubmissionDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  claim: DanaKematian | null;
  isPending: boolean;
}

/**
 * Confirmation dialog for the "Batal" action.
 *
 * Replaces the old "Hapus" flow wording: canceling a submission does NOT
 * delete any data — the record stays in the list with status Batal so the
 * audit trail is preserved.
 */
export function CancelSubmissionDialog({
  open,
  onClose,
  onConfirm,
  claim,
  isPending,
}: CancelSubmissionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <XCircle className="h-5 w-5 text-destructive" />
            Konfirmasi Batal
          </DialogTitle>
          <DialogDescription>
            Batalkan pengajuan dana kematian ini?
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {claim && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Nama Anggota</span>
                <span className="font-medium">{claim.nama_anggota}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Tanggal Meninggal</span>
                <span className="font-mono text-sm">{claim.tanggal_meninggal}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Ahli Waris</span>
                <span className="text-sm">{claim.nama_ahli_waris}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <span className="text-sm">{getStatusProps(claim.status_proses).label}</span>
              </div>
            </div>
          )}
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/40">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800 dark:text-amber-300">
              Data <strong>tidak akan dihapus</strong> dari database — pengajuan akan
              ditandai dengan status <strong>Batal</strong> dan tetap tampil di daftar sebagai arsip.
            </p>
          </div>
        </DialogBody>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Kembali</Button>
          </DialogClose>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Memproses...
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4 mr-2" />
                Ya, Batalkan Pengajuan
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
