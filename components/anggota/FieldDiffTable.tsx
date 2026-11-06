import { formatFieldValue, type FieldChange } from '@/lib/anggota-perubahan';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface FieldDiffTableProps {
  changes: FieldChange[];
  /** Label kolom nilai sebelum perubahan. */
  beforeLabel?: string;
  /** Label kolom nilai setelah perubahan. */
  afterLabel?: string;
  /** Pesan saat tidak ada perubahan. */
  emptyMessage?: string;
}

/**
 * Tabel perbandingan data lama vs baru.
 *
 * Dipakai di langkah konfirmasi halaman Perubahan Data Pribadi dan di modal
 * persetujuan (AnggotaApprovalsModal) agar approver melihat perubahan konkret.
 */
export function FieldDiffTable({
  changes,
  beforeLabel = 'Nilai Saat Ini',
  afterLabel = 'Nilai Baru',
  emptyMessage = 'Belum ada perubahan data.',
}: FieldDiffTableProps) {
  if (!changes.length) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[34%]">Field</TableHead>
            <TableHead>{beforeLabel}</TableHead>
            <TableHead>{afterLabel}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {changes.map((change) => (
            <TableRow key={change.field}>
              <TableCell className="font-medium">{change.label}</TableCell>
              <TableCell className="text-muted-foreground line-through decoration-muted-foreground/40">
                {formatFieldValue(change.before)}
              </TableCell>
              <TableCell className="font-medium">
                {formatFieldValue(change.after)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
