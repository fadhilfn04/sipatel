import { FileText, CheckCircle, AlertCircle, XCircle } from 'lucide-react';
import { Badge, BadgeDot } from '@/components/ui/badge';
import { calculateDocumentCompleteness, getDocumentStatusBadge } from '@/lib/utils/document-checker';
import { Anggota } from '@/lib/supabase';

interface DocumentStatusBadgeProps {
  anggota: Anggota;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function DocumentStatusBadge({
  anggota,
  showIcon = true,
  size = 'sm'
}: DocumentStatusBadgeProps) {
  const completeness = calculateDocumentCompleteness(anggota);
  const statusBadge = getDocumentStatusBadge(completeness.completenessPercentage);

  const sizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
  };

  const getIcon = () => {
    if (!showIcon) return null;

    const iconClass = iconSizes[size];

    switch (statusBadge.variant) {
      case 'success':
        return <CheckCircle className={iconClass} />;
      case 'warning':
        return <AlertCircle className={iconClass} />;
      case 'destructive':
        return <XCircle className={iconClass} />;
      default:
        return <FileText className={iconClass} />;
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Badge variant={statusBadge.variant} appearance="ghost" className={`${sizeClasses[size]} flex items-center gap-1`}>
        {getIcon()}
        <BadgeDot />
        {statusBadge.label}
      </Badge>
      <span className="text-xs text-muted-foreground">
        {completeness.completedDocuments}/{completeness.totalDocuments} dokumen
      </span>
    </div>
  );
}