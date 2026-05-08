'use client';

import { useMemo } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  Upload,
  Search,
  DollarSign,
  Send,
  AlertCircle,
  Info,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertContent, AlertDescription, AlertIcon, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { DanaKematian } from '@/lib/supabase';
import {
  DOCUMENT_TYPES,
  getDocumentTypes,
  getMissingDocuments,
  getPendingVerificationDocuments,
  getDocumentStatus,
} from '@/lib/config/dana-kematian-documents';
import { validateClaim } from '@/lib/workflow/dana-kematian-state-machine';

export interface ActionReminder {
  id: string;
  type: 'error' | 'warning' | 'info' | 'success';
  title: string;
  message: string;
  actionable?: boolean;
  icon?: any;
}

interface ActionRemindersProps {
  claim: DanaKematian;
  userRole?: 'cabang' | 'pusat' | 'admin';
  compact?: boolean;
  onActionClick?: (actionId: string) => void;
}

/**
 * Generate contextual action reminders based on claim state
 */
export function getActionReminders(
  claim: DanaKematian,
  userRole: 'cabang' | 'pusat' | 'admin' = 'cabang'
): ActionReminder[] {
  const reminders: ActionReminder[] = [];

  // Validate claim
  const validation = validateClaim(claim);

  // 1. Missing required documents
  if (validation.missing_documents.length > 0) {
    reminders.push({
      id: 'missing-documents',
      type: 'error',
      title: 'Dokumen Belum Lengkap',
      message: `${validation.missing_documents.length} dokumen wajib belum diupload: ${validation.missing_documents.join(', ')}`,
      actionable: true,
      icon: Upload,
    });
  }

  // 2. General validation errors
  if (validation.errors.length > 0) {
    reminders.push({
      id: 'validation-errors',
      type: 'error',
      title: 'Data Belum Lengkap',
      message: validation.errors[0],
      actionable: true,
      icon: AlertCircle,
    });
  }

  // 3. Check for pending verification documents
  const pendingDocs = getPendingVerificationDocuments(claim);
  if (pendingDocs.length > 0 && userRole !== 'cabang') {
    reminders.push({
      id: 'pending-verification',
      type: 'warning',
      title: 'Menunggu Verifikasi',
      message: `${pendingDocs.length} dokumen baru perlu diverifikasi`,
      actionable: true,
      icon: Search,
    });
  }

  // 4. Status-specific reminders
  switch (claim.status_proses) {
    case 'dilaporkan':
      reminders.push({
        id: 'start-verification',
        type: 'info',
        title: 'Mulai Verifikasi',
        message: 'Lapor kematian diterima. Mulai verifikasi dokumen dan komunikasi dengan ahli waris.',
        actionable: true,
        icon: Search,
      });
      break;

    case 'verifikasi_cabang':
      if (validation.can_proceed) {
        reminders.push({
          id: 'send-to-pusat',
          type: 'info',
          title: 'Siap Kirim ke Pusat',
          message: 'Dokumen lengkap. Siap dikirim ke pusat untuk verifikasi.',
          actionable: true,
          icon: Send,
        });
      } else {
        reminders.push({
          id: 'complete-documents',
          type: 'warning',
          title: 'Lengkapi Dokumen',
          message: 'Pastikan semua dokumen wajib sudah diupload.',
          actionable: true,
          icon: FileText,
        });
      }
      break;

    case 'pending_dokumen':
      reminders.push({
        id: 'waiting-documents',
        type: 'warning',
        title: 'Menunggu Dokumen',
        message: 'Dokumen tambahan diperlukan. Hubungi ahli waris untuk kelengkapan.',
        actionable: true,
        icon: Clock,
      });
      break;

    case 'proses_pusat':
      reminders.push({
        id: 'pusat-verification',
        type: 'info',
        title: 'Verifikasi Pusat',
        message: 'Dokumen sedang diverifikasi oleh pusat. Estimasi 3-7 hari kerja.',
        actionable: false,
        icon: Search,
      });
      break;

    case 'verified':
      reminders.push({
        id: 'awaiting-payment',
        type: 'info',
        title: 'Menunggu Penyaluran',
        message: 'Dokumen terverifikasi. Menunggu proses penyaluran dana.',
        actionable: false,
        icon: DollarSign,
      });
      break;

    case 'penyaluran':
      reminders.push({
        id: 'deliver-funds',
        type: 'info',
        title: 'Penyaluran Dana',
        message: 'Dana dalam proses penyaluran. Segera serahkan ke ahli waris.',
        actionable: true,
        icon: Send,
      });
      break;

    case 'selesai':
      reminders.push({
        id: 'completed',
        type: 'success',
        title: 'Pengajuan Selesai',
        message: 'Dana telah diserahkan ke ahli waris. Proses selesai.',
        actionable: false,
        icon: CheckCircle2,
      });
      break;

    case 'ditolak':
      reminders.push({
        id: 'rejected',
        type: 'error',
        title: 'Pengajuan Ditolak',
        message: claim.rejection_reason || 'Pengajuan ditolak. Silakan periksa kembali dokumen.',
        actionable: claim.can_resubmit,
        icon: AlertTriangle,
      });
      break;
  }

  // 5. SLA warnings
  if (claim.sla_status === 'overdue') {
    reminders.push({
      id: 'sla-overdue',
      type: 'error',
      title: 'Terlambat',
      message: `Proses melebihi SLA. Keterlambatan ${claim.overdue_days || 0} hari.`,
      actionable: false,
      icon: AlertTriangle,
    });
  } else if (claim.sla_status === 'at_risk') {
    reminders.push({
      id: 'sla-risk',
      type: 'warning',
      title: 'Risiko Terlambat',
      message: 'Proses mendekati batas waktu SLA.',
      actionable: false,
      icon: Clock,
    });
  }

  return reminders;
}

