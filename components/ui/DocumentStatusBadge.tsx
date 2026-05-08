import { Badge } from '@/components/ui/badge';
import { File, FileCheck, Clock } from 'lucide-react';

export type DocumentStatus = 'not_uploaded' | 'uploaded' | 'verified';

interface DocumentStatusBadgeProps {
  status: DocumentStatus;
  showLabel?: boolean;
  compact?: boolean;
}

export function DocumentStatusBadge({
  status,
  showLabel = true,
  compact = false,
}: DocumentStatusBadgeProps) {
  const config = {
    not_uploaded: {
      variant: 'secondary' as const,
      label: 'Belum Upload',
      icon: File,
      description: 'Dokumen belum diunggah',
    },
    uploaded: {
      variant: 'warning' as const,
      label: 'Baru Upload',
      icon: Clock,
      description: 'Dokumen baru diunggah, menunggu verifikasi',
    },
    verified: {
      variant: 'success' as const,
      label: 'Terverifikasi',
      icon: FileCheck,
      description: 'Dokumen sudah diverifikasi',
    },
  } as const;

  const { variant, label, icon: Icon, description } = config[status];

  if (compact) {
    return (
      <Badge variant={variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {showLabel && <span className="text-xs">{label}</span>}
      </Badge>
    );
  }

  return (
    <Badge
      variant={variant}
      className="gap-1.5 px-3 py-1"
      title={description}
    >
      <Icon className="h-3.5 w-3.5" />
      {showLabel && <span>{label}</span>}
    </Badge>
  );
}

/**
 * Get document status based on file URL and verification flag
 */
export function getDocumentStatus(
  fileUrl: string | null,
  isVerified: boolean
): DocumentStatus {
  if (!fileUrl) return 'not_uploaded';
  if (isVerified) return 'verified';
  return 'uploaded';
}
