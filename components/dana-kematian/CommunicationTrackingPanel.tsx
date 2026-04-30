'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  MessageCircle,
  Phone,
  CheckCircle2,
  Clock,
  AlertCircle,
  Send,
  User,
  Calendar,
  FileText
} from 'lucide-react';
import { DanaKematian } from '@/lib/supabase';
import { allowsCommunicationTracking } from '@/lib/workflow/dana-kematian-state-machine';

interface CommunicationLog {
  date: Date;
  method: 'whatsapp' | 'phone' | 'in_person' | 'email';
  contacted_by: string;
  contact_person: string;
  outcome: 'successful' | 'unsuccessful' | 'follow_up_required';
  notes: string;
  next_action?: string;
  next_action_date?: Date;
}

interface CommunicationTrackingPanelProps {
  claim: DanaKematian;
  onUpdate?: (updates: Partial<DanaKematian>) => void;
  readonly?: boolean;
}

export function CommunicationTrackingPanel({
  claim,
  onUpdate,
  readonly = false
}: CommunicationTrackingPanelProps) {
  const [showNewLog, setShowNewLog] = useState(false);
  const [newLog, setNewLog] = useState<Partial<CommunicationLog>>({
    method: 'whatsapp',
    outcome: 'successful',
    notes: ''
  });

  // Check if communication tracking is allowed for current status
  const canTrackCommunication = allowsCommunicationTracking(claim.status_proses);

  // Get communication status display
  const getCommunicationStatus = () => {
    switch (claim.komunikasi_status) {
      case 'completed':
        return { label: 'Completed', variant: 'success' as const, icon: CheckCircle2 };
      case 'in_progress':
        return { label: 'In Progress', variant: 'secondary' as const, icon: Clock };
      case 'failed':
        return { label: 'Failed', variant: 'destructive' as const, icon: AlertCircle };
      default:
        return { label: 'Pending', variant: 'secondary' as const, icon: Clock };
    }
  };

  const commStatus = getCommunicationStatus();
  const StatusIcon = commStatus.icon;

  const handleAddLog = () => {
    if (!newLog.notes || !newLog.method) return;

    const updatedNotes = [
      (claim.komunikasi_catatan || ''),
      `[${new Date().toISOString()}] ${newLog.method.toUpperCase()} - ${newLog.outcome}: ${newLog.notes}`,
      newLog.next_action ? `Next action: ${newLog.next_action}` : '',
      newLog.next_action_date ? `Due: ${newLog.next_action_date.toISOString()}` : ''
    ].filter(Boolean).join('\n');

    onUpdate?.({
      komunikasi_status: 'in_progress',
      komunikasi_catatan: updatedNotes,
      komunikasi_terakhir: new Date().toISOString()
    });

    setNewLog({ method: 'whatsapp', outcome: 'successful', notes: '' });
    setShowNewLog(false);
  };

  const handleMarkCompleted = () => {
    onUpdate?.({
      komunikasi_status: 'completed',
      komunikasi_terakhir: new Date().toISOString()
    });
  };

  if (!canTrackCommunication && !readonly) {
    return null;
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <MessageCircle className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Komunikasi & Validasi PC</h3>
            <p className="text-sm text-muted-foreground">
              Fase B: Pengajuan Dakem - Validasi aktif dengan ahli waris
            </p>
          </div>
        </div>
        <Badge variant={commStatus.variant} className="gap-1">
          <StatusIcon className="h-3 w-3" />
          {commStatus.label}
        </Badge>
      </div>

      {/* Current Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
            <User className="h-4 w-4" />
            Ahli Waris
          </div>
          <p className="text-sm">{claim.nama_ahli_waris}</p>
          {claim.no_hp_ahli_waris && (
            <p className="text-xs text-muted-foreground mt-1">
              📱 {claim.no_hp_ahli_waris}
            </p>
          )}
          {claim.nik_ahli_waris && (
            <p className="text-xs text-muted-foreground">
              NIK: {claim.nik_ahli_waris}
            </p>
          )}
        </div>

        <div className="p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
            <Calendar className="h-4 w-4" />
            Terakhir Komunikasi
          </div>
          <p className="text-sm">
            {claim.komunikasi_terakhir
              ? new Date(claim.komunikasi_terakhir).toLocaleDateString('id-ID', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })
              : 'Belum ada komunikasi'}
          </p>
          {claim.alamat_ahli_waris && (
            <p className="text-xs text-muted-foreground mt-1">
              📍 {claim.alamat_ahli_waris}
            </p>
          )}
        </div>
      </div>

      {/* Communication Notes */}
      {claim.komunikasi_catatan && (
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-2 text-sm font-medium text-blue-900 mb-2">
            <FileText className="h-4 w-4" />
            Catatan Komunikasi
          </div>
          <div className="text-sm text-blue-800 whitespace-pre-wrap max-h-40 overflow-y-auto">
            {claim.komunikasi_catatan}
          </div>
        </div>
      )}

      {/* Actions */}
      {!readonly && claim.komunikasi_status !== 'completed' && (
        <div className="flex flex-wrap gap-2">
          {!showNewLog ? (
            <>
              <Button
                onClick={() => setShowNewLog(true)}
                size="sm"
                className="gap-1"
              >
                <MessageCircle className="h-4 w-4" />
                Catat Komunikasi
              </Button>
              <Button
                onClick={handleMarkCompleted}
                variant="outline"
                size="sm"
                className="gap-1"
              >
                <CheckCircle2 className="h-4 w-4" />
                Tandai Selesai
              </Button>
            </>
          ) : (
            <div className="w-full space-y-3 p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium text-sm">Catat Komunikasi Baru</h4>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">
                    Metode
                  </label>
                  <Select
                    value={newLog.method}
                    onValueChange={(value) => setNewLog({ ...newLog, method: value as any })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="whatsapp">
                        <div className="flex items-center gap-2">
                          <MessageCircle className="h-4 w-4" />
                          WhatsApp
                        </div>
                      </SelectItem>
                      <SelectItem value="phone">
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4" />
                          Telepon
                        </div>
                      </SelectItem>
                      <SelectItem value="in_person">Tatap Muka</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">
                    Hasil
                  </label>
                  <Select
                    value={newLog.outcome}
                    onValueChange={(value) => setNewLog({ ...newLog, outcome: value as any })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="successful">Berhasil</SelectItem>
                      <SelectItem value="unsuccessful">Tidak Berhasil</SelectItem>
                      <SelectItem value="follow_up_required">Perlu Follow-up</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">
                  Catatan
                </label>
                <Textarea
                  value={newLog.notes}
                  onChange={(e) => setNewLog({ ...newLog, notes: e.target.value })}
                  placeholder="Deskripsikan hasil komunikasi..."
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">
                    Tindakan Lanjutan (Opsional)
                  </label>
                  <Input
                    value={newLog.next_action || ''}
                    onChange={(e) => setNewLog({ ...newLog, next_action: e.target.value })}
                    placeholder="Tindakan yang diperlukan..."
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">
                    Tanggal Tindakan (Opsional)
                  </label>
                  <Input
                    type="date"
                    value={newLog.next_action_date?.toISOString().split('T')[0] || ''}
                    onChange={(e) => setNewLog({
                      ...newLog,
                      next_action_date: e.target.value ? new Date(e.target.value) : undefined
                    })}
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleAddLog} size="sm" className="gap-1">
                  <Send className="h-4 w-4" />
                  Simpan Catatan
                </Button>
                <Button
                  onClick={() => {
                    setShowNewLog(false);
                    setNewLog({ method: 'whatsapp', outcome: 'successful', notes: '' });
                  }}
                  variant="outline"
                  size="sm"
                >
                  Batal
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {readonly && claim.komunikasi_status === 'completed' && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2 text-green-900">
            <CheckCircle2 className="h-5 w-5" />
            <span className="font-medium">Komunikasi selesai</span>
          </div>
          <p className="text-sm text-green-800 mt-1">
            Semua komunikasi dengan ahli waris telah selesai dan data terverifikasi.
          </p>
        </div>
      )}

      {/* Communication Guidelines */}
      {!readonly && canTrackCommunication && (
        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h4 className="font-medium text-sm text-yellow-900 mb-2">
            Panduan Komunikasi (Fase B)
          </h4>
          <ul className="text-xs text-yellow-800 space-y-1">
            <li>• Hubungi ahli waris melalui WhatsApp/Telepon</li>
            <li>• Jelaskan persyaratan dokumen dengan jelas</li>
            <li>• Berikan timeline proses yang diharapkan</li>
            <li>• Konfirmasi data ahli waris dan hubungan keluarga</li>
            <li>• Jadwalkan pengiriman dokumen</li>
            <li>• Dokumentasikan semua percakapan</li>
          </ul>
        </div>
      )}
    </Card>
  );
}

// Export compact version for inline use
export function CommunicationTrackingCompact({ claim }: { claim: DanaKematian }) {
  const getCommunicationStatus = () => {
    switch (claim.komunikasi_status) {
      case 'completed':
        return { label: 'Completed', variant: 'success' as const };
      case 'in_progress':
        return { label: 'In Progress', variant: 'secondary' as const };
      case 'failed':
        return { label: 'Failed', variant: 'destructive' as const };
      default:
        return { label: 'Pending', variant: 'secondary' as const };
    }
  };

  const commStatus = getCommunicationStatus();

  return (
    <div className="flex items-center gap-2">
      <Badge variant={commStatus.variant}>
        Komunikasi: {commStatus.label}
      </Badge>
      {claim.komunikasi_terakhir && (
        <span className="text-xs text-muted-foreground">
          Terakhir: {new Date(claim.komunikasi_terakhir).toLocaleDateString('id-ID')}
        </span>
      )}
    </div>
  );
}