export function ActionReminders({
  claim,
  userRole = 'cabang',
  compact = false,
  onActionClick,
}: ActionRemindersProps) {
  const reminders = useMemo(() => getActionReminders(claim, userRole), [claim, userRole]);

  const getAlertVariant = (type: ActionReminder['type']) => {
    switch (type) {
      case 'error':
        return 'destructive';
      case 'warning':
        return 'warning';
      case 'success':
        return 'success';
      case 'info':
      default:
        return 'info';
    }
  };

  if (reminders.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">
            <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Semua berjalan dengan baik</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (compact) {
    return (
      <div className="space-y-2">
        {reminders.slice(0, 2).map((reminder) => {
          const Icon = reminder.icon || Info;
          return (
            <Alert
              key={reminder.id}
              variant={getAlertVariant(reminder.type)}
              appearance="light"
              size="sm"
              className={reminder.actionable ? 'cursor-pointer' : ''}
              onClick={() => reminder.actionable && onActionClick?.(reminder.id)}
            >
              <AlertIcon>
                <Icon className="h-4 w-4" />
              </AlertIcon>
              <AlertContent>
                <AlertTitle className="text-xs font-medium">{reminder.title}</AlertTitle>
                <AlertDescription className="text-xs">{reminder.message}</AlertDescription>
              </AlertContent>
            </Alert>
          );
        })}
        {reminders.length > 2 && (
          <p className="text-xs text-muted-foreground text-center">
            +{reminders.length - 2} reminder lainnya
          </p>
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          Tindakan Diperlukan
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {reminders.map((reminder) => {
          const Icon = reminder.icon || Info;
          return (
            <Alert
              key={reminder.id}
              variant={getAlertVariant(reminder.type)}
              appearance="light"
              className={reminder.actionable ? 'cursor-pointer hover:shadow-sm transition-shadow' : ''}
              onClick={() => reminder.actionable && onActionClick?.(reminder.id)}
            >
              <AlertIcon>
                <Icon className="h-4 w-4" />
              </AlertIcon>
              <AlertContent>
                <AlertTitle className="text-sm font-medium flex items-center justify-between">
                  {reminder.title}
                  {reminder.actionable && (
                    <Badge variant="outline" size="xs">
                      Aksi
                    </Badge>
                  )}
                </AlertTitle>
                <AlertDescription className="text-sm">{reminder.message}</AlertDescription>
              </AlertContent>
            </Alert>
          );
        })}
      </CardContent>
    </Card>
  );
}

/**
 * Quick status badge component
 */
export function QuickStatusBadge({ claim }: { claim: DanaKematian }) {
  const reminders = getActionReminders(claim);
  const hasErrors = reminders.some((r) => r.type === 'error');
  const hasWarnings = reminders.some((r) => r.type === 'warning');

  if (hasErrors) {
    return (
      <Badge variant="destructive" size="sm">
        <AlertTriangle className="h-3 w-3 mr-1" />
        Perlu Tindakan
      </Badge>
    );
  }

  if (hasWarnings) {
    return (
      <Badge variant="warning" size="sm">
        <Clock className="h-3 w-3 mr-1" />
        Menunggu
      </Badge>
    );
  }

  if (claim.status_proses === 'selesai') {
    return (
      <Badge variant="success" size="sm">
        <CheckCircle2 className="h-3 w-3 mr-1" />
        Selesai
      </Badge>
    );
  }

  return (
    <Badge variant="info" size="sm">
      <Info className="h-3 w-3 mr-1" />
      Dalam Proses
    </Badge>
  );
}
